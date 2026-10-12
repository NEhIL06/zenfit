package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type responseWriterInterceptor struct {
	http.ResponseWriter
	statusCode int
	bytesWritten int64
}

func (w *responseWriterInterceptor) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *responseWriterInterceptor) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytesWritten += int64(n)
	return n, err
}

func (w *responseWriterInterceptor) Flush() {
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

// RequestLogger emits structured JSON log entries for each completed HTTP transaction.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		interceptor := &responseWriterInterceptor{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(interceptor, r)

		duration := time.Since(start)

		reqID, _ := r.Context().Value(RequestIDKey).(string)
		userID, _ := r.Context().Value(UserIDKey).(string)

		logEntry := map[string]interface{}{
			"timestamp":    time.Now().UTC().Format(time.RFC3339Nano),
			"method":       r.Method,
			"path":         r.URL.Path,
			"status":       interceptor.statusCode,
			"durationMs":   float64(duration.Microseconds()) / 1000.0,
			"bytesWritten": interceptor.bytesWritten,
			"clientIp":     ExtractClientIP(r),
			"requestId":    reqID,
		}

		if userID != "" {
			logEntry["userId"] = userID
		}

		if bytes, err := json.Marshal(logEntry); err == nil {
			log.Println(string(bytes))
		}
	})
}
