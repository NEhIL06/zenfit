/**
 * Multimodal Processor: Handles image generation (Nanobanana) and vision analysis (Gemini)
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage } from '@langchain/core/messages'

export class MultimodalProcessor {
    private gemini: ChatGoogleGenerativeAI
    private nanobananaApiKey: string

    constructor() {
        this.gemini = new ChatGoogleGenerativeAI({
            modelName: 'gemini-2.5-flash',
            apiKey: process.env.GEMINI_API_KEY!,
        })

        this.nanobananaApiKey = process.env.NANOBANANA_API_KEY || ''

        if (!this.nanobananaApiKey) {
            console.warn('[Multimodal] Nanobanana API key not configured')
        }
    }

    /** Strip data URI prefix from base64 string */
    private stripDataUriPrefix(base64String: string): string {
        // Check if string contains data URI prefix
        if (base64String.includes(';base64,')) {
            return base64String.split(';base64,')[1]
        }
        // If no prefix, return as is
        return base64String
    }

    /** Generate exercise demonstration image */
    async generateExerciseImage(
        exerciseName: string,
        instructions?: string
    ): Promise<string> {
        try {
            if (!this.nanobananaApiKey) {
                throw new Error('Nanobanana API key not configured')
            }

            const prompt = `Professional fitness illustration of ${exerciseName}.
                Requirements:
                - Clear form and technique demonstration
                - Anatomically correct positioning
                - Step-by-step visual if applicable
                ${instructions ? `- ${instructions}` : ''}
                Style: Clean, educational, professional gym setting with proper lighting`

            console.log('[Multimodal] Generating exercise image:', exerciseName)

            // Call Nanobanana API
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
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(`Nanobanana API error: ${error}`)
            }

            const data = await response.json()
            const imageUrl = data.images?.[0]?.url

            if (!imageUrl) {
                throw new Error('No image URL returned from Nanobanana')
            }

            console.log('[Multimodal] Image generated successfully')
            return imageUrl
        } catch (error) {
            console.error('[Multimodal] Error generating exercise image:', error)
            throw error
        }
    }

    /** Analyze exercise form from image */
    async analyzeExerciseForm(imageBase64: string): Promise<string> {
        try {
            console.log('[Multimodal] Analyzing exercise form with Gemini Vision')

            // Strip data URI prefix if present
            const cleanBase64 = this.stripDataUriPrefix(imageBase64)

            const message = new HumanMessage({
                content: [
                    {
                        type: 'text',
                        text: `As a professional fitness trainer, analyze this exercise form image and provide detailed feedback:

1. **What they're doing well**: Identify correct form elements
2. **Areas for improvement**: Point out technique issues
3. **Safety concerns**: Highlight any potential injury risks
4. **Specific corrections**: Give actionable advice to improve form

Be encouraging but honest. Focus on biomechanics and proper muscle activation.`,
                    },
                    {
                        type: 'image_url',
                        image_url: `data:image/jpeg;base64,${cleanBase64}`,
                    },
                ],
            })

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

            // Strip data URI prefix if present
            const cleanBase64 = this.stripDataUriPrefix(audioBase64)

            const message = new HumanMessage({
                content: [
                    {
                        type: 'text',
                        text: 'Transcribe this audio file exactly as spoken. Do not add any commentary or extra text.',
                    },
                    {
                        type: 'media',
                        mimeType: mimeType,
                        data: cleanBase64,
                    } as any, // Cast to any because LangChain types might be slightly behind for generic media
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

            // Strip data URI prefix if present
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
        // Simple extraction - could be enhanced with NLP
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

        //Fallback: return last 3 words
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
