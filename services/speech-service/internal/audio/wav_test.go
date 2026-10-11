package audio

import (
	"bytes"
	"encoding/binary"
	"testing"
)

func TestPCMToWAV(t *testing.T) {
	// 100 bytes of dummy PCM
	pcm := make([]byte, 100)
	for i := range pcm {
		pcm[i] = byte(i % 256)
	}

	wav := PCMToWAV(pcm, 24000, 16, 1)

	if len(wav) != WavHeaderSize+len(pcm) {
		t.Fatalf("expected length %d, got %d", WavHeaderSize+len(pcm), len(wav))
	}

	// Verify RIFF header
	if string(wav[0:4]) != "RIFF" {
		t.Errorf("expected 'RIFF', got %s", string(wav[0:4]))
	}

	var chunkSize uint32
	_ = binary.Read(bytes.NewReader(wav[4:8]), binary.LittleEndian, &chunkSize)
	if chunkSize != uint32(36+len(pcm)) {
		t.Errorf("expected chunk size %d, got %d", 36+len(pcm), chunkSize)
	}

	if string(wav[8:12]) != "WAVE" {
		t.Errorf("expected 'WAVE', got %s", string(wav[8:12]))
	}

	if string(wav[12:16]) != "fmt " {
		t.Errorf("expected 'fmt ', got %s", string(wav[12:16]))
	}

	var sampleRate uint32
	_ = binary.Read(bytes.NewReader(wav[24:28]), binary.LittleEndian, &sampleRate)
	if sampleRate != 24000 {
		t.Errorf("expected sample rate 24000, got %d", sampleRate)
	}

	if string(wav[36:40]) != "data" {
		t.Errorf("expected 'data', got %s", string(wav[36:40]))
	}

	var dataSize uint32
	_ = binary.Read(bytes.NewReader(wav[40:44]), binary.LittleEndian, &dataSize)
	if dataSize != uint32(len(pcm)) {
		t.Errorf("expected data size %d, got %d", len(pcm), dataSize)
	}

	// Verify PCM payload
	if !bytes.Equal(wav[44:], pcm) {
		t.Errorf("wav audio payload does not match source PCM")
	}
}

func BenchmarkPCMToWAV(b *testing.B) {
	pcm := make([]byte, 48000) // 1 second of 24kHz 16-bit mono
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = PCMToWAV(pcm, 24000, 16, 1)
	}
}
