package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/zenfit/api-gateway/internal/auth"
)

// AuthMiddleware wraps a handler to authenticate and inject verified identity headers.
type AuthMiddleware struct {
	validator *auth.Validator
}

func NewAuthMiddleware(v *auth.Validator) *AuthMiddleware {
	return &AuthMiddleware{validator: v}
}

// RequireAuth blocks requests unless accompanied by a valid Bearer token or auth cookie.
func (a *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenStr := extractToken(r)
		if tokenStr == "" {
			writeJSONError(w, http.StatusUnauthorized, "Authentication required: missing Bearer token or auth cookie")
			return
		}

		claims, err := a.validator.ValidateToken(tokenStr)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "Invalid or expired token: "+err.Error())
			return
		}

		// Inject verified claims into request context and downstream headers
		ctx := r.Context()
		ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
		ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
		ctx = context.WithValue(ctx, UserEmailKey, claims.Email)

		r.Header.Set("X-User-Id", claims.UserID)
		if claims.Role != "" {
			r.Header.Set("X-User-Role", claims.Role)
		}
		if claims.Email != "" {
			r.Header.Set("X-User-Email", claims.Email)
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalAuth attempts to extract and verify credentials if provided, but does not block.
func (a *AuthMiddleware) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenStr := extractToken(r)
		if tokenStr != "" {
			if claims, err := a.validator.ValidateToken(tokenStr); err == nil {
				ctx := r.Context()
				ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
				ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
				ctx = context.WithValue(ctx, UserEmailKey, claims.Email)

				r.Header.Set("X-User-Id", claims.UserID)
				if claims.Role != "" {
					r.Header.Set("X-User-Role", claims.Role)
				}
				if claims.Email != "" {
					r.Header.Set("X-User-Email", claims.Email)
				}
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}

	// Fallback to cookie
	if cookie, err := r.Cookie("auth_token"); err == nil {
		return cookie.Value
	}
	return ""
}

func writeJSONError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"error":   http.StatusText(statusCode),
		"message": message,
		"code":    statusCode,
	})
}
