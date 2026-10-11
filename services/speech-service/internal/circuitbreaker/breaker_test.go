package circuitbreaker

import (
	"errors"
	"testing"
	"time"
)

func TestCircuitBreaker(t *testing.T) {
	cb := New(Config{
		Name:             "test-breaker",
		FailureThreshold: 3,
		OpenTimeout:      100 * time.Millisecond,
	})

	customErr := errors.New("provider timeout")

	// 1. Initial state should be closed
	if cb.State() != StateClosed {
		t.Fatalf("expected state Closed, got %s", cb.State())
	}

	// 2. Fail 2 times - still closed
	for i := 0; i < 2; i++ {
		err := cb.Execute(func() error {
			return customErr
		})
		if !errors.Is(err, customErr) {
			t.Fatalf("expected customErr, got %v", err)
		}
	}
	if cb.State() != StateClosed {
		t.Fatalf("expected state Closed after 2 failures, got %s", cb.State())
	}

	// 3. Third failure trips the breaker to Open
	_ = cb.Execute(func() error { return customErr })
	if cb.State() != StateOpen {
		t.Fatalf("expected state Open after 3 failures, got %s", cb.State())
	}

	// 4. While open, calls fail immediately with ErrCircuitBreakerOpen without invoking fn
	invoked := false
	err := cb.Execute(func() error {
		invoked = true
		return nil
	})
	if invoked {
		t.Fatal("expected function NOT to be invoked while breaker is open")
	}
	if !errors.Is(err, ErrCircuitBreakerOpen) {
		t.Fatalf("expected ErrCircuitBreakerOpen, got %v", err)
	}

	// 5. Wait for OpenTimeout -> state transitions to HalfOpen on next call
	time.Sleep(120 * time.Millisecond)

	// In half-open, a success resets to Closed
	err = cb.Execute(func() error {
		return nil
	})
	if err != nil {
		t.Fatalf("expected nil error on success, got %v", err)
	}
	if cb.State() != StateClosed {
		t.Fatalf("expected state Closed after recovery, got %s", cb.State())
	}
}
