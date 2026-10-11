package audio

import (
	"bytes"
	"encoding/binary"
	"sync"
)

const (
	DefaultSampleRate    = 24000
	DefaultBitsPerSample = 16
	DefaultNumChannels   = 1
	WavHeaderSize        = 44
)

// bufferPool reuses byte buffers to achieve zero/minimal heap allocation under high concurrency.
var bufferPool = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	},
}

// PCMToWAV wraps raw linear PCM audio into a standard RIFF/WAVE container.
// Gemini TTS outputs 24kHz, 16-bit mono PCM.
func PCMToWAV(pcmData []byte, sampleRate uint32, bitsPerSample uint16, numChannels uint16) []byte {
	if sampleRate == 0 {
		sampleRate = DefaultSampleRate
	}
	if bitsPerSample == 0 {
		bitsPerSample = DefaultBitsPerSample
	}
	if numChannels == 0 {
		numChannels = DefaultNumChannels
	}

	dataSize := uint32(len(pcmData))
	byteRate := sampleRate * uint32(numChannels) * uint32(bitsPerSample) / 8
	blockAlign := numChannels * bitsPerSample / 8

	buf := bufferPool.Get().(*bytes.Buffer)
	buf.Reset()
	buf.Grow(WavHeaderSize + len(pcmData))
	defer bufferPool.Put(buf)

	// 1. RIFF Chunk Descriptor
	buf.WriteString("RIFF")
	_ = binary.Write(buf, binary.LittleEndian, uint32(36+dataSize))
	buf.WriteString("WAVE")

	// 2. fmt Sub-chunk
	buf.WriteString("fmt ")
	_ = binary.Write(buf, binary.LittleEndian, uint32(16))               // Subchunk1Size (16 for PCM)
	_ = binary.Write(buf, binary.LittleEndian, uint16(1))                // AudioFormat (1 for PCM)
	_ = binary.Write(buf, binary.LittleEndian, numChannels)              // NumChannels
	_ = binary.Write(buf, binary.LittleEndian, sampleRate)               // SampleRate
	_ = binary.Write(buf, binary.LittleEndian, byteRate)                 // ByteRate
	_ = binary.Write(buf, binary.LittleEndian, blockAlign)               // BlockAlign
	_ = binary.Write(buf, binary.LittleEndian, bitsPerSample)            // BitsPerSample

	// 3. data Sub-chunk
	buf.WriteString("data")
	_ = binary.Write(buf, binary.LittleEndian, dataSize)

	// Append raw PCM data
	buf.Write(pcmData)

	// Return a copy of the synthesized bytes
	out := make([]byte, buf.Len())
	copy(out, buf.Bytes())
	return out
}
