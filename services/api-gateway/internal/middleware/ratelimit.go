package middleware

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimiter enforces tiered sliding-window rate limits backed by Redis TCP
// with in-memory fallback for local dev or network partitions.
type RateLimiter struct {
	rdb             *redis.Client
	globalLimit     int // req/min
	aiLimit         int // req/min
	authLimit       int // req/min
	crudLimit       int // req/min
	enabled         bool

	// In-memory fallback sliding window cache
	mu              sync.Mutex
	inMemoryWindows map[string][]time.Time
}

func NewRateLimiter(rdb *redis.Client, global, ai, auth, crud int, enabled bool) *RateLimiter {
	rl := &RateLimiter{
		rdb:             rdb,
		globalLimit:     global,
		aiLimit:         ai,
		authLimit:       auth,
		crudLimit:       crud,
		enabled:         enabled,
		inMemoryWindows: make(map[string][]time.Time),
	}

	// In-memory cleanup loop every 2 minutes
	go rl.cleanupInMemory()

	return rl
}

func (rl *RateLimiter) cleanupInMemory() {
	ticker := time.NewTicker(2 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		cutoff := now.Add(-1 * time.Minute)
		for k, timestamps := range rl.inMemoryWindows {
			var valid []time.Time
			for _, t := range timestamps {
				if t.After(cutoff) {
					valid = append(valid, t)
				}
			}
			if len(valid) == 0 {
				delete(rl.inMemoryWindows, k)
			} else {
				rl.inMemoryWindows[k] = valid
			}
		}
		rl.mu.Unlock()
	}
}

// CheckLimit checks if a key is within limit. Returns allowed, remaining, and retryAfter.
func (rl *RateLimiter) CheckLimit(ctx context.Context, keyPrefix, identifier string, limit int, window time.Duration) (bool, int, time.Duration) {
	if !rl.enabled {
		return true, limit, 0
	}

	redisKey := fmt.Sprintf("ratelimit:%s:%s", keyPrefix, identifier)

	// 1. Try Redis sliding window counter via pipelined transaction
	if rl.rdb != nil {
		now := time.Now()
		nowMicro := now.UnixMicro()
		windowStartMicro := now.Add(-window).UnixMicro()

		pipe := rl.rdb.TxPipeline()
		// Remove entries older than window
		pipe.ZRemRangeByScore(ctx, redisKey, "0", fmt.Sprintf("%d", windowStartMicro))
		// Add current request
		pipe.ZAdd(ctx, redisKey, redis.Z{Score: float64(nowMicro), Member: fmt.Sprintf("%d", nowMicro)})
		// Count items in window
		countCmd := pipe.ZCard(ctx, redisKey)
		// Set TTL slightly longer than window
		pipe.Expire(ctx, redisKey, window+5*time.Second)

		_, err := pipe.Exec(ctx)
		if err == nil {
			currentCount := int(countCmd.Val())
			if currentCount <= limit {
				return true, limit - currentCount, 0
			}
			return false, 0, window
		}
		// Redis error: fall through to in-memory fallback
	}

	// 2. In-Memory fallback
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-window)
	timestamps := rl.inMemoryWindows[redisKey]

	var valid []time.Time
	for _, t := range timestamps {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= limit {
		rl.inMemoryWindows[redisKey] = valid
		return false, 0, window
	}

	valid = append(valid, now)
	rl.inMemoryWindows[redisKey] = valid
	return true, limit - len(valid), 0
}

// LimitTier1Global enforces per-client IP protection (100 req/min)
func (rl *RateLimiter) LimitTier1Global(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := ExtractClientIP(r)
		allowed, remaining, retryAfter := rl.CheckLimit(r.Context(), "global", ip, rl.globalLimit, 1*time.Minute)

		w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", rl.globalLimit))
		w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

		if !allowed {
			w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retryAfter.Seconds())))
			writeJSONError(w, http.StatusTooManyRequests, "Global rate limit exceeded: maximum 100 requests per minute")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// LimitTier2AI enforces per-user GenAI limits (Section 10.1: Fail-closed on high-cost routes)
func (rl *RateLimiter) LimitTier2AI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Identify user from context or fallback to client IP
		identifier := r.Header.Get("X-User-Id")
		if identifier == "" {
			identifier = ExtractClientIP(r)
		}

		allowed, remaining, retryAfter := rl.CheckLimit(r.Context(), "ai", identifier, rl.aiLimit, 1*time.Minute)

		w.Header().Set("X-RateLimit-Limit-AI", fmt.Sprintf("%d", rl.aiLimit))
		w.Header().Set("X-RateLimit-Remaining-AI", fmt.Sprintf("%d", remaining))

		if !allowed {
			w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retryAfter.Seconds())))
			writeJSONError(w, http.StatusTooManyRequests, "AI operation rate limit exceeded: protects high-cost model inference")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// LimitTier3Auth enforces strict limits on login/registration (10 attempts/min)
func (rl *RateLimiter) LimitTier3Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := ExtractClientIP(r)
		allowed, _, retryAfter := rl.CheckLimit(r.Context(), "auth", ip, rl.authLimit, 1*time.Minute)

		if !allowed {
			w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retryAfter.Seconds())))
			writeJSONError(w, http.StatusTooManyRequests, "Authentication rate limit exceeded: too many login attempts")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ExtractClientIP extracts the true remote IP address.
func ExtractClientIP(r *http.Request) string {
	// Nginx sets X-Real-IP to $remote_addr
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}
	if fwd := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); fwd != "" {
		parts := strings.Split(fwd, ",")
		return strings.TrimSpace(parts[0])
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
