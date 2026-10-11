package circuitbreaker

import (
	"errors"
	"sync"
	"time"
)

var (
	ErrCircuitBreakerOpen = errors.New("circuit breaker is open: primary service degraded")
)

type State string

const (
	StateClosed   State = "closed"
	StateOpen     State = "open"
	StateHalfOpen State = "half-open"
)

type Config struct {
	Name            string
	FailureThreshold int
	OpenTimeout     time.Duration
}

// CircuitBreaker protects downstream services from cascading timeouts.
type CircuitBreaker struct {
	name            string
	failureThreshold int
	openTimeout     time.Duration

	mu               sync.RWMutex
	state            State
	consecutiveFails int
	lastStateChange  time.Time
}

// New creates an initialized CircuitBreaker.
func New(cfg Config) *CircuitBreaker {
	threshold := cfg.FailureThreshold
	if threshold <= 0 {
		threshold = 5
	}
	timeout := cfg.OpenTimeout
	if timeout <= 0 {
		timeout = 60 * time.Second
	}

	return &CircuitBreaker{
		name:             cfg.Name,
		failureThreshold: threshold,
		openTimeout:      timeout,
		state:            StateClosed,
		lastStateChange:  time.Now(),
	}
}

// Execute runs the protected action, tripping the breaker on repeated failures.
func (cb *CircuitBreaker) Execute(fn func() error) error {
	if !cb.allowExecution() {
		return ErrCircuitBreakerOpen
	}

	err := fn()

	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		cb.recordFailureLocked()
		return err
	}

	cb.recordSuccessLocked()
	return nil
}

func (cb *CircuitBreaker) allowExecution() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()

	switch cb.state {
	case StateClosed:
		return true

	case StateOpen:
		if now.Sub(cb.lastStateChange) >= cb.openTimeout {
			cb.state = StateHalfOpen
			cb.lastStateChange = now
			return true
		}
		return false

	case StateHalfOpen:
		// In half-open state, only allow one probe attempt
		return true

	default:
		cb.state = StateClosed
		return true
	}
}

func (cb *CircuitBreaker) recordFailureLocked() {
	cb.consecutiveFails++
	now := time.Now()

	if cb.state == StateHalfOpen || cb.consecutiveFails >= cb.failureThreshold {
		cb.state = StateOpen
		cb.lastStateChange = now
	}
}

func (cb *CircuitBreaker) recordSuccessLocked() {
	if cb.state == StateHalfOpen || cb.consecutiveFails > 0 {
		cb.state = StateClosed
		cb.consecutiveFails = 0
		cb.lastStateChange = time.Now()
	}
}

// State returns the current circuit breaker state.
func (cb *CircuitBreaker) State() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Stats returns the breaker status snapshot for health reporting.
func (cb *CircuitBreaker) Stats() map[string]interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return map[string]interface{}{
		"name":             cb.name,
		"state":            string(cb.state),
		"consecutiveFails": cb.consecutiveFails,
		"failureThreshold": cb.failureThreshold,
		"lastStateChange":  cb.lastStateChange.Format(time.RFC3339),
	}
}
