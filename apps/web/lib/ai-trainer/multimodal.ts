/**
 * Multimodal Processor: Handles exercise image generation (Nanobanana Primary, Pollinations Fallback)
 * and vision analysis (Gemini / Mistral)
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage } from '@langchain/core/messages'
import { getMistralClient } from '../mistral'

export class MultimodalProcessor {
  private nanobananaApiKey: string
  private gemini: ChatGoogleGenerativeAI
  private pollinationsModel: string

  constructor() {
    this.gemini = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      model: 'gemini-2.0-flash-exp',
    })

    this.nanobananaApiKey = process.env.NANOBANANA_API_KEY || ''
    this.pollinationsModel = process.env.POLLINATIONS_IMAGE_MODEL || 'flux'
  }

  /** Strip data URI prefix from base64 string */
  private stripDataUriPrefix(base64String: string): string {
    if (base64String.includes(';base64,')) {
      return base64String.split(';base64,')[1]
    }
    return base64String
  }

  /** Build fallback Pollinations Image URL */
  private buildPollinationsFallbackUrl(exerciseName: string): string {
    const prompt = `Realistic professional fitness demonstration photo of ${exerciseName}, proper posture, gym setting, high quality`
    const encoded = encodeURIComponent(prompt)
    let hash = 0
    for (let i = 0; i < exerciseName.length; i++) {
      hash = (hash * 31 + exerciseName.charCodeAt(i)) >>> 0
    }
    const seed = hash % 1_000_000
    return `https://gen.pollinations.ai/image/${encoded}?model=${this.pollinationsModel}&seed=${seed}&width=512&height=512&nologo=true`
  }

  /**
   * Generate exercise demonstration image.
   * Uses Nanobanana as PRIMARY engine; automatically falls back to Pollinations if Nanobanana is unconfigured or fails.
   */
  async generateExerciseImage(
    exerciseName: string,
    instructions?: string
  ): Promise<string> {
    console.log('[Multimodal] Attempting exercise image generation:', exerciseName)

    // 1. Primary Engine: Nanobanana API
    if (this.nanobananaApiKey) {
      try {
        console.log('[Multimodal] Calling primary engine: Nanobanana API')
        const prompt = `Professional fitness illustration of ${exerciseName}.
Requirements:
- Clear form and technique demonstration
- Anatomically correct positioning
${instructions ? `- ${instructions}` : ''}
Style: Clean, educational, professional gym setting with proper lighting`

        const response = await fetch('https://api.nanobanana.ai/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.nanobananaApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            width: 1024,
            height: 1024,
            num_inference_steps: 30,
            guidance_scale: 7.5,
          }),
          signal: AbortSignal.timeout(10000), // 10s timeout
        })

        if (response.ok) {
          const data = await response.json()
          const imageUrl = data.images?.[0]?.url
          if (imageUrl) {
            console.log('[Multimodal] Nanobanana primary generation succeeded:', imageUrl)
            return imageUrl
          }
        } else {
          const errorText = await response.text()
          console.warn('[Multimodal] Nanobanana API error response:', response.status, errorText)
        }
      } catch (err: any) {
        console.warn('[Multimodal] Nanobanana API failed, triggering fallback:', err?.message)
      }
    } else {
      console.log('[Multimodal] Nanobanana API key unconfigured. Falling back to Pollinations.')
    }

    // 2. Fallback Engine: Pollinations API
    console.log('[Multimodal] Utilizing fallback engine: Pollinations AI')
    const fallbackUrl = this.buildPollinationsFallbackUrl(exerciseName)
    return fallbackUrl
  }

  /** Analyze exercise form from image */
  async analyzeExerciseForm(imageBase64: string): Promise<string> {
    try {
      console.log('[Multimodal] Analyzing exercise form')
      const cleanBase64 = this.stripDataUriPrefix(imageBase64)
      const mistral = getMistralClient()

      const message = new HumanMessage({
        content: [
          {
            type: 'text',
            text: `As a professional fitness trainer, analyze this exercise form image and provide detailed feedback:
1. **What they're doing well**: Identify correct form elements
2. **Areas for improvement**: Point out technique issues
3. **Safety concerns**: Highlight any potential injury risks
4. **Specific corrections**: Give actionable advice to improve form`,
          },
          {
            type: 'image_url',
            image_url: `data:image/jpeg;base64,${cleanBase64}`,
          },
        ],
      })

      // Use Gemini Vision as primary vision model
      const response = await this.gemini.invoke([message])
      console.log('[Multimodal] Form analysis complete')
      return response.content as string
    } catch (error) {
      console.error('[Multimodal] Error analyzing exercise form:', error)
      throw error
    }
  }

  /** Transcribe audio */
  async transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    try {
      console.log('[Multimodal] Transcribing audio with Gemini')
      const cleanBase64 = this.stripDataUriPrefix(audioBase64)

      const message = new HumanMessage({
        content: [
          {
            type: 'text',
            text: 'Transcribe this audio file exactly as spoken. Do not add any commentary or extra text.',
          },
          {
            type: 'media',
            mimeType: mimeType || 'audio/wav',
            data: cleanBase64,
          } as any,
        ],
      })

      const response = await this.gemini.invoke([message])
      return response.content as string
    } catch (error) {
      console.error('[Multimodal] Error transcribing audio:', error)
      throw error
    }
  }

  /** Extract text description from image */
  async describeImage(imageBase64: string): Promise<string> {
    try {
      console.log('[Multimodal] Describing image with Gemini Vision')
      const cleanBase64 = this.stripDataUriPrefix(imageBase64)

      const message = new HumanMessage({
        content: [
          {
            type: 'text',
            text: 'Describe what you see in this image in detail, focusing on any fitness-related elements.',
          },
          {
            type: 'image_url',
            image_url: `data:image/jpeg;base64,${cleanBase64}`,
          },
        ],
      })

      const response = await this.gemini.invoke([message])
      return response.content as string
    } catch (error) {
      console.error('[Multimodal] Error describing image:', error)
      throw error
    }
  }

  /** Check if query implies image generation */
  shouldGenerateImage(query: string): boolean {
    const triggers = [
      'show me',
      'demonstrate',
      'how to do',
      'proper form for',
      'exercise form',
      'correct technique',
      'visual',
      'picture',
      'image',
      'illustration',
    ]

    const queryLower = query.toLowerCase()
    return triggers.some((trigger) => queryLower.includes(trigger))
  }

  /** Extract exercise name from query */
  extractExerciseName(query: string): string {
    const patterns = [
      /(?:show me|demonstrate|how to do)\s+(?:a |the |an )?(.+?)(?:\?|$)/i,
      /(?:proper form for|correct technique for)\s+(.+?)(?:\?|$)/i,
      /(?:exercise form for)\s+(.+?)(?:\?|$)/i,
    ]

    for (const pattern of patterns) {
      const match = query.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    const words = query.split(' ').filter((w) => w.length > 0)
    return words.slice(-3).join(' ')
  }
}

// Singleton instance
let multimodalProcessor: MultimodalProcessor | null = null

export function getMultimodalProcessor(): MultimodalProcessor {
  if (!multimodalProcessor) {
    multimodalProcessor = new MultimodalProcessor()
  }
  return multimodalProcessor
}
