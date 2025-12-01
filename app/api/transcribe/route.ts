import { NextRequest, NextResponse } from 'next/server'
import { getMultimodalProcessor } from '@/lib/ai-trainer/multimodal'

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
    } catch (error) {
        console.error('Error in transcribe API:', error)
        return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 })
    }
}
