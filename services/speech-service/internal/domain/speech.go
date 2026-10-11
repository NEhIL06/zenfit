package domain

import (
	"context"
	"errors"
)

var (
	ErrEmptyText           = errors.New("text content cannot be empty")
	ErrTextTooLong         = errors.New("text exceeds maximum length of 1000 characters")
	ErrEmptyAudio          = errors.New("audio data cannot be empty")
	ErrAudioTooLarge       = errors.New("audio file exceeds 5MB size limit")
	ErrUnsupportedAudioType = errors.New("unsupported audio MIME type")
	ErrProviderUnavailable = errors.New("all speech providers are currently unavailable")
)

// AudioFormat represents the audio container format.
type AudioFormat string

const (
	AudioFormatWAV AudioFormat = "wav"
	AudioFormatMP3 AudioFormat = "mp3"
)

// Supported MIME types for STT uploads.
var AllowedMimeTypes = map[string]struct{}{
	"audio/wav":   {},
	"audio/x-wav": {},
	"audio/mpeg":  {},
	"audio/mp3":   {},
	"audio/webm":  {},
	"audio/mp4":   {},
}

// VoiceGenerateRequest represents the input payload for TTS.
type VoiceGenerateRequest struct {
	Text      string `json:"text"`
	VoiceName string `json:"voiceName,omitempty"`
	Voice     string `json:"voice,omitempty"` // Alias for backward compatibility
}

// NormalizedVoiceName returns a valid voice name, defaulting to "Puck".
func (r *VoiceGenerateRequest) NormalizedVoiceName() string {
	if r.VoiceName != "" {
		return r.VoiceName
	}
	if r.Voice != "" {
		return r.Voice
	}
	return "Puck"
}

// VoiceGenerateResult holds the raw audio synthesis result from providers.
type VoiceGenerateResult struct {
	AudioBytes []byte
	Format     AudioFormat
	MimeType   string
	Provider   string
}

// VoiceGenerateJSONResponse represents the JSON response format for backward compatibility.
type VoiceGenerateJSONResponse struct {
	AudioData string `json:"audioData"`
	Format    string `json:"format"`
}

// TranscribeResponse represents the output of speech-to-text.
type TranscribeResponse struct {
	Text string `json:"text"`
}

// TTSProvider defines the interface for text-to-speech engines.
type TTSProvider interface {
	Name() string
	GenerateTTS(ctx context.Context, text string, voiceName string) (*VoiceGenerateResult, error)
}

// STTProvider defines the interface for speech-to-text engines.
type STTProvider interface {
	Name() string
	TranscribeAudio(ctx context.Context, audioData []byte, mimeType string) (string, error)
}

// SpeechService coordinates TTS and STT operations across providers with circuit breakers.
type SpeechService interface {
	GenerateVoice(ctx context.Context, req VoiceGenerateRequest) (*VoiceGenerateResult, error)
	Transcribe(ctx context.Context, audioData []byte, mimeType string) (*TranscribeResponse, error)
	GetProviderStatus() map[string]interface{}
}
