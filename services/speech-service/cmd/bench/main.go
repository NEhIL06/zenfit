package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type Result struct {
	TotalRequests int64
	SuccessCount  int64
	ErrorCount    int64
	TotalBytes    int64
	Duration      time.Duration
	RPS           float64
	Latencies     []time.Duration
}

func main() {
	targetURL := flag.String("url", "http://localhost:8080/health/live", "Target URL to benchmark")
	method := flag.String("method", "GET", "HTTP method")
	payload := flag.String("payload", "", "JSON request payload")
	acceptHeader := flag.String("accept", "", "Accept header")
	mockHeader := flag.Bool("mock", false, "Send X-Benchmark-Mock header")
	requests := flag.Int("requests", 2000, "Total number of requests to send")
	concurrencies := []int{50, 100, 250, 500, 1000}

	flag.Parse()

	fmt.Println("================================================================================")
	fmt.Printf("ZenFit Speech & Audio Service — Empirical Load Benchmark\n")
	fmt.Printf("Target: %s [%s]\n", *targetURL, *method)
	fmt.Printf("Requests per run: %d | Tested Concurrency Levels: %v\n", *requests, concurrencies)
	fmt.Println("================================================================================")
	fmt.Printf("%-12s | %-10s | %-12s | %-10s | %-10s | %-10s | %-10s\n",
		"Concurrency", "RPS", "Success Rate", "P50 Latency", "P95 Latency", "P99 Latency", "Max Latency",
	)
	fmt.Println("--------------------------------------------------------------------------------")

	if *method == "POST" && *payload == "" {
		*payload = `{"text":"Testing audio voice streaming under concurrent load","voiceName":"Puck"}`
	}

	for _, c := range concurrencies {
		res := runBenchmark(*targetURL, *method, *payload, *acceptHeader, *mockHeader, *requests, c)
		p50, p95, p99, maxL := calculatePercentiles(res.Latencies)
		successRate := float64(res.SuccessCount) / float64(res.TotalRequests) * 100.0

		fmt.Printf("%-12d | %-10.1f | %-11.1f%% | %-10s | %-10s | %-10s | %-10s\n",
			c, res.RPS, successRate, p50, p95, p99, maxL,
		)
		// Small cooldown between concurrency tiers
		time.Sleep(300 * time.Millisecond)
	}
	fmt.Println("================================================================================")
}

func runBenchmark(targetURL, method, payload, accept string, mock bool, totalRequests, concurrency int) Result {
	transport := &http.Transport{
		MaxIdleConns:        concurrency * 2,
		MaxIdleConnsPerHost: concurrency * 2,
		MaxConnsPerHost:     concurrency * 2,
		IdleConnTimeout:     90 * time.Second,
		DisableKeepAlives:   false,
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   10 * time.Second,
	}

	latencies := make([]time.Duration, totalRequests)
	var successCount int64
	var errorCount int64
	var totalBytes int64

	requestsPerWorker := totalRequests / concurrency
	var wg sync.WaitGroup

	start := time.Now()

	for w := 0; w < concurrency; w++ {
		wg.Add(1)
		startIndex := w * requestsPerWorker
		endIndex := startIndex + requestsPerWorker
		if w == concurrency-1 {
			endIndex = totalRequests
		}

		go func(startIdx, endIdx int) {
			defer wg.Done()
			for i := startIdx; i < endIdx; i++ {
				reqStart := time.Now()
				var body io.Reader
				if payload != "" {
					body = bytes.NewReader([]byte(payload))
				}

				req, err := http.NewRequest(method, targetURL, body)
				if err != nil {
					atomic.AddInt64(&errorCount, 1)
					latencies[i] = time.Since(reqStart)
					continue
				}

				if payload != "" {
					req.Header.Set("Content-Type", "application/json")
				}
				if accept != "" {
					req.Header.Set("Accept", accept)
				}
				if mock {
					req.Header.Set("X-Benchmark-Mock", "true")
				}

				resp, err := client.Do(req)
				dur := time.Since(reqStart)
				latencies[i] = dur

				if err != nil {
					atomic.AddInt64(&errorCount, 1)
					continue
				}

				n, _ := io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
				atomic.AddInt64(&totalBytes, n)

				if resp.StatusCode >= 200 && resp.StatusCode < 300 {
					atomic.AddInt64(&successCount, 1)
				} else {
					atomic.AddInt64(&errorCount, 1)
				}
			}
		}(startIndex, endIndex)
	}

	wg.Wait()
	duration := time.Since(start)

	rps := float64(totalRequests) / duration.Seconds()

	return Result{
		TotalRequests: int64(totalRequests),
		SuccessCount:  successCount,
		ErrorCount:    errorCount,
		TotalBytes:    totalBytes,
		Duration:      duration,
		RPS:           rps,
		Latencies:     latencies,
	}
}

func calculatePercentiles(latencies []time.Duration) (p50, p95, p99, max time.Duration) {
	if len(latencies) == 0 {
		return 0, 0, 0, 0
	}
	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	n := len(latencies)
	p50 = latencies[int(float64(n)*0.50)]
	p95 = latencies[int(float64(n)*0.95)]
	p99 = latencies[int(float64(n)*0.99)]
	max = latencies[n-1]
	return
}
