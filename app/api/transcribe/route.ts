import { NextRequest, NextResponse } from 'next/server'
import { getMultimodalProcessor } from '@/lib/ai-trainer/multimodal'

function isQuotaError(e: any): boolean {
    const msg = `${e?.message || ""} ${e?.status || ""} ${JSON.stringify(e || {})}`.toLowerCase()
    return (
        e?.status === 429 ||
        msg.includes("429") ||
        msg.includes("quota") ||
        msg.includes("rate limit") ||
        msg.includes("resource_exhausted") ||
        msg.includes("too many requests")
    )
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString('base64')
        const mimeType = file.type

        const processor = getMultimodalProcessor()
        const text = await processor.transcribeAudio(base64, mimeType)

        return NextResponse.json({ text })
    } catch (error: any) {
        console.error('Error in transcribe API:', error)
        if (isQuotaError(error)) {
            return NextResponse.json(
                {
                    error: "QUOTA_EXCEEDED",
                    message: "Audio transcription API quota or rate limit exceeded. Please try again later.",
                },
                { status: 429 }
            )
        }
        return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 })
    }
}
