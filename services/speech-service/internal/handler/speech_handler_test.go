package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/zenletics/speech-service/internal/domain"
)

type mockSpeechService struct {
	voiceResult    *domain.VoiceGenerateResult
	voiceErr       error
	transcribeRes  *domain.TranscribeResponse
	transcribeErr  error
	providerStatus map[string]interface{}
}

func (m *mockSpeechService) GenerateVoice(ctx context.Context, req domain.VoiceGenerateRequest) (*domain.VoiceGenerateResult, error) {
	if m.voiceErr != nil {
		return nil, m.voiceErr
	}
	return m.voiceResult, nil
}

func (m *mockSpeechService) Transcribe(ctx context.Context, audioData []byte, mimeType string) (*domain.TranscribeResponse, error) {
	if m.transcribeErr != nil {
		return nil, m.transcribeErr
	}
	return m.transcribeRes, nil
}

func (m *mockSpeechService) GetProviderStatus() map[string]interface{} {
	if m.providerStatus != nil {
		return m.providerStatus
	}
	return map[string]interface{}{"status": "ok"}
}

func TestVoiceGenerateHandler_BinaryStream(t *testing.T) {
	mockAudio := []byte("RIFF1234WAVEfmt mock audio data")
	svc := &mockSpeechService{
		voiceResult: &domain.VoiceGenerateResult{
			AudioBytes: mockAudio,
			Format:     domain.AudioFormatWAV,
			MimeType:   "audio/wav",
			Provider:   "gemini",
		},
	}
	h := NewSpeechHandler(svc, 5*1024*1024)

	body := `{"text":"Hello world","voiceName":"Puck"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/voice/generate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	// No Accept header or audio/*
	req.Header.Set("Accept", "audio/wav")

	rec := httptest.NewRecorder()
	h.HandleVoiceGenerate(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	if rec.Header().Get("Content-Type") != "audio/wav" {
		t.Errorf("expected Content-Type audio/wav, got %s", rec.Header().Get("Content-Type"))
	}

	if rec.Header().Get("X-Audio-Provider") != "gemini" {
		t.Errorf("expected X-Audio-Provider gemini, got %s", rec.Header().Get("X-Audio-Provider"))
	}

	if !bytes.Equal(rec.Body.Bytes(), mockAudio) {
		t.Errorf("body does not match raw audio bytes")
	}
}

func TestVoiceGenerateHandler_JSONBackwardCompat(t *testing.T) {
	mockAudio := []byte("mock audio pcm/wav")
	svc := &mockSpeechService{
		voiceResult: &domain.VoiceGenerateResult{
			AudioBytes: mockAudio,
			Format:     domain.AudioFormatWAV,
			MimeType:   "audio/wav",
			Provider:   "gemini",
		},
	}
	h := NewSpeechHandler(svc, 5*1024*1024)

	body := `{"text":"Hello world","voiceName":"Puck"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/voice/generate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	rec := httptest.NewRecorder()
	h.HandleVoiceGenerate(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	if !strings.Contains(rec.Header().Get("Content-Type"), "application/json") {
		t.Errorf("expected Content-Type application/json, got %s", rec.Header().Get("Content-Type"))
	}

	var jsonResp domain.VoiceGenerateJSONResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &jsonResp); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	if jsonResp.Format != "wav" {
		t.Errorf("expected format wav, got %s", jsonResp.Format)
	}

	if jsonResp.AudioData == "" {
		t.Errorf("expected base64 audioData string, got empty")
	}
}

func TestTranscribeHandler(t *testing.T) {
	svc := &mockSpeechService{
		transcribeRes: &domain.TranscribeResponse{
			Text: "I want to do a 30 minute core workout",
		},
	}
	h := NewSpeechHandler(svc, 5*1024*1024)

	// Create multipart body
	bodyBuf := new(bytes.Buffer)
	mpWriter := multipart.NewWriter(bodyBuf)
	part, err := mpWriter.CreateFormFile("file", "recording.wav")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	_, _ = part.Write([]byte("RIFFdummywavdata"))
	_ = mpWriter.Close()

	req := httptest.NewRequest(http.MethodPost, "/v1/transcribe", bodyBuf)
	req.Header.Set("Content-Type", mpWriter.FormDataContentType())

	rec := httptest.NewRecorder()
	h.HandleTranscribe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var res domain.TranscribeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse response JSON: %v", err)
	}

	if res.Text != "I want to do a 30 minute core workout" {
		t.Errorf("expected transcribed text, got %s", res.Text)
	}
}

func TestHealthHandler(t *testing.T) {
	svc := &mockSpeechService{}
	hh := NewHealthHandler(svc)

	// Test Live
	recLive := httptest.NewRecorder()
	reqLive := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	hh.HandleLive(recLive, reqLive)
	if recLive.Code != http.StatusOK {
		t.Errorf("expected /health/live 200, got %d", recLive.Code)
	}

	// Test Ready
	recReady := httptest.NewRecorder()
	reqReady := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	hh.HandleReady(recReady, reqReady)
	if recReady.Code != http.StatusOK {
		t.Errorf("expected /health/ready 200, got %d", recReady.Code)
	}
}
