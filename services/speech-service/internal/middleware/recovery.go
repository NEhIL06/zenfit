package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"runtime/debug"
)

// Recovery handles panics and returns clean JSON 500 error responses.
func Recovery(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					stack := string(debug.Stack())
					logger.Error("panic_recovered",
						"panic", rec,
						"stack", stack,
						"path", r.URL.Path,
						"method", r.Method,
					)

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(w).Encode(map[string]string{
						"error":   "INTERNAL_SERVER_ERROR",
						"message": "An unexpected server error occurred",
					})
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}
