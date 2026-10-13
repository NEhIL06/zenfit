package proxy

import (
	"encoding/json"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

// Router directs inbound HTTP requests to the appropriate downstream microservice.
type Router struct {
	authProxy   *httputil.ReverseProxy
	aiProxy     *httputil.ReverseProxy
	speechProxy *httputil.ReverseProxy

	authTarget   *url.URL
	aiTarget     *url.URL
	speechTarget *url.URL
}

func NewRouter(authURL, aiURL, speechURL string) (*Router, error) {
	parsedAuth, err := url.Parse(authURL)
	if err != nil {
		return nil, err
	}
	parsedAI, err := url.Parse(aiURL)
	if err != nil {
		return nil, err
	}
	parsedSpeech, err := url.Parse(speechURL)
	if err != nil {
		return nil, err
	}

	return &Router{
		authProxy:    createReverseProxy(parsedAuth),
		aiProxy:      createReverseProxy(parsedAI),
		speechProxy:  createReverseProxy(parsedSpeech),
		authTarget:   parsedAuth,
		aiTarget:     parsedAI,
		speechTarget: parsedSpeech,
	}, nil
}

func createReverseProxy(target *url.URL) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)

	// High-performance pooled transport with HTTP keep-alive
	proxy.Transport = &http.Transport{
		MaxIdleConns:        200,
		MaxIdleConnsPerHost: 100,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 5 * time.Second,
	}

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// Ensure Host matches the upstream host
		req.Host = target.Host
	}

	// Resilient JSON error handling for downstream microservice timeouts
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error":     "Bad Gateway",
			"message":   "Downstream microservice unreachable or timed out",
			"target":    target.String(),
			"path":      r.URL.Path,
			"requestId": r.Header.Get("X-Request-Id"),
		})
	}

	return proxy
}

// RouteTarget identifies which downstream service owns the path.
type ServiceTarget int

const (
	TargetAuthCore ServiceTarget = iota
	TargetAIEngine
	TargetSpeech
	TargetUnknown
)

// ClassifyRoute maps an inbound URL path to the target microservice.
// Implements Section 8a of ZenFit Architecture Specification.
func ClassifyRoute(path string) ServiceTarget {
	cleanPath := strings.ToLower(path)

	// 1. Speech & Audio Service (/v1/voice/*, /v1/transcribe)
	if strings.HasPrefix(cleanPath, "/v1/voice") ||
		strings.HasPrefix(cleanPath, "/v1/transcribe") ||
		strings.HasPrefix(cleanPath, "/speech/") ||
		cleanPath == "/api/generate-voice" ||
		cleanPath == "/api/transcribe" {
		return TargetSpeech
	}

	// 2. AI Engine Service (/v1/chat, /v1/plan/*, /v1/image/*, /v1/quote/*, /v1/documents/*)
	if strings.HasPrefix(cleanPath, "/v1/chat") ||
		strings.HasPrefix(cleanPath, "/v1/plan") ||
		strings.HasPrefix(cleanPath, "/v1/image") ||
		strings.HasPrefix(cleanPath, "/v1/quote") ||
		strings.HasPrefix(cleanPath, "/v1/documents") ||
		strings.HasPrefix(cleanPath, "/api/ai-trainer") ||
		cleanPath == "/api/generate-plan" ||
		cleanPath == "/api/generate-image" ||
		cleanPath == "/api/generate-quote" ||
		cleanPath == "/api/personalized-quote" {
		return TargetAIEngine
	}

	// 3. Auth & Core Service (/v1/auth/*, /v1/users/*, /v1/milestones/*)
	if strings.HasPrefix(cleanPath, "/v1/auth") ||
		strings.HasPrefix(cleanPath, "/v1/users") ||
		strings.HasPrefix(cleanPath, "/v1/milestones") ||
		strings.HasPrefix(cleanPath, "/api/auth") ||
		strings.HasPrefix(cleanPath, "/api/users") ||
		strings.HasPrefix(cleanPath, "/api/milestones") ||
		strings.HasPrefix(cleanPath, "/api/") {
		return TargetAuthCore
	}

	return TargetUnknown
}

// ServeHTTP delegates request proxying to the matched service proxy.
func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	target := ClassifyRoute(req.URL.Path)

	switch target {
	case TargetSpeech:
		// Normalize legacy or path-prefixed routes if needed
		if strings.HasPrefix(req.URL.Path, "/speech/") {
			req.URL.Path = strings.TrimPrefix(req.URL.Path, "/speech")
		} else if req.URL.Path == "/api/generate-voice" {
			req.URL.Path = "/v1/voice/generate"
		} else if req.URL.Path == "/api/transcribe" {
			req.URL.Path = "/v1/transcribe"
		}
		r.speechProxy.ServeHTTP(w, req)

	case TargetAIEngine:
		if req.URL.Path == "/api/generate-plan" {
			req.URL.Path = "/v1/plan/generate"
		} else if req.URL.Path == "/api/generate-image" {
			req.URL.Path = "/v1/image/generate"
		} else if req.URL.Path == "/api/generate-quote" {
			req.URL.Path = "/v1/quote"
		} else if req.URL.Path == "/api/personalized-quote" {
			req.URL.Path = "/v1/quote/personalized"
		} else if strings.HasPrefix(req.URL.Path, "/api/ai-trainer") {
			req.URL.Path = "/v1/chat"
		}
		r.aiProxy.ServeHTTP(w, req)

	case TargetAuthCore:
		if strings.HasPrefix(req.URL.Path, "/api/auth/") {
			req.URL.Path = strings.Replace(req.URL.Path, "/api/auth/", "/v1/auth/", 1)
		} else if strings.HasPrefix(req.URL.Path, "/api/users") {
			req.URL.Path = strings.Replace(req.URL.Path, "/api/users", "/v1/users", 1)
		} else if strings.HasPrefix(req.URL.Path, "/api/milestones") {
			req.URL.Path = strings.Replace(req.URL.Path, "/api/milestones", "/v1/milestones", 1)
		}
		r.authProxy.ServeHTTP(w, req)

	default:
		// Fallback to Auth & Core / Web shell
		r.authProxy.ServeHTTP(w, req)
	}
}
