package proxy

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClassifyRoute(t *testing.T) {
	cases := []struct {
		path     string
		expected ServiceTarget
	}{
		{"/v1/voice/generate", TargetSpeech},
		{"/v1/transcribe", TargetSpeech},
		{"/speech/v1/voice/generate", TargetSpeech},
		{"/api/generate-voice", TargetSpeech},
		{"/api/transcribe", TargetSpeech},

		{"/v1/chat", TargetAIEngine},
		{"/v1/plan/generate", TargetAIEngine},
		{"/v1/image/generate", TargetAIEngine},
		{"/v1/quote", TargetAIEngine},
		{"/v1/documents", TargetAIEngine},

		{"/v1/auth/login", TargetAuthCore},
		{"/v1/auth/refresh", TargetAuthCore},
		{"/v1/users/usr_123", TargetAuthCore},
		{"/v1/milestones", TargetAuthCore},
		{"/api/users", TargetAuthCore},
	}

	for _, tc := range cases {
		got := ClassifyRoute(tc.path)
		if got != tc.expected {
			t.Errorf("path %s: expected %v, got %v", tc.path, tc.expected, got)
		}
	}
}

func TestRouter_Forwarding(t *testing.T) {
	// 1. Mock Speech Service
	speechMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Service", "speech-mock")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("audio-data"))
	}))
	defer speechMock.Close()

	// 2. Mock AI Service
	aiMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Service", "ai-mock")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"reply":"ai-response"}`))
	}))
	defer aiMock.Close()

	// 3. Mock Auth Service
	authMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Service", "auth-mock")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"userId":"usr_123"}`))
	}))
	defer authMock.Close()

	router, err := NewRouter(authMock.URL, aiMock.URL, speechMock.URL)
	if err != nil {
		t.Fatalf("failed to create router: %v", err)
	}

	// Test Speech route
	reqSpeech := httptest.NewRequest("POST", "/v1/voice/generate", nil)
	wSpeech := httptest.NewRecorder()
	router.ServeHTTP(wSpeech, reqSpeech)
	if wSpeech.Header().Get("X-Service") != "speech-mock" {
		t.Errorf("expected speech-mock, got %s", wSpeech.Header().Get("X-Service"))
	}
	bodySpeech, _ := io.ReadAll(wSpeech.Body)
	if string(bodySpeech) != "audio-data" {
		t.Errorf("expected audio-data, got %s", string(bodySpeech))
	}

	// Test AI route
	reqAI := httptest.NewRequest("POST", "/v1/chat", nil)
	wAI := httptest.NewRecorder()
	router.ServeHTTP(wAI, reqAI)
	if wAI.Header().Get("X-Service") != "ai-mock" {
		t.Errorf("expected ai-mock, got %s", wAI.Header().Get("X-Service"))
	}

	// Test Auth route
	reqAuth := httptest.NewRequest("GET", "/v1/users/usr_123", nil)
	wAuth := httptest.NewRecorder()
	router.ServeHTTP(wAuth, reqAuth)
	if wAuth.Header().Get("X-Service") != "auth-mock" {
		t.Errorf("expected auth-mock, got %s", wAuth.Header().Get("X-Service"))
	}
}
