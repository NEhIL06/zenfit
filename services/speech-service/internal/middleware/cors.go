package middleware

import (
	"net/http"
	"strings"
)

// CORS handles Cross-Origin Resource Sharing with preflight handling.
func CORS(allowedOriginsStr string) func(http.Handler) http.Handler {
	origins := strings.Split(allowedOriginsStr, ",")
	originsMap := make(map[string]bool)
	for _, o := range origins {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			originsMap[trimmed] = true
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Check origin or default to wildcard for internal mesh
			if originsMap[origin] || len(originsMap) == 0 {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			} else {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Request-Id")
			w.Header().Set("Access-Control-Expose-Headers", "X-Audio-Format, X-Audio-Provider, X-Request-Id, Content-Length")
			w.Header().Set("Access-Control-Max-Age", "86400")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
