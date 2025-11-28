import type { NextRequest } from "next/server"

// Allow longer execution for audio processing
export const maxDuration = 60

/**
 * POST /api/audio/transcribe
 * Transcribes audio to text using OpenAI Whisper or Groq Whisper
 */
export async function POST(req: NextRequest) {
  try {
    // Get the audio file from form data
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const modelName = formData.get('model') as string || 'openai/whisper-1'

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[Transcribe] Received audio file:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
      model: modelName
    })

    // Convert File to Buffer for API transmission
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Determine which API to use based on model
    let transcriptionText = ''

    if (modelName.startsWith('groq/')) {
      // Use Groq Whisper API
      transcriptionText = await transcribeWithGroq(buffer, audioFile.name, audioFile.type)
    } else {
      // Use OpenAI Whisper API (default)
      transcriptionText = await transcribeWithOpenAI(buffer, audioFile.name, audioFile.type)
    }

    return new Response(
      JSON.stringify({ 
        text: transcriptionText,
        model: modelName,
        duration: 0 // Could be calculated if needed
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[Transcribe] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Transcription failed', 
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
async function transcribeWithOpenAI(
  buffer: Buffer, 
  filename: string, 
  mimeType: string
): Promise<string> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  // Create form data for OpenAI API
  const formData = new FormData()
  const blob = new Blob([buffer], { type: mimeType })
  formData.append('file', blob, filename)
  formData.append('model', 'whisper-1')
  formData.append('language', 'en') // Can be made configurable
  formData.append('response_format', 'json')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Transcribe] OpenAI API error:', errorText)
    throw new Error(`OpenAI transcription failed: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.text || ''
}

/**
 * Transcribe audio using Groq Whisper API
 */
async function transcribeWithGroq(
  buffer: Buffer, 
  filename: string, 
  mimeType: string
): Promise<string> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY

  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured')
  }

  // Create form data for Groq API
  const formData = new FormData()
  const blob = new Blob([buffer], { type: mimeType })
  formData.append('file', blob, filename)
  formData.append('model', 'whisper-large-v3')
  formData.append('language', 'en')
  formData.append('response_format', 'json')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: formData
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Transcribe] Groq API error:', errorText)
    throw new Error(`Groq transcription failed: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.text || ''
}

