package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/zenfit/api-gateway/internal/auth"
)

type BenchmarkResult struct {
	Name        string
	Concurrency int
	TotalReqs   int64
	SuccessReqs int64
	FailedReqs  int64
	Duration    time.Duration
	RPS         float64
	P50         time.Duration
	P90         time.Duration
	P95         time.Duration
	P99         time.Duration
	Max         time.Duration
}

func main() {
	baseURL := flag.String("url", "http://localhost:8080", "Base URL of the running API Gateway")
	durationSec := flag.Int("duration", 5, "Duration of each load test in seconds")
	flag.Parse()

	fmt.Println("================================================================================")
	fmt.Printf("🚀 ZENFIT GO API GATEWAY EMPIRICAL CONCURRENCY & THROUGHPUT BENCHMARK\n")
	fmt.Printf("Target: %s | Duration per tier: %ds\n", *baseURL, *durationSec)
	fmt.Println("================================================================================")

	secret := "default_zenfit_jwt_secret_dev_key_32chars_min"
	testToken, _ := auth.GenerateTestToken("bench_user_01", "athlete", "bench@zenfit.app", []byte(secret), 24*time.Hour)

	concurrencyTiers := []int{50, 100, 250}

	// 1. Health Probe Benchmark (/health/live)
	fmt.Println("\n--- BENCHMARK 1: GATEWAY M:N MULTIPLEXING & LIVENESS (/health/live) ---")
	var healthResults []BenchmarkResult
	for _, c := range concurrencyTiers {
		res := runHTTPBenchmark("Health Liveness", *baseURL+"/health/live", "GET", "", nil, c, time.Duration(*durationSec)*time.Second)
		healthResults = append(healthResults, res)
		printResult(res)
	}

	// 2. Authenticated Boundary Sanitizer & JWT Verification Benchmark
	fmt.Println("\n--- BENCHMARK 2: AUTH VERIFICATION & HEADER SANITIZATION (/v1/users/me) ---")
	var authResults []BenchmarkResult
	headers := map[string]string{
		"Authorization":   "Bearer " + testToken,
		"X-User-Spoof":    "attacker_id",     // Stripped by Gateway
		"X-Internal-Hack": "bypass_attempt", // Stripped by Gateway
	}
	for _, c := range concurrencyTiers {
		res := runHTTPBenchmark("JWT Auth & Sanitization", *baseURL+"/v1/users/me", "GET", "", headers, c, time.Duration(*durationSec)*time.Second)
		authResults = append(authResults, res)
		printResult(res)
	}

	printMarkdownSummary(healthResults, authResults)
}

func runHTTPBenchmark(name, targetURL, method, body string, headers map[string]string, concurrency int, duration time.Duration) BenchmarkResult {
	client := &http.Client{
		Transport: &http.Transport{
			MaxIdleConns:        1000,
			MaxIdleConnsPerHost: 1000,
			IdleConnTimeout:     90 * time.Second,
			DisableCompression: true,
		},
		Timeout: 5 * time.Second,
	}

	var totalReqs int64
	var successReqs int64
	var failedReqs int64

	latenciesMu := sync.Mutex{}
	latencies := make([]time.Duration, 0, 50000)

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	var wg sync.WaitGroup
	startTime := time.Now()

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				default:
					reqStart := time.Now()
					req, err := http.NewRequestWithContext(ctx, method, targetURL, nil)
					if err != nil {
						atomic.AddInt64(&failedReqs, 1)
						continue
					}
					for k, v := range headers {
						req.Header.Set(k, v)
					}

					resp, err := client.Do(req)
					elapsed := time.Since(reqStart)

					atomic.AddInt64(&totalReqs, 1)
					if err != nil {
						atomic.AddInt64(&failedReqs, 1)
					} else {
						_, _ = io.Copy(io.Discard, resp.Body)
						_ = resp.Body.Close()
						if resp.StatusCode < 500 {
							atomic.AddInt64(&successReqs, 1)
						} else {
							atomic.AddInt64(&failedReqs, 1)
						}
					}

					latenciesMu.Lock()
					if len(latencies) < 100000 {
						latencies = append(latencies, elapsed)
					}
					latenciesMu.Unlock()
				}
			}
		}()
	}

	wg.Wait()
	totalDuration := time.Since(startTime)

	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	var p50, p90, p95, p99, max time.Duration
	if len(latencies) > 0 {
		p50 = latencies[int(float64(len(latencies))*0.50)]
		p90 = latencies[int(float64(len(latencies))*0.90)]
		p95 = latencies[int(float64(len(latencies))*0.95)]
		p99 = latencies[int(float64(len(latencies))*0.99)]
		max = latencies[len(latencies)-1]
	}

	rps := float64(totalReqs) / totalDuration.Seconds()

	return BenchmarkResult{
		Name:        name,
		Concurrency: concurrency,
		TotalReqs:   totalReqs,
		SuccessReqs: successReqs,
		FailedReqs:  failedReqs,
		Duration:    totalDuration,
		RPS:         rps,
		P50:         p50,
		P90:         p90,
		P95:         p95,
		P99:         p99,
		Max:         max,
	}
}

func printResult(r BenchmarkResult) {
	fmt.Printf("[%3d workers] Throughput: %8.1f req/s | Total: %6d | Success: %5.1f%% | P50: %6.2fms | P95: %6.2fms | P99: %6.2fms | Max: %6.2fms\n",
		r.Concurrency,
		r.RPS,
		r.TotalReqs,
		float64(r.SuccessReqs)/float64(r.TotalReqs)*100.0,
		float64(r.P50.Microseconds())/1000.0,
		float64(r.P95.Microseconds())/1000.0,
		float64(r.P99.Microseconds())/1000.0,
		float64(r.Max.Microseconds())/1000.0,
	)
}

func printMarkdownSummary(health, auth []BenchmarkResult) {
	fmt.Println("\n================================================================================")
	fmt.Println("📊 MARKDOWN BENCHMARK SUMMARY (READY FOR ARCHITECTURE.MD)")
	fmt.Println("================================================================================")

	fmt.Println("\n#### A. Gateway Core Liveness Multiplexer (`GET /health/live`)")
	fmt.Println("| Concurrency | Throughput (RPS) | Success Rate | P50 (Median) | P95 Latency | P99 Latency | Max Latency |")
	fmt.Println("|:---:|:---:|:---:|:---:|:---:|:---:|:---:|")
	for _, r := range health {
		fmt.Printf("| **%d** | **%.1f req/s** | **%.1f%%** | **%.2f ms** | **%.2f ms** | **%.2f ms** | **%.2f ms** |\n",
			r.Concurrency, r.RPS, float64(r.SuccessReqs)/float64(r.TotalReqs)*100.0,
			float64(r.P50.Microseconds())/1000.0, float64(r.P95.Microseconds())/1000.0,
			float64(r.P99.Microseconds())/1000.0, float64(r.Max.Microseconds())/1000.0)
	}

	fmt.Println("\n#### B. In-Process JWT Verification & Header Sanitization (`GET /v1/users/me`)")
	fmt.Println("| Concurrency | Throughput (RPS) | Success Rate | P50 (Median) | P95 Latency | P99 Latency | Max Latency |")
	fmt.Println("|:---:|:---:|:---:|:---:|:---:|:---:|:---:|")
	for _, r := range auth {
		fmt.Printf("| **%d** | **%.1f req/s** | **%.1f%%** | **%.2f ms** | **%.2f ms** | **%.2f ms** | **%.2f ms** |\n",
			r.Concurrency, r.RPS, float64(r.SuccessReqs)/float64(r.TotalReqs)*100.0,
			float64(r.P50.Microseconds())/1000.0, float64(r.P95.Microseconds())/1000.0,
			float64(r.P99.Microseconds())/1000.0, float64(r.Max.Microseconds())/1000.0)
	}
}
