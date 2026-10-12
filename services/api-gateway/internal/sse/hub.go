package sse

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/zenfit/api-gateway/internal/middleware"
)

// Hub manages real-time Server-Sent Events (SSE) connections for clients,
// bridging Redis Pub/Sub channels (events:{userId}) directly into HTTP streams.
type Hub struct {
	rdb            *redis.Client
	heartbeatFreq  time.Duration
	activeClients  int64
	mu             sync.RWMutex
	// In-memory broadcast channels for local testing / mock mode without Redis
	localSubscribers map[string]map[chan Event]struct{}
}

// Event represents a push message to a connected client.
type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

func NewHub(rdb *redis.Client) *Hub {
	return &Hub{
		rdb:              rdb,
		heartbeatFreq:    20 * time.Second,
		localSubscribers: make(map[string]map[chan Event]struct{}),
	}
}

// ServeHTTP handles GET /v1/events and holds the HTTP/2 connection open with a goroutine.
// Fulfills Section 7 & Section 8b of ZenFit Architecture Specification.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported by client connection", http.StatusInternalServerError)
		return
	}

	// 1. Extract verified User ID from Context (injected by AuthMiddleware)
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		// Fallback to query param (e.g. EventSource token passing)
		userID = r.URL.Query().Get("userId")
	}

	if userID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: valid authentication token or userId required",
		})
		return
	}

	// 2. Set SSE streaming headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Prevents Nginx buffer holding
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	// 3. Immediately send confirmation handshake event
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"connected\",\"userId\":\"%s\",\"timestamp\":%d}\n\n",
		userID, time.Now().Unix())
	flusher.Flush()

	// 4. Setup Redis or in-memory channel subscription
	channelName := fmt.Sprintf("events:%s", userID)
	var redisSub *redis.PubSub
	var redisCh <-chan *redis.Message
	localCh := h.registerLocal(userID)
	defer h.unregisterLocal(userID, localCh)

	if h.rdb != nil {
		redisSub = h.rdb.Subscribe(r.Context(), channelName)
		defer redisSub.Close()
		redisCh = redisSub.Channel()
	}

	// 5. Setup keepalive heartbeat ticker
	ticker := time.NewTicker(h.heartbeatFreq)
	defer ticker.Stop()

	// 6. The "Hold" Loop: parked on select with zero CPU consumption
	for {
		select {
		case <-r.Context().Done():
			// Client disconnected, closed browser tab, or network severed
			// The goroutine exits, all defer statements run cleanly. Zero memory leaks.
			return

		case <-ticker.C:
			// Heartbeat comment to keep intermediate proxies (Nginx / ALB) alive
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()

		case msg, ok := <-redisCh:
			if !ok {
				return
			}
			// Worker completed job (e.g. plan generation / image generation completed)
			fmt.Fprintf(w, "event: job_completed\ndata: %s\n\n", msg.Payload)
			flusher.Flush()

		case ev := <-localCh:
			dataBytes, _ := json.Marshal(ev.Data)
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, string(dataBytes))
			flusher.Flush()
		}
	}
}

// Publish sends an event to a user via Redis Pub/Sub (or local fallback channel)
func (h *Hub) Publish(ctx context.Context, userID, eventType string, payload interface{}) error {
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	// 1. Publish to Redis channel
	if h.rdb != nil {
		channelName := fmt.Sprintf("events:%s", userID)
		return h.rdb.Publish(ctx, channelName, string(jsonBytes)).Err()
	}

	// 2. Publish to local subscribers
	h.mu.RLock()
	subs := h.localSubscribers[userID]
	ev := Event{Type: eventType, Data: payload}
	for ch := range subs {
		select {
		case ch <- ev:
		default:
			// Non-blocking drop if slow client
		}
	}
	h.mu.RUnlock()
	return nil
}

func (h *Hub) registerLocal(userID string) chan Event {
	h.mu.Lock()
	defer h.mu.Unlock()

	ch := make(chan Event, 10)
	if _, exists := h.localSubscribers[userID]; !exists {
		h.localSubscribers[userID] = make(map[chan Event]struct{})
	}
	h.localSubscribers[userID][ch] = struct{}{}
	return ch
}

func (h *Hub) unregisterLocal(userID string, ch chan Event) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if subs, exists := h.localSubscribers[userID]; exists {
		delete(subs, ch)
		if len(subs) == 0 {
			delete(h.localSubscribers, userID)
		}
	}
	close(ch)
}
