import type { NextRequest } from "next/server"

// Allow longer execution for audio generation
export const maxDuration = 60

interface TTSRequest {
  text: string
  model?: string
  voice?: string
  speed?: number
}

/**
 * POST /api/audio/tts
 * Generates speech audio from text using TTS models
 */
export async function POST(req: NextRequest) {
  try {
    const body: TTSRequest = await req.json()
    const { 
      text, 
      model = 'openai/tts-1', 
      voice = 'alloy',
      speed = 1.0 
    } = body

    if (!text || text.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[TTS] Generating audio:', {
      textLength: text.length,
      model,
      voice,
      speed
    })

    let audioBuffer: Buffer

    if (model.startsWith('elevenlabs/')) {
      // Use ElevenLabs API
      audioBuffer = await generateWithElevenLabs(text, model, voice, speed)
    } else {
      // Use OpenAI TTS API (default)
      audioBuffer = await generateWithOpenAI(text, model, voice, speed)
    }

    // Return audio as a stream
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })

  } catch (error) {
    console.error('[TTS] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'TTS generation failed', 
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Generate audio using OpenAI TTS API
 */
async function generateWithOpenAI(
  text: string,
  model: string,
  voice: string,
  speed: number
): Promise<Buffer> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  // Extract model name (remove provider prefix)
  const modelName = model.replace('openai/', '')

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      input: text,
      voice: voice,
      speed: speed,
      response_format: 'mp3'
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[TTS] OpenAI API error:', errorText)
    throw new Error(`OpenAI TTS failed: ${response.status} - ${errorText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Generate audio using ElevenLabs API
 */
async function generateWithElevenLabs(
  text: string,
  model: string,
  voiceId: string,
  speed: number
): Promise<Buffer> {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured')
  }

  // Extract model name (remove provider prefix)
  const modelName = model.replace('elevenlabs/', '')

  // Default voice if not specified
  const voice = voiceId || '21m00Tcm4TlvDq8ikWAM' // Rachel voice

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: modelName,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: speed
        }
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[TTS] ElevenLabs API error:', errorText)
    throw new Error(`ElevenLabs TTS failed: ${response.status} - ${errorText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

