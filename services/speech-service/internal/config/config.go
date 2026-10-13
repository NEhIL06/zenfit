package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port                    string
	Environment             string
	GeminiAPIKey            string
	PollinationsAPIKey      string
	GeminiTTSModel          string
	GeminiSTTModel          string
	PollinationsBaseURL     string
	CircuitBreakerThreshold int
	CircuitBreakerTimeout   time.Duration
	HTTPClientTimeout       time.Duration
	MaxAudioBytes           int64
	AllowedOrigins          string
}

func Load() (*Config, error) {
	loadDotEnvFiles(".env", "../y/.env", "../../y/.env")

	port := getEnv("PORT", "8081")
	env := getEnv("NODE_ENV", getEnv("ENVIRONMENT", "development"))
	geminiKey := os.Getenv("GEMINI_API_KEY")
	pollinationsKey := os.Getenv("POLLINATIONS_API_KEY")

	// Fail-closed check if in production and all AI keys are absent
	if env == "production" && geminiKey == "" && pollinationsKey == "" {
		return nil, fmt.Errorf("production startup failed: both GEMINI_API_KEY and POLLINATIONS_API_KEY are missing")
	}

	cbThreshold := getEnvInt("CIRCUIT_BREAKER_THRESHOLD", 5)
	cbTimeoutSec := getEnvInt("CIRCUIT_BREAKER_TIMEOUT_SECONDS", 60)
	httpTimeoutSec := getEnvInt("HTTP_CLIENT_TIMEOUT_SECONDS", 15)

	return &Config{
		Port:                    port,
		Environment:             env,
		GeminiAPIKey:            geminiKey,
		PollinationsAPIKey:      pollinationsKey,
		GeminiTTSModel:          getEnv("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts"),
		GeminiSTTModel:          getEnv("GEMINI_STT_MODEL", "gemini-3.8-flash"),
		PollinationsBaseURL:     getEnv("POLLINATIONS_BASE_URL", "https://gen.pollinations.ai/audio"),
		CircuitBreakerThreshold: cbThreshold,
		CircuitBreakerTimeout:   time.Duration(cbTimeoutSec) * time.Second,
		HTTPClientTimeout:       time.Duration(httpTimeoutSec) * time.Second,
		MaxAudioBytes:           5 * 1024 * 1024, // 5MB
		AllowedOrigins:          getEnv("TRUSTED_ORIGINS", "http://localhost:3000,http://localhost:3100"),
	}, nil
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

// loadDotEnvFiles scans candidates and loads the first valid .env file into os.Environ without overwriting already set keys.
func loadDotEnvFiles(paths ...string) {
	for _, p := range paths {
		abs, err := filepath.Abs(p)
		if err != nil {
			continue
		}
		f, err := os.Open(abs)
		if err != nil {
			continue
		}
		defer f.Close()

		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				// Strip surrounding quotes
				val = strings.Trim(val, `"'`)
				if _, exists := os.LookupEnv(key); !exists {
					_ = os.Setenv(key, val)
				}
			}
		}
		return
	}
}
