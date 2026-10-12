package health

import (
	"context"
	"encoding/json"
	"net/http"
	"runtime"
	"time"

	"github.com/redis/go-redis/v9"
)

// Handler provides shallow liveness and deep readiness probes for the Gateway.
// Implements Section 11.3 of ZenFit Architecture Specification.
type Handler struct {
	rdb       *redis.Client
	startTime time.Time
}

func NewHandler(rdb *redis.Client) *Handler {
	return &Handler{
		rdb:       rdb,
		startTime: time.Now(),
	}
}

// Live handles /health/live (Liveness Probe).
// Only tests process viability; never checks external dependencies to prevent cascading reboots.
func (h *Handler) Live(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"service": "zenfit-api-gateway",
		"uptime":  time.Since(h.startTime).String(),
	})
}

// Ready handles /health/ready (Readiness Probe).
// Verifies Redis TCP reachability and reports runtime memory statistics.
func (h *Handler) Ready(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	redisStatus := "connected"
	if h.rdb != nil {
		if err := h.rdb.Ping(ctx).Err(); err != nil {
			redisStatus = "unreachable: " + err.Error()
		}
	} else {
		redisStatus = "in-memory-fallback"
	}

	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	isHealthy := redisStatus == "connected" || redisStatus == "in-memory-fallback"

	statusCode := http.StatusOK
	if !isHealthy {
		statusCode = http.StatusServiceUnavailable
	}

	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       isHealthy,
		"service":      "zenfit-api-gateway",
		"redis":        redisStatus,
		"goroutines":   runtime.NumGoroutine(),
		"allocMB":      float64(memStats.Alloc) / 1024 / 1024,
		"sysMB":        float64(memStats.Sys) / 1024 / 1024,
		"uptime":       time.Since(h.startTime).String(),
	})
}
