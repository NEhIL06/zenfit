package gemini

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/zenletics/speech-service/internal/audio"
	"github.com/zenletics/speech-service/internal/domain"
)

var (
	ErrGeminiNotConfigured = errors.New("gemini api key is not configured")
	ErrEmptyGeminiResponse = errors.New("gemini returned an empty candidate response")
)

type Client struct {
	apiKey     string
	ttsModel   string
	sttModel   string
	httpClient *http.Client
}

func New(apiKey, ttsModel, sttModel string, timeout time.Duration) *Client {
	if ttsModel == "" {
		ttsModel = "gemini-2.5-flash-preview-tts"
	}
	if sttModel == "" {
		sttModel = "gemini-3.8-flash"
	}
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	return &Client{
		apiKey:   apiKey,
		ttsModel: ttsModel,
		sttModel: sttModel,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *Client) Name() string {
	return "gemini"
}

func (c *Client) IsConfigured() bool {
	return strings.TrimSpace(c.apiKey) != ""
}

// Gemini TTS API Payload structures
type ttsContentPart struct {
	Text string `json:"text"`
}

type ttsContent struct {
	Parts []ttsContentPart `json:"parts"`
}

type prebuiltVoiceConfig struct {
	VoiceName string `json:"voiceName"`
}

type voiceConfig struct {
	PrebuiltVoiceConfig prebuiltVoiceConfig `json:"prebuiltVoiceConfig"`
}

type speechConfig struct {
	VoiceConfig voiceConfig `json:"voiceConfig"`
}

type generationConfig struct {
	ResponseModalities []string     `json:"responseModalities"`
	SpeechConfig       speechConfig `json:"speechConfig"`
}

type geminiTTSRequest struct {
	Contents         []ttsContent     `json:"contents"`
	GenerationConfig generationConfig `json:"generationConfig"`
}

type inlineDataResponse struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"` // Base64 encoded PCM bytes
}

type responsePart struct {
	Text               string              `json:"text,omitempty"`
	InlineData         *inlineDataResponse `json:"inlineData,omitempty"`
	AudioTranscription *struct {
		Text string `json:"text"`
	} `json:"audioTranscription,omitempty"`
}

type responseCandidateContent struct {
	Parts []responsePart `json:"parts"`
}

type responseCandidate struct {
	Content responseCandidateContent `json:"content"`
}

type geminiGenerateResponse struct {
	Candidates []responseCandidate `json:"candidates"`
	Error      *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

// GenerateTTS generates raw PCM speech from text and packages it into standard RIFF WAV.
func (c *Client) GenerateTTS(ctx context.Context, text string, voiceName string) (*domain.VoiceGenerateResult, error) {
	if !c.IsConfigured() {
		return nil, ErrGeminiNotConfigured
	}

	if voiceName == "" {
		voiceName = "Puck"
	}

	// Truncate to maximum 1000 characters as in contract
	if len(text) > 1000 {
		text = text[:1000]
	}

	promptText := fmt.Sprintf("Read the following fitness information in an encouraging and motivational tone: %s", text)

	payload := geminiTTSRequest{
		Contents: []ttsContent{
			{
				Parts: []ttsContentPart{
					{Text: promptText},
				},
			},
		},
		GenerationConfig: generationConfig{
			ResponseModalities: []string{"AUDIO"},
			SpeechConfig: speechConfig{
				VoiceConfig: voiceConfig{
					PrebuiltVoiceConfig: prebuiltVoiceConfig{
						VoiceName: voiceName,
					},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal gemini tts request: %w", err)
	}

	endpoint := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", c.ttsModel, c.apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create gemini tts http request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gemini tts request error: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read gemini tts response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini tts failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var geminiResp geminiGenerateResponse
	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal gemini tts response: %w", err)
	}

	if geminiResp.Error != nil {
		return nil, fmt.Errorf("gemini api error [%s]: %s", geminiResp.Error.Status, geminiResp.Error.Message)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, ErrEmptyGeminiResponse
	}

	inlineData := geminiResp.Candidates[0].Content.Parts[0].InlineData
	if inlineData == nil || inlineData.Data == "" {
		return nil, errors.New("gemini candidate did not contain inline audio data")
	}

	// Decode Base64 PCM data
	pcmBytes, err := base64.StdEncoding.DecodeString(inlineData.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to base64 decode pcm bytes: %w", err)
	}

	// Wrap PCM in standard RIFF WAV (24000Hz, 16-bit, 1 channel)
	wavBytes := audio.PCMToWAV(pcmBytes, 24000, 16, 1)

	return &domain.VoiceGenerateResult{
		AudioBytes: wavBytes,
		Format:     domain.AudioFormatWAV,
		MimeType:   "audio/wav",
		Provider:   c.Name(),
	}, nil
}

// STT Structures
type sttPart struct {
	Text       string              `json:"text,omitempty"`
	InlineData *sttInlineMediaData `json:"inlineData,omitempty"`
}

type sttInlineMediaData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"` // Base64 encoded audio
}

type sttContent struct {
	Parts []sttPart `json:"parts"`
}

type geminiSTTRequest struct {
	Contents []sttContent `json:"contents"`
}

// TranscribeAudio transcribes uploaded audio via Gemini multimodal model.
func (c *Client) TranscribeAudio(ctx context.Context, audioData []byte, mimeType string) (string, error) {
	if !c.IsConfigured() {
		return "", ErrGeminiNotConfigured
	}

	if mimeType == "" {
		mimeType = "audio/wav"
	}

	base64Audio := base64.StdEncoding.EncodeToString(audioData)

	payload := geminiSTTRequest{
		Contents: []sttContent{
			{
				Parts: []sttPart{
					{
						Text: "Transcribe this audio file exactly as spoken. Do not add any commentary or extra text.",
					},
					{
						InlineData: &sttInlineMediaData{
							MimeType: mimeType,
							Data:     base64Audio,
						},
					},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal gemini stt request: %w", err)
	}

	modelsToTry := []string{c.sttModel}
	for _, m := range []string{"gemini-3.8-flash", "gemini-3.5-transcribe"} {
		if m != c.sttModel {
			modelsToTry = append(modelsToTry, m)
		}
	}

	var lastErr error
	for _, model := range modelsToTry {
		endpoint := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, c.apiKey)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
		if err != nil {
			return "", fmt.Errorf("failed to create gemini stt request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("gemini stt request error with model %s: %w", model, err)
			continue
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("failed to read gemini stt response body: %w", err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("gemini stt model %s failed with status %d: %s", model, resp.StatusCode, string(respBody))
			// If 404 model not found, try next model
			if resp.StatusCode == http.StatusNotFound {
				continue
			}
			return "", lastErr
		}

		var geminiResp geminiGenerateResponse
		if err := json.Unmarshal(respBody, &geminiResp); err != nil {
			return "", fmt.Errorf("failed to unmarshal gemini stt response: %w", err)
		}

		if geminiResp.Error != nil {
			return "", fmt.Errorf("gemini stt api error: %s", geminiResp.Error.Message)
		}

		if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
			return "", ErrEmptyGeminiResponse
		}

		part := geminiResp.Candidates[0].Content.Parts[0]
		if part.AudioTranscription != nil && part.AudioTranscription.Text != "" {
			return strings.TrimSpace(part.AudioTranscription.Text), nil
		}
		if part.Text != "" {
			return strings.TrimSpace(part.Text), nil
		}
		return "", errors.New("gemini stt response contained no transcribed text")
	}

	return "", fmt.Errorf("all gemini stt model attempts failed: %w", lastErr)
}
