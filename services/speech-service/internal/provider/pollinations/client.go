package pollinations

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/zenletics/speech-service/internal/domain"
)

var geminiToPollinationsVoice = map[string]string{
	"Puck":   "nova",
	"Charon": "echo",
	"Kore":   "shimmer",
	"Fenrir": "onyx",
	"Aoede":  "coral",
}

type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

func New(apiKey, baseURL string, timeout time.Duration) *Client {
	if baseURL == "" {
		baseURL = "https://gen.pollinations.ai/audio"
	}
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	return &Client{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *Client) Name() string {
	return "pollinations"
}

// GenerateTTS calls the Pollinations audio endpoint and returns raw MP3 bytes.
func (c *Client) GenerateTTS(ctx context.Context, text string, geminiVoiceName string) (*domain.VoiceGenerateResult, error) {
	voice := geminiToPollinationsVoice[geminiVoiceName]
	if voice == "" {
		voice = "nova"
	}

	// Truncate to maximum 800 characters
	if len(text) > 800 {
		text = text[:800]
	}

	encodedText := url.PathEscape(text)
	reqURL := fmt.Sprintf("%s/%s?voice=%s&model=elevenlabs", c.baseURL, encodedText, voice)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create pollinations tts request: %w", err)
	}

	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pollinations tts request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pollinations tts failed with status %d: %s", resp.StatusCode, string(body))
	}

	audioBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read pollinations audio response: %w", err)
	}

	if len(audioBytes) == 0 {
		return nil, fmt.Errorf("pollinations tts returned empty audio response")
	}

	return &domain.VoiceGenerateResult{
		AudioBytes: audioBytes,
		Format:     domain.AudioFormatMP3,
		MimeType:   "audio/mpeg",
		Provider:   c.Name(),
	}, nil
}
