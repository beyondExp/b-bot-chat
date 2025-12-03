"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from "next/image"
import { SimpleVAD } from '@/lib/simple-vad'
import ReactMarkdown from 'react-markdown'

interface VoiceCallViewProps {
  agentName: string
  agentAvatar: string
  onEndCall: () => void
  onAudioData: (audioBuffer: Float32Array, timestamp: number) => void
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
  onAudioPlayed,
  messages = [],
  audioMap = {},
  isLoading = false
}: VoiceCallViewProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isCalling, setIsCalling] = useState(true) // "Calling..." state
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false) // Agent is speaking (TTS playing)
  const [isWaitingForAgent, setIsWaitingForAgent] = useState(false) // Waiting for agent response
  const [vadStatus, setVadStatus] = useState('Calling...')
  const [callDuration, setCallDuration] = useState(0)
  const [audioAmplitude, setAudioAmplitude] = useState(0) // 0-1 amplitude for blob animation
  
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
    if (audioQueueRef.current.length === 0) {
      console.log('[VoiceCall] 🔊 TTS playback complete, resuming VAD')
      isPlayingTTSRef.current = false
      setIsAgentSpeaking(false)
      setIsWaitingForAgent(false)
      setVadStatus('Ready - Speak naturally')
      
      // Resume VAD after agent finishes speaking
      if (vadRef.current && isConnected) {
        console.log('[VoiceCall] Resuming VAD after TTS complete')
        vadRef.current.start()
      }
      return
    }

    isPlayingTTSRef.current = true
    setIsAgentSpeaking(true)
    setVadStatus('Agent speaking...')

    const chunk = audioQueueRef.current.shift()!
    
    try {
      if (!ttsAudioRef.current) {
        ttsAudioRef.current = new Audio()
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
      const response = await fetch(`data:audio/mp3;base64,${chunk}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      ttsAudioRef.current.src = url
      await ttsAudioRef.current.play()
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
          setVadStatus('Ready - Speak naturally')
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
  
  // Auto-scroll messages to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

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

      // Start amplitude monitoring for blob animation
      updateAmplitude()

      // Initialize SimpleVAD
      setVadStatus('Initializing voice detection...')
      
      const vad = new SimpleVAD(stream, {
        onSpeechStart: () => {
          console.log('[VoiceCall] Speech started')
          setIsSpeaking(true)
          setVadStatus('Listening...')
        },
        onSpeechEnd: (audioData: Float32Array) => {
          console.log('[VoiceCall] Speech ended, pausing VAD and sending audio...')
          setIsSpeaking(false)
          setIsWaitingForAgent(true)
          setVadStatus('Processing...')
          
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
    <div className="flex flex-col h-screen bg-white text-gray-900">
      {/* Call UI - Fixed at top */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center py-12">
        {/* Agent Avatar with Blob Animation */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-6" style={{ width: '160px', height: '160px' }}>
            {/* Outer morphing blob - only visible when active */}
            {(isSpeaking || isAgentSpeaking || isCalling) && (
              <div 
                className={cn(
                  "absolute transition-all",
                  isSpeaking && "bg-gradient-to-br from-primary/60 to-violet-500/40",
                  isAgentSpeaking && "bg-gradient-to-br from-green-500/60 to-emerald-400/40",
                  isCalling && "bg-gradient-to-br from-blue-500/40 to-blue-400/20"
                )}
                style={{
                  inset: `-${15 + audioAmplitude * 50}px`,
                  // VERY dramatic blob shape morphing
                  borderRadius: `${70 - audioAmplitude * 35}% ${30 + audioAmplitude * 45}% ${60 + audioAmplitude * 30}% ${40 - audioAmplitude * 35}% / ${35 + audioAmplitude * 40}% ${65 - audioAmplitude * 35}% ${30 + audioAmplitude * 45}% ${70 - audioAmplitude * 40}%`,
                  transform: `scale(${1 + audioAmplitude * 0.35}) rotate(${audioAmplitude * 25}deg)`,
                  filter: `blur(${8 + audioAmplitude * 12}px)`,
                  transition: 'border-radius 0.05s ease-out, transform 0.05s ease-out, filter 0.05s ease-out, inset 0.05s ease-out',
                  animation: (isSpeaking || isAgentSpeaking) ? 'none' : 'blob-idle 4s ease-in-out infinite',
                }}
              />
            )}
            
            {/* Inner morphing blob layer - MUCH more intense */}
            {(isSpeaking || isAgentSpeaking) && (
              <div 
                className={cn(
                  "absolute transition-all",
                  isSpeaking && "bg-gradient-to-tl from-primary/50 to-violet-400/35",
                  isAgentSpeaking && "bg-gradient-to-tl from-green-400/50 to-emerald-300/35"
                )}
                style={{
                  inset: `-${10 + audioAmplitude * 35}px`,
                  borderRadius: `${35 + audioAmplitude * 40}% ${65 - audioAmplitude * 35}% ${40 + audioAmplitude * 35}% ${60 - audioAmplitude * 40}% / ${65 - audioAmplitude * 35}% ${35 + audioAmplitude * 40}% ${60 - audioAmplitude * 30}% ${40 + audioAmplitude * 35}%`,
                  transform: `scale(${1 + audioAmplitude * 0.25}) rotate(${-audioAmplitude * 35}deg)`,
                  filter: `blur(${6 + audioAmplitude * 10}px)`,
                  transition: 'border-radius 0.04s ease-out, transform 0.04s ease-out, inset 0.04s ease-out',
                }}
              />
            )}
            
            {/* Third blob layer for extra depth when active */}
            {(isSpeaking || isAgentSpeaking) && audioAmplitude > 0.15 && (
              <div 
                className={cn(
                  "absolute transition-all opacity-70",
                  isSpeaking && "bg-gradient-to-r from-violet-500/40 to-primary/30",
                  isAgentSpeaking && "bg-gradient-to-r from-emerald-500/40 to-green-400/30"
                )}
                style={{
                  inset: `-${audioAmplitude * 60}px`,
                  borderRadius: `${55 + audioAmplitude * 30}% ${45 - audioAmplitude * 30}% ${55 + audioAmplitude * 25}% ${45 - audioAmplitude * 25}%`,
                  transform: `rotate(${45 + audioAmplitude * 50}deg) scale(${1 + audioAmplitude * 0.2})`,
                  filter: `blur(${12 + audioAmplitude * 15}px)`,
                  transition: 'all 0.06s ease-out',
                }}
              />
            )}
            
            {/* Fourth blob layer - appears at high amplitude */}
            {(isSpeaking || isAgentSpeaking) && audioAmplitude > 0.4 && (
              <div 
                className={cn(
                  "absolute transition-all opacity-50",
                  isSpeaking && "bg-gradient-to-bl from-primary/30 to-fuchsia-500/20",
                  isAgentSpeaking && "bg-gradient-to-bl from-green-500/30 to-teal-400/20"
                )}
                style={{
                  inset: `-${audioAmplitude * 80}px`,
                  borderRadius: `${45 + audioAmplitude * 25}% ${55 - audioAmplitude * 25}% ${50 + audioAmplitude * 20}% ${50 - audioAmplitude * 20}%`,
                  transform: `rotate(${-30 + audioAmplitude * 60}deg)`,
                  filter: `blur(${15 + audioAmplitude * 20}px)`,
                  transition: 'all 0.08s ease-out',
                }}
              />
            )}
            
            {/* Waiting state - pulsing glow */}
            {(isWaitingForAgent || isLoading) && !isAgentSpeaking && !isCalling && (
              <div 
                className="absolute inset-0 bg-gradient-to-br from-yellow-500/30 to-amber-400/20 rounded-full animate-pulse"
                style={{
                  transform: 'scale(1.15)',
                  filter: 'blur(8px)',
                }}
              />
            )}
            
            {/* Main avatar with visible morph */}
            <div 
              className={cn(
                "absolute inset-3 overflow-hidden shadow-2xl transition-all",
                isSpeaking && "ring-4 ring-primary/80",
                isAgentSpeaking && "ring-4 ring-green-500/80",
                (isWaitingForAgent || isLoading) && !isAgentSpeaking && "ring-4 ring-yellow-500/60 animate-pulse",
                isCalling && "ring-4 ring-blue-500/60",
                !isSpeaking && !isAgentSpeaking && !isWaitingForAgent && !isLoading && !isCalling && "ring-2 ring-gray-200"
              )}
              style={{
                // More dramatic border-radius morph on the avatar itself
                borderRadius: (isSpeaking || isAgentSpeaking) 
                  ? `${50 - audioAmplitude * 12}% ${50 + audioAmplitude * 12}% ${50 + audioAmplitude * 10}% ${50 - audioAmplitude * 10}% / ${50 + audioAmplitude * 10}% ${50 - audioAmplitude * 12}% ${50 + audioAmplitude * 12}% ${50 - audioAmplitude * 10}%`
                  : '50%',
                transform: `scale(${1 + audioAmplitude * 0.1})`,
                transition: 'border-radius 0.05s ease-out, transform 0.05s ease-out',
              }}
            >
              <Image
                src={agentAvatar}
                alt={agentName}
                fill
                className="object-cover"
              />
            </div>
            
            {/* Pulsing rings during call setup */}
            {isCalling && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/60 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-0 rounded-full border-4 border-blue-400/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }} />
              </>
            )}
          </div>
          
          <h2 className="text-2xl font-semibold mb-1 text-gray-900">{agentName}</h2>
          <p className={cn(
            "text-sm transition-all duration-300",
            isCalling ? "text-blue-600 animate-pulse font-medium" : 
            isSpeaking ? "text-primary font-medium" :
            isAgentSpeaking ? "text-green-600 font-medium" :
            (isWaitingForAgent || isLoading) ? "text-yellow-600 font-medium" :
            "text-gray-600"
          )}>
            {vadStatus}
          </p>
          {isConnected && !isCalling && (
            <p className="text-xs text-gray-500 mt-1">{formatDuration(callDuration)}</p>
          )}
        </div>
        
        {/* CSS for idle blob animation */}
        <style jsx>{`
          @keyframes blob-idle {
            0%, 100% { 
              border-radius: 60% 40% 55% 45% / 45% 55% 40% 60%; 
            }
            25% { 
              border-radius: 45% 55% 50% 50% / 55% 45% 55% 45%; 
            }
            50% { 
              border-radius: 55% 45% 45% 55% / 50% 50% 50% 50%; 
            }
            75% { 
              border-radius: 40% 60% 55% 45% / 45% 55% 45% 55%; 
            }
          }
        `}</style>

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
              {isAgentSpeaking ? '🔊 Agent is speaking...' : 
               isSpeaking ? '🎤 Listening to you...' : 
               isWaitingForAgent || isLoading ? '⏳ Agent is thinking...' : 
               '🤖 Ready - Speak naturally'}
            </p>
          </div>
        )}
      </div>

      {/* Messages Display - Scrollable */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 bg-gray-50">
          <div className="max-w-2xl mx-auto space-y-3 pt-4">
            <div className="text-center mb-4">
              <div className="inline-block px-3 py-1 rounded-full bg-gray-200 text-xs text-gray-600 font-medium">
                Conversation Transcript
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
                        : "bg-white text-gray-900 rounded-bl-sm border border-gray-200"
                    )}
                  >
                    {isAudio && !text ? (
                      // Audio-only message
                      <div className="flex items-center gap-2 text-sm">
                        <Mic className="w-4 h-4" />
                        <span className="italic opacity-80">Voice message</span>
                      </div>
                    ) : (
                      // Text message with markdown rendering
                      <div className={cn(
                        "text-sm prose prose-sm max-w-none",
                        isUser ? "prose-invert" : "prose-gray"
                      )}>
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                            ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="mb-0.5">{children}</li>,
                            code: ({ children }) => <code className="bg-black/10 rounded px-1 py-0.5 text-xs">{children}</code>,
                            pre: ({ children }) => <pre className="bg-black/10 rounded p-2 my-1 overflow-x-auto text-xs">{children}</pre>,
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
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}

