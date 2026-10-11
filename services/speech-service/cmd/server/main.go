package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/zenletics/speech-service/internal/circuitbreaker"
	"github.com/zenletics/speech-service/internal/config"
	"github.com/zenletics/speech-service/internal/handler"
	"github.com/zenletics/speech-service/internal/middleware"
	"github.com/zenletics/speech-service/internal/provider/gemini"
	"github.com/zenletics/speech-service/internal/provider/pollinations"
	"github.com/zenletics/speech-service/internal/service"
)

func main() {
	// 1. Structured JSON Logger
	logLevel := slog.LevelInfo
	if os.Getenv("DEBUG") == "true" {
		logLevel = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))
	slog.SetDefault(logger)

	logger.Info("Starting ZenFit Speech & Audio Service...")

	// 2. Load Configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	logger.Info("Configuration loaded successfully",
		"port", cfg.Port,
		"env", cfg.Environment,
		"gemini_tts_model", cfg.GeminiTTSModel,
		"gemini_stt_model", cfg.GeminiSTTModel,
		"gemini_configured", cfg.GeminiAPIKey != "",
		"pollinations_configured", cfg.PollinationsAPIKey != "",
	)

	// 3. Initialize Circuit Breaker
	cb := circuitbreaker.New(circuitbreaker.Config{
		Name:             "gemini-tts-breaker",
		FailureThreshold: cfg.CircuitBreakerThreshold,
		OpenTimeout:      cfg.CircuitBreakerTimeout,
	})

	// 4. Initialize Providers
	geminiClient := gemini.New(
		cfg.GeminiAPIKey,
		cfg.GeminiTTSModel,
		cfg.GeminiSTTModel,
		cfg.HTTPClientTimeout,
	)

	pollinationsClient := pollinations.New(
		cfg.PollinationsAPIKey,
		cfg.PollinationsBaseURL,
		cfg.HTTPClientTimeout,
	)

	// 5. Initialize Service Layer
	speechService := service.NewSpeechService(
		geminiClient,
		pollinationsClient,
		cb,
		logger,
		cfg.MaxAudioBytes,
	)

	// 6. Initialize HTTP Handlers
	speechHandler := handler.NewSpeechHandler(speechService, cfg.MaxAudioBytes)
	healthHandler := handler.NewHealthHandler(speechService)

	// 7. Configure Router
	mux := http.NewServeMux()

	// V1 Domain Endpoints
	mux.HandleFunc("POST /v1/voice/generate", speechHandler.HandleVoiceGenerate)
	mux.HandleFunc("POST /v1/transcribe", speechHandler.HandleTranscribe)

	// Health and Telemetry Endpoints
	mux.HandleFunc("GET /health/live", healthHandler.HandleLive)
	mux.HandleFunc("GET /health/ready", healthHandler.HandleReady)

	// Backward Compatibility / Friendly Root Route
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"service":"zenfit-speech-audio-service","version":"1.0.0","endpoints":["POST /v1/voice/generate","POST /v1/transcribe","GET /health/live","GET /health/ready"]}`))
	})

	// 8. Compose Middleware Pipeline
	var rootHandler http.Handler = mux
	rootHandler = middleware.CORS(cfg.AllowedOrigins)(rootHandler)
	rootHandler = middleware.RequestLogger(logger)(rootHandler)
	rootHandler = middleware.Recovery(logger)(rootHandler)

	// 9. Configure Production Server with Timeouts
	server := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.Port),
		Handler:           rootHandler,
		ReadTimeout:       30 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}

	// 10. Start Server in Background Goroutine
	serverErrors := make(chan error, 1)
	go func() {
		logger.Info(fmt.Sprintf("ZenFit Speech & Audio Service listening on port %s", cfg.Port),
			"url", fmt.Sprintf("http://localhost:%s", cfg.Port),
		)
		serverErrors <- server.ListenAndServe()
	}()

	// 11. Graceful Shutdown on SIGINT / SIGTERM
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Fatal server listener error", "error", err)
			os.Exit(1)
		}

	case sig := <-shutdown:
		logger.Info("Shutdown signal received", "signal", sig.String())

		// Allow up to 15 seconds for active requests to finish draining
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			logger.Error("Graceful shutdown failed, forcing termination", "error", err)
			_ = server.Close()
		}

		logger.Info("ZenFit Speech & Audio Service terminated cleanly")
	}
}
