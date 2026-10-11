package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/zenletics/speech-service/internal/domain"
)

type HealthHandler struct {
	service   domain.SpeechService
	startTime time.Time
}

func NewHealthHandler(service domain.SpeechService) *HealthHandler {
	return &HealthHandler{
		service:   service,
		startTime: time.Now(),
	}
}

// HandleLive represents the liveness probe (/health/live).
// It verifies only that the HTTP server process is running and able to respond.
func (h *HealthHandler) HandleLive(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "UP",
		"uptime": time.Since(h.startTime).String(),
	})
}

// HandleReady represents the readiness probe (/health/ready).
// It verifies that speech providers and circuit breakers are operational.
func (h *HealthHandler) HandleReady(w http.ResponseWriter, r *http.Request) {
	status := h.service.GetProviderStatus()
	w.Header().Set("Content-Type", "application/json")

	// The service is ready if at least one provider is available (Gemini or Pollinations)
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "READY",
		"providers": status,
		"uptime":    time.Since(h.startTime).String(),
	})
}
