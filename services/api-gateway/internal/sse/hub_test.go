package sse

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/zenfit/api-gateway/internal/middleware"
)

func TestSSEHub_ConnectAndBroadcast(t *testing.T) {
	hub := NewHub(nil) // Local in-memory testing without Redis

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Inject userId in context
	ctx = context.WithValue(ctx, middleware.UserIDKey, "test_user_42")

	req := httptest.NewRequest("GET", "/v1/events", nil).WithContext(ctx)
	w := httptest.NewRecorder()

	// Run Hub in goroutine
	done := make(chan struct{})
	go func() {
		hub.ServeHTTP(w, req)
		close(done)
	}()

	// Wait 50ms for initial connect event
	time.Sleep(50 * time.Millisecond)

	// Publish test event
	err := hub.Publish(context.Background(), "test_user_42", "workout_plan_ready", map[string]string{
		"planId": "plan_abc123",
		"status": "ready",
	})
	if err != nil {
		t.Fatalf("failed to publish: %v", err)
	}

	time.Sleep(50 * time.Millisecond)

	// Cancel client context to simulate client tab close
	cancel()

	select {
	case <-done:
		// Clean exit
	case <-time.After(2 * time.Second):
		t.Fatal("hub did not exit cleanly upon context cancellation")
	}

	body := w.Body.String()
	if !strings.Contains(body, "event: connected") {
		t.Errorf("expected initial connected event, got:\n%s", body)
	}
	if !strings.Contains(body, "event: workout_plan_ready") {
		t.Errorf("expected published workout_plan_ready event, got:\n%s", body)
	}
	if !strings.Contains(body, "plan_abc123") {
		t.Errorf("expected planId in data payload, got:\n%s", body)
	}
}

func TestSSEHub_UnauthorizedMissingUser(t *testing.T) {
	hub := NewHub(nil)
	req := httptest.NewRequest("GET", "/v1/events", nil)
	w := httptest.NewRecorder()

	hub.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", w.Code)
	}
}

// Verify buffered reader parses SSE protocol lines correctly
func parseSSELines(raw string) []string {
	scanner := bufio.NewScanner(strings.NewReader(raw))
	var lines []string
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines
}
