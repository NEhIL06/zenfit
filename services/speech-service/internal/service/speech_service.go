package service

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/zenletics/speech-service/internal/circuitbreaker"
	"github.com/zenletics/speech-service/internal/domain"
	"github.com/zenletics/speech-service/internal/provider/gemini"
	"github.com/zenletics/speech-service/internal/provider/pollinations"
)

type SpeechServiceImpl struct {
	geminiClient       *gemini.Client
	pollinationsClient *pollinations.Client
	circuitBreaker     *circuitbreaker.CircuitBreaker
	logger             *slog.Logger
	maxAudioBytes      int64
}

func NewSpeechService(
	geminiClient *gemini.Client,
	pollinationsClient *pollinations.Client,
	cb *circuitbreaker.CircuitBreaker,
	logger *slog.Logger,
	maxAudioBytes int64,
) *SpeechServiceImpl {
	if maxAudioBytes <= 0 {
		maxAudioBytes = 5 * 1024 * 1024 // 5MB
	}

	return &SpeechServiceImpl{
		geminiClient:       geminiClient,
		pollinationsClient: pollinationsClient,
		circuitBreaker:     cb,
		logger:             logger,
		maxAudioBytes:      maxAudioBytes,
	}
}

// GenerateVoice synthesizes speech with Gemini as primary and Pollinations as circuit-broken fallback.
func (s *SpeechServiceImpl) GenerateVoice(ctx context.Context, req domain.VoiceGenerateRequest) (*domain.VoiceGenerateResult, error) {
	text := strings.TrimSpace(req.Text)
	if text == "" {
		return nil, domain.ErrEmptyText
	}
	if len(text) > 1000 {
		return nil, domain.ErrTextTooLong
	}

	voiceName := req.NormalizedVoiceName()

	// 1. Attempt Primary Gemini TTS under Circuit Breaker protection
	if s.geminiClient.IsConfigured() {
		var geminiResult *domain.VoiceGenerateResult
		err := s.circuitBreaker.Execute(func() error {
			res, ttsErr := s.geminiClient.GenerateTTS(ctx, text, voiceName)
			if ttsErr != nil {
				return ttsErr
			}
			geminiResult = res
			return nil
		})

		if err == nil && geminiResult != nil {
			s.logger.Info("TTS generated via primary engine",
				"provider", "gemini",
				"voice", voiceName,
				"bytes", len(geminiResult.AudioBytes),
			)
			return geminiResult, nil
		}

		s.logger.Warn("Primary Gemini TTS failed or circuit open, falling back to Pollinations",
			"error", err,
			"circuit_state", s.circuitBreaker.State(),
		)
	} else {
		s.logger.Info("Gemini API key unconfigured, utilizing Pollinations fallback engine")
	}

	// 2. Fallback to Pollinations TTS
	pollinationsResult, err := s.pollinationsClient.GenerateTTS(ctx, text, voiceName)
	if err != nil {
		s.logger.Error("Both primary and fallback TTS engines failed", "fallback_error", err)
		return nil, fmt.Errorf("%w: %v", domain.ErrProviderUnavailable, err)
	}

	s.logger.Info("TTS generated via fallback engine",
		"provider", "pollinations",
		"voice", voiceName,
		"bytes", len(pollinationsResult.AudioBytes),
	)

	return pollinationsResult, nil
}

// Transcribe handles audio file upload and speech-to-text conversion.
func (s *SpeechServiceImpl) Transcribe(ctx context.Context, audioData []byte, mimeType string) (*domain.TranscribeResponse, error) {
	if len(audioData) == 0 {
		return nil, domain.ErrEmptyAudio
	}
	if int64(len(audioData)) > s.maxAudioBytes {
		return nil, domain.ErrAudioTooLarge
	}

	cleanMime := strings.ToLower(strings.TrimSpace(mimeType))
	if cleanMime == "" {
		cleanMime = "audio/wav"
	}

	if _, ok := domain.AllowedMimeTypes[cleanMime]; !ok {
		return nil, fmt.Errorf("%w: '%s'", domain.ErrUnsupportedAudioType, cleanMime)
	}

	text, err := s.geminiClient.TranscribeAudio(ctx, audioData, cleanMime)
	if err != nil {
		s.logger.Error("Audio transcription failed", "error", err, "mime_type", cleanMime)
		return nil, err
	}

	s.logger.Info("Audio transcription completed successfully",
		"transcribed_length", len(text),
		"input_bytes", len(audioData),
	)

	return &domain.TranscribeResponse{Text: text}, nil
}

// GetProviderStatus provides health and circuit breaker telemetry.
func (s *SpeechServiceImpl) GetProviderStatus() map[string]interface{} {
	return map[string]interface{}{
		"gemini_configured":     s.geminiClient.IsConfigured(),
		"pollinations_fallback": true,
		"circuit_breaker":       s.circuitBreaker.Stats(),
	}
}
