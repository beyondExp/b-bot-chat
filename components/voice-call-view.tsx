"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from "next/image"
import { SimpleVAD } from '@/lib/simple-vad'

interface VoiceCallViewProps {
  agentName: string
  agentAvatar: string
  onEndCall: () => void
  onAudioData: (audioBuffer: Float32Array, timestamp: number) => void
  messages?: any[] // Show text messages below call UI
}

export function VoiceCallView({
  agentName,
  agentAvatar,
  onEndCall,
  onAudioData,
  messages = []
}: VoiceCallViewProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isCalling, setIsCalling] = useState(true) // "Calling..." state
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [vadStatus, setVadStatus] = useState('Calling...')
  const [callDuration, setCallDuration] = useState(0)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blobPathRef = useRef<SVGPathElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const vadRef = useRef<SimpleVAD | null>(null)
  const thinkingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const callStartTimeRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const CALLING_DURATION = 2000 // Show "Calling..." for 2 seconds

  // Format call duration (MM:SS)
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Update call duration every second
  useEffect(() => {
    if (!isConnected) return
    
    callStartTimeRef.current = Date.now()
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      setCallDuration(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [isConnected])

  // Compute RMS (Root Mean Square) for amplitude
  const computeRMS = (dataArray: Uint8Array): number => {
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128
      sum += normalized * normalized
    }
    return Math.sqrt(sum / dataArray.length)
  }

  // Animate waveform visualization
  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = analyserRef.current
    const bufferLength = analyser.fftSize
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteTimeDomainData(dataArray)
    
    const amplitude = computeRMS(dataArray)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw waveform
    ctx.beginPath()
    const sliceWidth = canvas.width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const y = (dataArray[i] / 255) * canvas.height
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
      x += sliceWidth
    }

    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.strokeStyle = `hsl(${260 + amplitude * 100}, 70%, 60%)`
    ctx.lineWidth = 2
    ctx.stroke()

    // Animate blob path
    if (blobPathRef.current) {
      const offset = amplitude * 60
      const path = `M0 200 Q150 ${60 + offset} 300 200 T600 200 L600 400 L0 400 Z`
      blobPathRef.current.setAttribute('d', path)
    }

    rafRef.current = requestAnimationFrame(drawVisualizer)
  }

  // Resize canvas to match display size
  const resizeCanvas = () => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = canvas.clientWidth * window.devicePixelRatio
    canvas.height = canvas.clientHeight * window.devicePixelRatio
  }

  // Load VAD scripts dynamically if not already loaded
  const loadVADScripts = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if ((window as any).vad?.MicVAD) {
        console.log('[VoiceCall] VAD already loaded')
        resolve()
        return
      }

      console.log('[VoiceCall] Loading VAD scripts dynamically...')

      // Load ONNX Runtime first
      const onnxScript = document.createElement('script')
      onnxScript.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.js'
      onnxScript.async = true
      
      onnxScript.onload = () => {
        console.log('[VoiceCall] ONNX Runtime loaded')
        
        // Then load VAD
        const vadScript = document.createElement('script')
        vadScript.src = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/bundle.min.js'
        vadScript.async = true
        
        vadScript.onload = () => {
          console.log('[VoiceCall] VAD script loaded')
          resolve()
        }
        
        vadScript.onerror = () => {
          console.error('[VoiceCall] Failed to load VAD script')
          reject(new Error('Failed to load VAD script'))
        }
        
        document.head.appendChild(vadScript)
      }
      
      onnxScript.onerror = () => {
        console.error('[VoiceCall] Failed to load ONNX Runtime')
        reject(new Error('Failed to load ONNX Runtime'))
      }
      
      document.head.appendChild(onnxScript)
    })
  }

  // Wait for VAD library to load
  const waitForVAD = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      let attempts = 0
      const maxAttempts = 50 // 5 seconds (100ms * 50)
      
      const checkVAD = () => {
        attempts++
        
        // Check if VAD is available
        if ((window as any).vad?.MicVAD) {
          console.log('[VoiceCall] VAD library ready')
          resolve((window as any).vad.MicVAD)
          return
        }
        
        // Check if we've exceeded max attempts
        if (attempts >= maxAttempts) {
          console.error('[VoiceCall] VAD library not available after', attempts, 'attempts')
          reject(new Error('VAD library not available'))
          return
        }
        
        // Try again
        setTimeout(checkVAD, 100)
      }
      
      checkVAD()
    })
  }

  // Initialize microphone with SimpleVAD
  const startCall = async () => {
    try {
      setIsCalling(true)
      setVadStatus('Calling...')
      
      // Play calling sound (simulated with beep pattern)
      playCallingSound()
      
      // Simulate "calling" phase (like phone ringing)
      await new Promise(resolve => setTimeout(resolve, CALLING_DURATION))
      
      setVadStatus('Connecting...')

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      
      setIsCalling(false)

      // Setup Web Audio API for visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Resize and start visualizer
      resizeCanvas()
      drawVisualizer()

      // Initialize SimpleVAD
      setVadStatus('Initializing voice detection...')
      
      const vad = new SimpleVAD(stream, {
        onSpeechStart: () => {
          console.log('[VoiceCall] Speech started')
          setIsSpeaking(true)
          setVadStatus('Listening...')
        },
        onSpeechEnd: (audioData: Float32Array) => {
          console.log('[VoiceCall] Speech ended, sending audio...')
          setIsSpeaking(false)
          setVadStatus('Processing...')
          
          // Send audio data to parent
          onAudioData(audioData, Date.now())
          
          setTimeout(() => {
            setVadStatus('Ready - Speak naturally')
          }, 500)
        },
        onVADMisfire: () => {
          console.log('[VoiceCall] VAD misfire (speech too short)')
          setIsSpeaking(false)
        },
        energyThreshold: 0.01, // Adjust sensitivity (lower = more sensitive)
        silenceDuration: 1500, // 1.5s of silence before ending speech
        minSpeechDuration: 300, // Minimum 300ms of speech
        sampleRate: 16000
      })
      
      vad.start()
      vadRef.current = vad

      setIsConnected(true)
      setVadStatus('Ready - Speak naturally')
      console.log('[VoiceCall] Call started with VAD')
    } catch (error) {
      console.error('[VoiceCall] Error starting call:', error)
      setVadStatus('Error: ' + (error as Error).message)
      alert('Failed to start call: ' + (error as Error).message)
    }
  }

  // Cleanup on unmount or end call
  const cleanup = () => {
    // Stop visualizer
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    // Stop VAD
    if (vadRef.current) {
      vadRef.current.destroy()
      vadRef.current = null
    }

    // Clear timers
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current)
      thinkingTimerRef.current = null
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  const handleEndCall = () => {
    cleanup()
    onEndCall()
  }

  const toggleMute = () => {
    if (!mediaStreamRef.current) return
    
    mediaStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = isMuted
    })
    
    setIsMuted(!isMuted)
  }

  // Start call on mount
  useEffect(() => {
    startCall()
    
    // Cleanup on unmount
    return cleanup
  }, [])

  // Handle window resize
  useEffect(() => {
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  // Play calling sound (simulate phone ringing)
  const playCallingSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 480 // Hz (phone ring tone)
      gainNode.gain.value = 0.1
      
      oscillator.start()
      
      // Ring pattern: on for 1s, off for 0.5s
      setTimeout(() => {
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
        oscillator.stop(audioContext.currentTime + 0.5)
      }, 1000)
    } catch (error) {
      console.error('[VoiceCall] Error playing calling sound:', error)
    }
  }

  // Extract text content from message
  const getMessageText = (content: any): string => {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      const textBlocks = content.filter((block: any) => block.type === 'text')
      return textBlocks.map((block: any) => block.text).join(' ')
    }
    return ''
  }

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900">
      {/* Call UI - Fixed at top */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center py-8">
        {/* Agent Info */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <div className={cn(
              "w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200 transition-all duration-300 shadow-lg",
              isSpeaking && "ring-4 ring-primary/50 animate-pulse",
              isCalling && "animate-pulse"
            )}>
              <Image
                src={agentAvatar}
                alt={agentName}
                fill
                className="object-cover"
              />
            </div>
            {isSpeaking && !isCalling && (
              <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping" />
            )}
            {isCalling && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.75s' }} />
              </>
            )}
          </div>
          <h2 className="text-2xl font-semibold mb-1 text-gray-900">{agentName}</h2>
          <p className={cn(
            "text-sm transition-all duration-300",
            isCalling ? "text-blue-600 animate-pulse font-medium" : "text-gray-600"
          )}>
            {vadStatus}
          </p>
          {isConnected && !isCalling && (
            <p className="text-xs text-gray-500 mt-1">{formatDuration(callDuration)}</p>
          )}
        </div>

        {/* Waveform Visualization */}
        {!isCalling && (
          <div className="w-full max-w-2xl px-8 mb-6">
            <div className="relative bg-gray-50 rounded-2xl p-4 border border-gray-200 shadow-sm">
              <svg 
                className="absolute left-1/4 top-0 w-1/2 h-full pointer-events-none opacity-5"
                viewBox="0 0 600 400" 
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="grad1" x1="0" x2="1">
                    <stop offset="0%" stopColor="rgba(100,100,200,0.2)" />
                    <stop offset="100%" stopColor="rgba(100,100,200,0.05)" />
                  </linearGradient>
                </defs>
                <path 
                  ref={blobPathRef}
                  d="M0 200 Q150 60 300 200 T600 200 L600 400 L0 400 Z" 
                  fill="url(#grad1)"
                />
              </svg>
              <canvas
                ref={canvasRef}
                className="w-full h-32 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Call Controls */}
        <div className="flex items-center gap-6 mb-4">
          <Button
            variant="outline"
            size="icon"
            className="w-14 h-14 rounded-full border-gray-300 hover:bg-gray-100 shadow-md"
            onClick={toggleMute}
            disabled={isCalling}
          >
            {isMuted ? <MicOff className="w-6 h-6 text-gray-700" /> : <Mic className="w-6 h-6 text-gray-700" />}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="w-16 h-16 rounded-full shadow-lg"
            onClick={handleEndCall}
          >
            <PhoneOff className="w-7 h-7" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="w-14 h-14 rounded-full border-gray-300 hover:bg-gray-100 opacity-50 shadow-md"
            disabled
          >
            <Volume2 className="w-6 h-6 text-gray-700" />
          </Button>
        </div>

        {/* Status Indicator */}
        {!isCalling && (
          <div className="text-center">
            <p className="text-xs text-gray-600">
              {isSpeaking ? '🎤 Listening to you...' : '🤖 Agent is ready'}
            </p>
          </div>
        )}
      </div>

      {/* Messages Display - Scrollable */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 bg-gray-50">
          <div className="max-w-2xl mx-auto space-y-4 pt-4">
            <div className="text-center mb-4">
              <div className="inline-block px-3 py-1 rounded-full bg-gray-200 text-xs text-gray-600 font-medium">
                Conversation Transcript
              </div>
            </div>
            {messages.map((msg, idx) => {
              const text = getMessageText(msg.content)
              if (!text) return null
              
              return (
                <div
                  key={msg.id || idx}
                  className={cn(
                    "flex",
                    msg.role === 'user' || msg.type === 'human' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] px-4 py-2 rounded-2xl shadow-sm",
                      msg.role === 'user' || msg.type === 'human'
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-white text-gray-900 rounded-bl-sm border border-gray-200"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

