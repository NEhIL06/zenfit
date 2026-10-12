package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/zenfit/api-gateway/internal/auth"
)

func TestSanitizeHeaders(t *testing.T) {
	var capturedHeader http.Header

	handler := SanitizeHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedHeader = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-User-Id", "spoofed_admin")
	req.Header.Set("X-User-Role", "spoofed_role")
	req.Header.Set("X-Internal-Secret", "spoofed_secret")
	req.Header.Set("Authorization", "Bearer valid_token")

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// Inbound spoofed headers must be stripped
	if capturedHeader.Get("X-User-Id") != "" {
		t.Errorf("expected X-User-Id to be stripped, got %s", capturedHeader.Get("X-User-Id"))
	}
	if capturedHeader.Get("X-User-Role") != "" {
		t.Errorf("expected X-User-Role to be stripped, got %s", capturedHeader.Get("X-User-Role"))
	}
	if capturedHeader.Get("X-Internal-Secret") != "" {
		t.Errorf("expected X-Internal-Secret to be stripped, got %s", capturedHeader.Get("X-Internal-Secret"))
	}

	// X-Request-Id must be generated
	if capturedHeader.Get("X-Request-Id") == "" {
		t.Error("expected generated X-Request-Id, got empty")
	}
	if w.Header().Get("X-Request-Id") == "" {
		t.Error("expected X-Request-Id returned in response header")
	}
}

func TestAuthMiddleware_RequireAuth(t *testing.T) {
	secret := "test-secret-key-at-least-32-characters-long"
	validator, _ := auth.NewValidator("", "", secret)
	authMw := NewAuthMiddleware(validator)

	var downstreamUserID string
	var downstreamRole string

	testHandler := authMw.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		downstreamUserID = r.Header.Get("X-User-Id")
		downstreamRole = r.Header.Get("X-User-Role")
		w.WriteHeader(http.StatusOK)
	}))

	// 1. Missing Token -> 401
	reqMissing := httptest.NewRequest("GET", "/protected", nil)
	wMissing := httptest.NewRecorder()
	testHandler.ServeHTTP(wMissing, reqMissing)
	if wMissing.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing token, got %d", wMissing.Code)
	}

	// 2. Valid Token -> 200 + Injected Headers
	validToken, _ := auth.GenerateTestToken("usr_secure_456", "coach", "coach@zenfit.app", []byte(secret), 1*time.Hour)
	reqValid := httptest.NewRequest("GET", "/protected", nil)
	reqValid.Header.Set("Authorization", "Bearer "+validToken)
	wValid := httptest.NewRecorder()
	testHandler.ServeHTTP(wValid, reqValid)

	if wValid.Code != http.StatusOK {
		t.Errorf("expected 200 for valid token, got %d", wValid.Code)
	}
	if downstreamUserID != "usr_secure_456" {
		t.Errorf("expected injected X-User-Id usr_secure_456, got %s", downstreamUserID)
	}
	if downstreamRole != "coach" {
		t.Errorf("expected injected X-User-Role coach, got %s", downstreamRole)
	}
}

func TestRateLimiter_InMemoryLimit(t *testing.T) {
	rl := NewRateLimiter(nil, 5, 2, 2, 10, true)

	handler := rl.LimitTier1Global(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// 5 requests within limit
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/api/test", nil)
		req.Header.Set("X-Real-IP", "192.168.1.100")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}

	// 6th request exceeds limit -> 429
	reqExceed := httptest.NewRequest("GET", "/api/test", nil)
	reqExceed.Header.Set("X-Real-IP", "192.168.1.100")
	wExceed := httptest.NewRecorder()
	handler.ServeHTTP(wExceed, reqExceed)
	if wExceed.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests, got %d", wExceed.Code)
	}
}
