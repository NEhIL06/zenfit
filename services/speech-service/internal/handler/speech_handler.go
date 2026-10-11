package handler

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/zenletics/speech-service/internal/audio"
	"github.com/zenletics/speech-service/internal/domain"
)

type SpeechHandler struct {
	service       domain.SpeechService
	maxAudioBytes int64
}

func NewSpeechHandler(service domain.SpeechService, maxAudioBytes int64) *SpeechHandler {
	if maxAudioBytes <= 0 {
		maxAudioBytes = 5 * 1024 * 1024 // 5MB
	}
	return &SpeechHandler{
		service:       service,
		maxAudioBytes: maxAudioBytes,
	}
}

// HandleVoiceGenerate handles POST /v1/voice/generate with dual-mode content negotiation.
func (h *SpeechHandler) HandleVoiceGenerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Only POST method is accepted")
		return
	}

	var req domain.VoiceGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "INVALID_REQUEST", fmt.Sprintf("Failed to parse request JSON: %v", err))
		return
	}

	var result *domain.VoiceGenerateResult
	var err error

	if r.Header.Get("X-Benchmark-Mock") == "true" {
		// Mock 1 second of PCM audio for load testing the Go pipeline without external API rate limiting
		dummyPCM := make([]byte, 48000)
		wavBytes := audio.PCMToWAV(dummyPCM, 24000, 16, 1)
		result = &domain.VoiceGenerateResult{
			AudioBytes: wavBytes,
			Format:     domain.AudioFormatWAV,
			MimeType:   "audio/wav",
			Provider:   "benchmark-mock",
		}
	} else {
		result, err = h.service.GenerateVoice(r.Context(), req)
	}
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrEmptyText):
			writeJSONError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Text parameter is required")
		case errors.Is(err, domain.ErrTextTooLong):
			writeJSONError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Text exceeds 1000 characters")
		case errors.Is(err, domain.ErrProviderUnavailable):
			writeJSONError(w, http.StatusServiceUnavailable, "PROVIDER_UNAVAILABLE", "All voice narration providers are currently unavailable")
		default:
			writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", fmt.Sprintf("Failed to generate voice: %v", err))
		}
		return
	}

	// Content Negotiation: check if client explicitly requests JSON payload
	acceptHeader := r.Header.Get("Accept")
	if strings.Contains(acceptHeader, "application/json") {
		// Legacy / backward-compatible JSON mode with Base64 payload
		base64Data := base64.StdEncoding.EncodeToString(result.AudioBytes)
		responsePayload := domain.VoiceGenerateJSONResponse{
			AudioData: base64Data,
			Format:    string(result.Format),
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Audio-Format", string(result.Format))
		w.Header().Set("X-Audio-Provider", result.Provider)
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(responsePayload)
		return
	}

	// High-performance default: Direct raw binary audio stream!
	w.Header().Set("Content-Type", result.MimeType)
	w.Header().Set("Content-Length", strconv.Itoa(len(result.AudioBytes)))
	w.Header().Set("X-Audio-Format", string(result.Format))
	w.Header().Set("X-Audio-Provider", result.Provider)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(result.AudioBytes)
}

// HandleTranscribe handles POST /v1/transcribe with multipart audio uploads.
func (h *SpeechHandler) HandleTranscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Only POST method is accepted")
		return
	}

	// Restrict incoming multipart body to maxAudioBytes + 512KB for headers
	r.Body = http.MaxBytesReader(w, r.Body, h.maxAudioBytes+(512*1024))

	if err := r.ParseMultipartForm(h.maxAudioBytes); err != nil {
		writeJSONError(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "Uploaded audio file exceeds the 5MB size limit")
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "INVALID_REQUEST", "No audio file found in form data (key 'file' required)")
		return
	}
	defer file.Close()

	if fileHeader.Size > h.maxAudioBytes {
		writeJSONError(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "Uploaded audio file exceeds 5MB size limit")
		return
	}

	// Detect or parse MIME type
	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		// Read first 512 bytes for sniffing
		sniffBuf := make([]byte, 512)
		n, _ := file.Read(sniffBuf)
		mimeType = http.DetectContentType(sniffBuf[:n])
		// Rewind file reader
		_, _ = file.Seek(0, io.SeekStart)
	}

	audioBytes, err := io.ReadAll(file)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read audio upload payload")
		return
	}

	res, err := h.service.Transcribe(r.Context(), audioBytes, mimeType)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrEmptyAudio):
			writeJSONError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Audio payload is empty")
		case errors.Is(err, domain.ErrAudioTooLarge):
			writeJSONError(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "Audio file exceeds 5MB size limit")
		case errors.Is(err, domain.ErrUnsupportedAudioType):
			writeJSONError(w, http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", fmt.Sprintf("MIME type '%s' is not supported", mimeType))
		default:
			writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", fmt.Sprintf("Transcription failed: %v", err))
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(res)
}

func writeJSONError(w http.ResponseWriter, statusCode int, errorCode, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   errorCode,
		"message": message,
	})
}
