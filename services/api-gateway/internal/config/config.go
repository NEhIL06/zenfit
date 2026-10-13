package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all runtime configuration for the ZenFit Go API Gateway.
type Config struct {
	Port             string
	Environment      string
	LogLevel         string
	ShutdownTimeout  time.Duration

	// JWT Verification
	JWTPublicKey     string
	JWTPublicKeyPath string
	JWTSecret        string // Symmetric HS256 fallback during migration

	// Redis Connectivity (Pub/Sub for SSE & Rate Limiting)
	RedisURL         string
	RedisPassword    string

	// Downstream Upstream URLs
	AuthServiceURL   string
	AIEngineURL      string
	SpeechServiceURL string

	// Rate Limiting Configuration
	RateLimitEnabled bool
	GlobalRateLimit  int // Req/min per client IP
	AIRateLimit      int // Req/min per authenticated user
	AuthRateLimit    int // Req/min per client IP for login
	CRUDRateLimit    int // Req/min per user for standard CRUD
}

// Load loads configuration from environment variables and fallback .env files.
func Load() (*Config, error) {
	loadDotEnvFiles(".env", "../.env", "../../.env")

	port := getEnv("PORT", "8080")
	env := getEnv("ENVIRONMENT", getEnv("NODE_ENV", "development"))
	logLevel := getEnv("LOG_LEVEL", "info")

	shutdownSec := getEnvAsInt("SHUTDOWN_TIMEOUT_SECONDS", 15)

	return &Config{
		Port:             port,
		Environment:      env,
		LogLevel:         logLevel,
		ShutdownTimeout:  time.Duration(shutdownSec) * time.Second,

		JWTPublicKey:     getEnv("JWT_PUBLIC_KEY", ""),
		JWTPublicKeyPath: getEnv("JWT_PUBLIC_KEY_PATH", ""),
		JWTSecret:        getEnv("JWT_SECRET", "default_zenfit_jwt_secret_dev_key_32chars_min"),

		RedisURL:         getEnv("REDIS_URL", getEnv("UPSTASH_REDIS_TCP_URL", "redis://localhost:6379")),
		RedisPassword:    getEnv("REDIS_PASSWORD", ""),

		AuthServiceURL:   getEnv("AUTH_SERVICE_URL", "http://localhost:3001"),
		AIEngineURL:      getEnv("AI_ENGINE_URL", "http://localhost:8000"),
		SpeechServiceURL: getEnv("SPEECH_SERVICE_URL", "http://localhost:8081"),

		RateLimitEnabled: getEnvAsBool("RATE_LIMIT_ENABLED", true),
		GlobalRateLimit:  getEnvAsInt("RATE_LIMIT_GLOBAL", 100),
		AIRateLimit:      getEnvAsInt("RATE_LIMIT_AI", 10),
		AuthRateLimit:    getEnvAsInt("RATE_LIMIT_AUTH", 10),
		CRUDRateLimit:    getEnvAsInt("RATE_LIMIT_CRUD", 60),
	}, nil
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); strings.TrimSpace(val) != "" {
		return strings.TrimSpace(val)
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := os.Getenv(key)
	if valStr == "" {
		return defaultVal
	}
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return defaultVal
	}
	return val
}

func getEnvAsBool(key string, defaultVal bool) bool {
	valStr := os.Getenv(key)
	if valStr == "" {
		return defaultVal
	}
	val, err := strconv.ParseBool(valStr)
	if err != nil {
		return defaultVal
	}
	return val
}

func loadDotEnvFiles(files ...string) {
	for _, file := range files {
		f, err := os.Open(file)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
				if _, exists := os.LookupEnv(k); !exists {
					_ = os.Setenv(k, v)
				}
			}
		}
		_ = f.Close()
	}
}
