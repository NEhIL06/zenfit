package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/zenfit/api-gateway/internal/auth"
	"github.com/zenfit/api-gateway/internal/config"
	"github.com/zenfit/api-gateway/internal/health"
	"github.com/zenfit/api-gateway/internal/middleware"
	"github.com/zenfit/api-gateway/internal/proxy"
	"github.com/zenfit/api-gateway/internal/sse"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Fatal: failed to load configuration: %v", err)
	}

	log.Printf("[INFO] Initializing ZenFit API Gateway in %s mode on port %s", cfg.Environment, cfg.Port)

	// 1. Initialize Redis Client (Persistent TCP connection pool)
	var rdb *redis.Client
	if strings.TrimSpace(cfg.RedisURL) != "" {
		opt, err := redis.ParseURL(cfg.RedisURL)
		if err == nil {
			if cfg.RedisPassword != "" {
				opt.Password = cfg.RedisPassword
			}
			rdb = redis.NewClient(opt)
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			if err := rdb.Ping(ctx).Err(); err != nil {
				log.Printf("[WARN] Redis unreachable at %s: %v (falling back to in-memory mode)", cfg.RedisURL, err)
			} else {
				log.Printf("[INFO] Connected to Redis TCP instance successfully (%s)", cfg.RedisURL)
			}
			cancel()
		} else {
			log.Printf("[WARN] Invalid REDIS_URL format: %v (falling back to in-memory mode)", err)
		}
	}

	// 2. Initialize JWT Validator (RS256 Public Key + HS256 Fallback)
	jwtValidator, err := auth.NewValidator(cfg.JWTPublicKey, cfg.JWTPublicKeyPath, cfg.JWTSecret)
	if err != nil {
		log.Fatalf("Fatal: failed to initialize JWT validator: %v", err)
	}
	authMw := middleware.NewAuthMiddleware(jwtValidator)

	// 3. Initialize SSE Hub
	sseHub := sse.NewHub(rdb)

	// 4. Initialize Health Probes
	healthHandler := health.NewHandler(rdb)

	// 5. Initialize Rate Limiter
	rateLimiter := middleware.NewRateLimiter(
		rdb,
		cfg.GlobalRateLimit,
		cfg.AIRateLimit,
		cfg.AuthRateLimit,
		cfg.CRUDRateLimit,
		cfg.RateLimitEnabled,
	)

	// 6. Initialize Microservices Reverse Proxy
	proxyRouter, err := proxy.NewRouter(cfg.AuthServiceURL, cfg.AIEngineURL, cfg.SpeechServiceURL)
	if err != nil {
		log.Fatalf("Fatal: failed to initialize microservices proxy: %v", err)
	}

	// 7. Route Multiplexer
	mux := http.NewServeMux()

	// A. Health Probes (No rate limiting, no auth)
	mux.HandleFunc("/health/live", healthHandler.Live)
	mux.HandleFunc("/health/ready", healthHandler.Ready)
	mux.HandleFunc("/health", healthHandler.Live) // Alias

	// B. Real-Time Embedded SSE Hub (/v1/events)
	// Supports auth via query param or Authorization header
	mux.Handle("/v1/events", authMw.OptionalAuth(sseHub))
	mux.Handle("/api/v1/events", authMw.OptionalAuth(sseHub)) // Nginx alias

	// C. Internal Event Broadcast endpoint (for Python workers / load test mock events)
	mux.HandleFunc("/v1/events/publish", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			UserID    string      `json:"userId"`
			EventType string      `json:"eventType"`
			Data      interface{} `json:"data"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if req.UserID == "" {
			http.Error(w, "userId required", http.StatusBadRequest)
			return
		}
		if err := sseHub.Publish(r.Context(), req.UserID, req.EventType, req.Data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "published"})
	})

	// D. Auth Routes (Strict Tier 3 Rate Limit: 10 req/min)
	authHandler := rateLimiter.LimitTier3Auth(proxyRouter)
	mux.Handle("/v1/auth/", authHandler)
	mux.Handle("/api/auth/", authHandler)

	// E. AI Inference Routes (Tier 2 Rate Limit: 10 req/min per user)
	aiHandler := authMw.OptionalAuth(rateLimiter.LimitTier2AI(proxyRouter))
	mux.Handle("/v1/chat", aiHandler)
	mux.Handle("/v1/plan/", aiHandler)
	mux.Handle("/v1/image/", aiHandler)
	mux.Handle("/v1/quote", aiHandler)
	mux.Handle("/v1/documents", aiHandler)

	// F. Speech & Audio Service Routes (/v1/voice/*, /v1/transcribe)
	speechHandler := authMw.OptionalAuth(proxyRouter)
	mux.Handle("/v1/voice/", speechHandler)
	mux.Handle("/v1/transcribe", speechHandler)

	// G. Catch-All Dynamic Proxy Route (App / Users / Milestones / Static)
	mux.Handle("/", authMw.OptionalAuth(proxyRouter))

	// 8. Wrap root pipeline with Boundary Sanitizer, Logger & Global DDoS Limiter
	rootHandler := middleware.SanitizeHeaders(
		middleware.RequestLogger(
			rateLimiter.LimitTier1Global(mux),
		),
	)

	// 9. HTTP Server setup with strict production timeouts
	addr := fmt.Sprintf(":%s", cfg.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           rootHandler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      0, // Disabled for long-lived SSE streams
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1 MB
	}

	// 10. Start Server in Goroutine
	serverErr := make(chan error, 1)
	go func() {
		log.Printf("[INFO] ZenFit API Gateway listening on %s (HTTP/1.1 & HTTP/2)", addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	// 11. Graceful Shutdown on SIGINT/SIGTERM
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		log.Fatalf("[FATAL] Gateway server encountered an unrecoverable error: %v", err)
	case sig := <-stop:
		log.Printf("[INFO] Received signal %v. Initiating graceful shutdown...", sig)
		ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			log.Printf("[ERROR] Server shutdown error: %v", err)
		}
		if rdb != nil {
			_ = rdb.Close()
		}
		log.Println("[INFO] ZenFit API Gateway terminated cleanly.")
	}
}
