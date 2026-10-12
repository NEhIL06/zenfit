package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type contextKey string

const (
	RequestIDKey contextKey = "requestId"
	UserIDKey    contextKey = "userId"
	UserRoleKey  contextKey = "userRole"
	UserEmailKey contextKey = "userEmail"
)

// SanitizeHeaders unconditionally strips all untrusted client-supplied identity headers
// (X-User-*, X-Internal-*) and injects a globally unique X-Request-Id.
// Fulfills Section 9.2.A of ZenFit Architecture Specification.
func SanitizeHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Strip all inbound spoofable headers
		for headerName := range r.Header {
			lower := strings.ToLower(headerName)
			if strings.HasPrefix(lower, "x-user-") || strings.HasPrefix(lower, "x-internal-") {
				r.Header.Del(headerName)
			}
		}

		// 2. Ensure or generate distributed tracing X-Request-Id
		reqID := r.Header.Get("X-Request-Id")
		if reqID == "" {
			reqID = uuid.New().String()
			r.Header.Set("X-Request-Id", reqID)
		}
		w.Header().Set("X-Request-Id", reqID)

		// 3. Attach RequestID to Context
		ctx := context.WithValue(r.Context(), RequestIDKey, reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
