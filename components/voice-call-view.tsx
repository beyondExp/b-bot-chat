"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from "next/image"
import { SimpleVAD } from '@/lib/simple-vad'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useI18n } from "@/lib/i18n"

interface VoiceCallViewProps {
  agentName: string
  agentAvatar: string
  onEndCall: () => void
  onAudioData: (audioBuffer: Float32Array, timestamp: number) => void
  onCallConnected?: () => void
  onAudioPlayed?: (messageIds: string[]) => void // Report which message IDs had audio played
  messages?: any[] // Show text messages below call UI
  audioMap?: Record<string, string[]> // TTS audio chunks mapped by message ID
  isLoading?: boolean // Whether agent is processing/streaming
}

export function VoiceCallView({
  agentName,
  agentAvatar,
  onEndCall,
  onAudioData,
  onCallConnected,
  onAudioPlayed,
  messages = [],
  audioMap = {},
  isLoading = false
}: VoiceCallViewProps) {
  const { t } = useI18n()
  const [isConnected, setIsConnected] = useState(false)
  const [isCalling, setIsCalling] = useState(true) // "Calling..." state
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false) // Agent is speaking (TTS playing)
  const [isWaitingForAgent, setIsWaitingForAgent] = useState(false) // Waiting for agent response
  const [vadStatusKey, setVadStatusKey] = useState<string>("call.status.calling")
  const [vadError, setVadError] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [audioAmplitude, setAudioAmplitude] = useState(0) // 0-1 amplitude for blob animation
  const [ttsAutoplayBlocked, setTtsAutoplayBlocked] = useState(false) // Browser blocked audio playback until user gesture
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const vadRef = useRef<SimpleVAD | null>(null)
  const thinkingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const callStartTimeRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // TTS auto-play state
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const playedChunksRef = useRef<Set<string>>(new Set()) // Track which chunks we've played
  const smoothedAmplitudeRef = useRef<number>(0) // For smoothing amplitude changes
  const isSpeakingRef = useRef<boolean>(false) // Ref for RAF loop access
  const isAgentSpeakingRef = useRef<boolean>(false) // Ref for RAF loop access
  const messagesEndRef = useRef<HTMLDivElement>(null) // For auto-scrolling messages
  const currentChunkIndexRef = useRef<number>(0)
  const isPlayingTTSRef = useRef<boolean>(false)
  const audioQueueRef = useRef<string[]>([]) // Queue of audio chunks to play
  const currentTtsUrlRef = useRef<string | null>(null)

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

  // Track the initial audio chunk count to know what existed before call started
  const initialChunkCountRef = useRef<number>(-1) // -1 means not initialized
  const callStartedRef = useRef<boolean>(false)
  
  // On mount: count existing audio chunks and mark them as "already played"
  useEffect(() => {
    // Count all existing chunks on first render
    let totalChunks = 0
    Object.values(audioMap).forEach(chunks => {
      chunks.forEach(chunk => {
        playedChunksRef.current.add(chunk)
        totalChunks++
      })
    })
    initialChunkCountRef.current = totalChunks
    console.log('[VoiceCall] Initial mount - marked', totalChunks, 'existing audio chunks as played')
  }, []) // Only run once on mount
  
  // Also mark any chunks that arrive before call is connected
  useEffect(() => {
    if (!isConnected && initialChunkCountRef.current >= 0) {
      // Call not connected yet, mark any new chunks as already played
      Object.values(audioMap).forEach(chunks => {
        chunks.forEach(chunk => {
          if (!playedChunksRef.current.has(chunk)) {
            playedChunksRef.current.add(chunk)
            console.log('[VoiceCall] Pre-connect: marked chunk as played')
          }
        })
      })
    }
  }, [audioMap, isConnected])
  
  // Mark when call actually starts (connected)
  useEffect(() => {
    if (isConnected && !callStartedRef.current) {
      callStartedRef.current = true
      // Final mark of all existing chunks
      Object.values(audioMap).forEach(chunks => {
        chunks.forEach(chunk => {
          playedChunksRef.current.add(chunk)
        })
      })
      console.log('[VoiceCall] Call connected - total marked chunks:', playedChunksRef.current.size)
    }
  }, [isConnected, audioMap])
  
  // 🔊 Auto-play TTS audio when NEW chunks arrive (only after call is connected)
  useEffect(() => {
    if (!isConnected || !callStartedRef.current) return
    
    // Get all audio chunks from all messages in audioMap
    const newChunks: string[] = []
    const messageIdsWithNewAudio: string[] = []
    
    Object.entries(audioMap).forEach(([messageId, chunks]) => {
      let hasNewChunk = false
      chunks.forEach(chunk => {
        // Only add chunks we haven't seen before
        if (!playedChunksRef.current.has(chunk)) {
          newChunks.push(chunk)
          playedChunksRef.current.add(chunk)
          hasNewChunk = true
        }
      })
      if (hasNewChunk) {
        messageIdsWithNewAudio.push(messageId)
      }
    })
    
    if (newChunks.length > 0) {
      console.log('[VoiceCall] 🔊 New TTS audio chunks:', newChunks.length, 'from messages:', messageIdsWithNewAudio)
      // Add new chunks to queue
      audioQueueRef.current.push(...newChunks)
      
      // Report which message IDs had audio played
      if (onAudioPlayed && messageIdsWithNewAudio.length > 0) {
        onAudioPlayed(messageIdsWithNewAudio)
      }
      
      // Start playing if not already
      if (!isPlayingTTSRef.current) {
        playNextTTSChunk()
      }
    }
  }, [audioMap, isConnected, onAudioPlayed])

  // Play next TTS chunk from queue
  const playNextTTSChunk = async () => {
    if (ttsAutoplayBlocked) {
      // If the browser blocks autoplay, don't stall the call UX.
      // Let the user speak; when they press the volume button we will resume playback.
      if (vadRef.current && isConnected) {
        vadRef.current.start()
      }
      if (isWaitingForAgent) {
        setIsWaitingForAgent(false)
      }
      setIsAgentSpeaking(false)
      setIsWaitingForAgent(false)
      setVadStatusKey("call.status.ready")
      return
    }

    if (audioQueueRef.current.length === 0) {
      console.log('[VoiceCall] 🔊 TTS playback complete, resuming VAD')
      isPlayingTTSRef.current = false
      setIsAgentSpeaking(false)
      setIsWaitingForAgent(false)
      setVadStatusKey("call.status.ready")
      
      // Resume VAD after agent finishes speaking
      if (vadRef.current && isConnected) {
        console.log('[VoiceCall] Resuming VAD after TTS complete')
        vadRef.current.start()
      }
      return
    }

    isPlayingTTSRef.current = true
    setIsAgentSpeaking(true)
    setVadStatusKey("call.status.agentSpeaking")

    // Avoid capturing speech while agent audio is playing.
    if (vadRef.current && isConnected) {
      vadRef.current.pause()
    }

    const chunk = audioQueueRef.current.shift()!
    
    try {
      if (!ttsAudioRef.current) {
        ttsAudioRef.current = new Audio()
        ttsAudioRef.current.muted = false
        ttsAudioRef.current.volume = 1
        ttsAudioRef.current.onended = () => {
          console.log('[VoiceCall] 🔊 TTS chunk finished')
          playNextTTSChunk()
        }
        ttsAudioRef.current.onerror = (e) => {
          console.error('[VoiceCall] TTS playback error:', e)
          playNextTTSChunk() // Skip to next on error
        }
      }

      // Convert base64 to blob and play
      const response = await fetch(`data:audio/mpeg;base64,${chunk}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      if (currentTtsUrlRef.current) URL.revokeObjectURL(currentTtsUrlRef.current)
      currentTtsUrlRef.current = url
      ttsAudioRef.current.src = url
      try {
        await ttsAudioRef.current.play()
        setTtsAutoplayBlocked(false)
      } catch (err: any) {
        // Autoplay policies may block async playback until user gesture.
        if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
          setTtsAutoplayBlocked(true)
          // Put chunk back at the front so the user can resume.
          audioQueueRef.current.unshift(chunk)
          console.warn('[VoiceCall] 🔇 TTS blocked by browser autoplay policy; waiting for user gesture')
          // Don't stall listening entirely while audio is blocked.
          if (vadRef.current && isConnected) {
            vadRef.current.start()
          }
          if (isWaitingForAgent) {
            setIsWaitingForAgent(false)
          }
          setIsAgentSpeaking(false)
          setVadStatusKey("call.status.ready")
          return
        }
        throw err
      }
      console.log('[VoiceCall] 🔊 Playing TTS chunk')
    } catch (error) {
      console.error('[VoiceCall] Error playing TTS chunk:', error)
      playNextTTSChunk() // Skip to next on error
    }
  }

  // Cleanup TTS audio on unmount
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause()
        ttsAudioRef.current = null
      }
      if (currentTtsUrlRef.current) {
        URL.revokeObjectURL(currentTtsUrlRef.current)
        currentTtsUrlRef.current = null
      }
    }
  }, [])

  // Handle isLoading state changes - when loading finishes without TTS, resume VAD
  useEffect(() => {
    // If loading just finished, not playing TTS, and we were waiting
    if (!isLoading && !isPlayingTTSRef.current && isWaitingForAgent && isConnected) {
      console.log('[VoiceCall] Loading finished, checking if should resume VAD')
      // Give a small delay to allow TTS chunks to arrive
      const timeout = setTimeout(() => {
        if (!isPlayingTTSRef.current && audioQueueRef.current.length === 0) {
          console.log('[VoiceCall] No TTS playing, resuming VAD')
          setIsWaitingForAgent(false)
          setVadStatusKey("call.status.ready")
          if (vadRef.current) {
            vadRef.current.start()
          }
        }
      }, 1000) // Wait 1 second to see if TTS chunks arrive
      
      return () => clearTimeout(timeout)
    }
  }, [isLoading, isWaitingForAgent, isConnected])

  // Compute RMS (Root Mean Square) for amplitude
  const computeRMS = (dataArray: Uint8Array): number => {
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128
      sum += normalized * normalized
    }
    return Math.sqrt(sum / dataArray.length)
  }

  // Keep refs in sync with state for RAF loop access
  useEffect(() => {
    isSpeakingRef.current = isSpeaking
  }, [isSpeaking])
  
  useEffect(() => {
    isAgentSpeakingRef.current = isAgentSpeaking
  }, [isAgentSpeaking])
  
  // Update audio amplitude for blob animation with smoothing
  const updateAmplitude = () => {
    let targetAmplitude = 0
    
    // Get mic amplitude when user is speaking (use ref for current value)
    if (analyserRef.current && isSpeakingRef.current) {
      const analyser = analyserRef.current
      const bufferLength = analyser.fftSize
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteTimeDomainData(dataArray)
      
      const rawAmplitude = computeRMS(dataArray)
      // Scale amplitude MUCH more aggressively for very visible effect
      // Use exponential scaling for more dramatic response
      targetAmplitude = Math.min(Math.pow(rawAmplitude * 8, 1.5), 1)
    }
    
    // Simulate amplitude when agent is speaking (TTS playing)
    // Create a very dynamic wave pattern (use ref for current value)
    if (isAgentSpeakingRef.current && isPlayingTTSRef.current) {
      const time = Date.now() / 1000
      // Combine multiple sine waves for organic, dramatic movement
      const wave1 = Math.sin(time * 3) * 0.4
      const wave2 = Math.sin(time * 5.5) * 0.3
      const wave3 = Math.sin(time * 8.2) * 0.2
      const wave4 = Math.sin(time * 13) * 0.15
      const wave5 = Math.sin(time * 2.1) * 0.25 // Slow wave for major pulses
      targetAmplitude = 0.5 + wave1 + wave2 + wave3 + wave4 + wave5
      targetAmplitude = Math.max(0.3, Math.min(targetAmplitude, 1))
    }
    
    // Smooth the amplitude using lerp - FASTER response
    // Much faster rise, moderate fall for punchy visuals
    const smoothingFactor = targetAmplitude > smoothedAmplitudeRef.current ? 0.4 : 0.15
    smoothedAmplitudeRef.current += (targetAmplitude - smoothedAmplitudeRef.current) * smoothingFactor
    
    setAudioAmplitude(smoothedAmplitudeRef.current)

    rafRef.current = requestAnimationFrame(updateAmplitude)
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
      setVadStatusKey("call.status.calling")
      setVadError(null)
      
      // Play calling sound (simulated with beep pattern)
      playCallingSound()
      
      // Simulate "calling" phase (like phone ringing)
      await new Promise(resolve => setTimeout(resolve, CALLING_DURATION))
      
      setVadStatusKey("call.status.connecting")

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

      // Start amplitude monitoring for blob animation
      updateAmplitude()

      // Initialize SimpleVAD
      setVadStatusKey("call.status.processing")
      
      const vad = new SimpleVAD(stream, {
        onSpeechStart: () => {
          console.log('[VoiceCall] Speech started')
          setIsSpeaking(true)
          setVadStatusKey("call.status.listening")
        },
        onSpeechEnd: (audioData: Float32Array) => {
          console.log('[VoiceCall] Speech ended, pausing VAD and sending audio...')
          setIsSpeaking(false)
          setIsWaitingForAgent(true)
          setVadStatusKey("call.status.processing")
          
          // IMPORTANT: Pause VAD immediately to prevent listening during agent turn
          vad.pause()
          
          // Send audio data to parent
          onAudioData(audioData, Date.now())
        },
        onVADMisfire: () => {
          console.log('[VoiceCall] VAD misfire (speech too short)')
          setIsSpeaking(false)
        },
        energyThreshold: 0.02, // Slightly higher threshold to reduce false triggers
        silenceDuration: 1500, // 1.5s of silence before ending speech
        minSpeechDuration: 300, // Minimum 300ms of speech
        sampleRate: 16000
      })
      
      vadRef.current = vad

      // The call usually starts with an agent greeting (see parent `onCallConnected` behavior).
      // Keep VAD paused until the greeting TTS completes (or until loading finishes without TTS).
      setIsConnected(true)
      const expectAgentToSpeakFirst = Boolean(onCallConnected)
      setIsWaitingForAgent(expectAgentToSpeakFirst)
      setVadStatusKey(expectAgentToSpeakFirst ? "call.status.processing" : "call.status.ready")
      if (!expectAgentToSpeakFirst) {
        // No greeting flow: start listening immediately.
        vad.start()
      }
      console.log('[VoiceCall] Call started; VAD state=', expectAgentToSpeakFirst ? 'paused(waiting)' : 'listening')
      onCallConnected?.()
    } catch (error) {
      console.error('[VoiceCall] Error starting call:', error)
      const msg = (error as Error)?.message || String(error)
      setVadError(msg)
      setVadStatusKey("call.status.error")
      alert(t("call.alert.failedToStart").replace("{message}", msg))
    }
  }

  // Cleanup on unmount or end call
  const cleanup = () => {
    console.log('[VoiceCall] Cleaning up...')
    
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

    // Stop TTS audio
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current.src = ''
      ttsAudioRef.current = null
    }
    
    // Clear TTS queue and state
    audioQueueRef.current = []
    playedChunksRef.current.clear()
    isPlayingTTSRef.current = false

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
    
    console.log('[VoiceCall] Cleanup complete')
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
  
  // Check if message has audio content (for display purposes)
  const hasAudioContent = (content: any): boolean => {
    if (Array.isArray(content)) {
      return content.some((block: any) => block.type === 'media' && block.mime_type?.startsWith('audio/'))
    }
    return false
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* Header (name on top) */}
      <div className="flex-shrink-0 pt-10 text-center">
        <div className="text-2xl font-semibold tracking-tight">{agentName}</div>
        <p
          className={cn(
            "mt-2 text-sm transition-all duration-300",
            isCalling
              ? "text-blue-600 animate-pulse font-medium"
              : isSpeaking
                ? "text-primary font-medium"
                : isAgentSpeaking
                  ? "text-green-600 font-medium"
                  : isWaitingForAgent || isLoading
                    ? "text-yellow-600 font-medium"
                    : "text-muted-foreground",
          )}
        >
          {vadStatusKey === "call.status.error"
            ? t("call.status.error").replace("{message}", vadError || "")
            : t(vadStatusKey)}
        </p>
        {isConnected && !isCalling && (
          <p className="mt-1 text-xs text-muted-foreground">{formatDuration(callDuration)}</p>
        )}
      </div>

      {/* Middle (round avatar in the center) */}
      <div className="flex-1 min-h-0 px-6 flex flex-col items-center justify-center gap-8">
        <div className="relative h-44 w-44">
          {(isSpeaking || isAgentSpeaking || isCalling || isWaitingForAgent || isLoading) && (
            <div
              className={cn(
                "absolute -inset-6 rounded-full blur-2xl opacity-70 transition-colors",
                isSpeaking && "bg-primary/25",
                isAgentSpeaking && "bg-emerald-400/25",
                isCalling && "bg-blue-500/20",
                (isWaitingForAgent || isLoading) && !isAgentSpeaking && !isCalling && "bg-amber-400/20",
              )}
            />
          )}

          <div
            className={cn(
              "relative h-full w-full overflow-hidden rounded-full bg-muted shadow-xl ring-2 transition-all",
              isSpeaking && "ring-primary/70",
              isAgentSpeaking && "ring-emerald-400/70",
              (isWaitingForAgent || isLoading) && !isAgentSpeaking && !isCalling && "ring-amber-400/60",
              isCalling && "ring-blue-500/60",
              !isSpeaking && !isAgentSpeaking && !isWaitingForAgent && !isLoading && !isCalling && "ring-border",
            )}
            style={{
              transform: `scale(${1 + audioAmplitude * 0.06})`,
              transition: "transform 0.06s ease-out",
            }}
          >
            <Image src={agentAvatar} alt={agentName} fill className="object-cover" />
          </div>

          {/* Pulsing rings during call setup */}
          {isCalling && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 animate-ping" style={{ animationDuration: "2s" }} />
              <div
                className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping"
                style={{ animationDuration: "2s", animationDelay: "1s" }}
              />
            </>
          )}
        </div>

        {/* Optional transcript preview */}
        {messages.length > 0 && (
          <div className="w-full max-w-2xl max-h-[30vh] overflow-y-auto rounded-2xl border border-border bg-muted/30 p-3">
            <div className="text-center mb-4">
              <div className="inline-block px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground font-medium">
                {t("call.transcript")}
              </div>
            </div>
            {messages.map((msg, idx) => {
              const text = getMessageText(msg.content)
              const isAudio = hasAudioContent(msg.content)
              const isUser = msg.role === 'user' || msg.type === 'human'

              // Skip messages with no content at all
              if (!text && !isAudio) return null

              return (
                <div
                  key={msg.id || idx}
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] px-4 py-2 rounded-2xl shadow-sm",
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-background text-foreground rounded-bl-sm border border-border"
                    )}
                  >
                    {isAudio && !text ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Mic className="w-4 h-4" />
                        <span className="italic opacity-80">Voice message</span>
                      </div>
                    ) : (
                      <div className={cn(
                        "text-sm prose prose-sm max-w-none",
                        isUser ? "prose-invert" : "prose-gray dark:prose-invert"
                      )}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                            ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="mb-0.5">{children}</li>,
                            code: ({ children }) => <code className="bg-muted rounded px-1 py-0.5 text-xs">{children}</code>,
                            pre: ({ children }) => <pre className="bg-muted rounded p-2 my-1 overflow-x-auto text-xs">{children}</pre>,
                            a: ({ href, children }) => <a href={href} className="underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                          }}
                        >
                          {text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Footer (controls at bottom) */}
      <div className="flex-shrink-0 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="outline"
            size="icon"
            className="w-14 h-14 rounded-full border-border hover:bg-muted shadow-md"
            onClick={toggleMute}
            disabled={isCalling}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
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
            className="w-14 h-14 rounded-full border-border hover:bg-muted shadow-md disabled:opacity-50"
            disabled={!ttsAutoplayBlocked}
            onClick={() => {
              setTtsAutoplayBlocked(false)
              void playNextTTSChunk()
            }}
          >
            {ttsAutoplayBlocked ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </Button>
        </div>

        {!isCalling && (
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              {isAgentSpeaking
                ? t("call.indicator.agentSpeaking")
                : isSpeaking
                  ? t("call.indicator.listening")
                  : isWaitingForAgent || isLoading
                    ? t("call.indicator.thinking")
                    : t("call.indicator.ready")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

