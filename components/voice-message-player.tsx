"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Pause, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceMessagePlayerProps {
  audioUrl: string
  duration?: number
  className?: string
  variant?: 'user' | 'ai'
  isLoading?: boolean
}

export function VoiceMessagePlayer({ 
  audioUrl, 
  duration, 
  className,
  variant = 'ai',
  isLoading = false
}: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration || 0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Create audio element
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    // Set up event listeners
    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(Math.floor(audio.duration))
    })

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentTime(0)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    })

    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e)
      setIsPlaying(false)
    })

    // Cleanup
    return () => {
      audio.pause()
      audio.src = ''
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [audioUrl])

  const togglePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    } else {
      audioRef.current.play()
      setIsPlaying(true)
      
      // Update progress
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(Math.floor(audioRef.current.currentTime))
        }
      }, 100)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return

    const progressBar = e.currentTarget
    const rect = progressBar.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * audioDuration

    audioRef.current.currentTime = newTime
    setCurrentTime(Math.floor(newTime))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0

  if (isLoading) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-lg p-2",
        variant === 'user' ? 'bg-primary/10' : 'bg-muted',
        className
      )}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">Generating audio...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg p-2 min-w-[250px] max-w-[350px]",
      variant === 'user' ? 'bg-primary/10' : 'bg-muted',
      className
    )}>
      {/* Play/Pause Button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={togglePlayPause}
        className={cn(
          "h-8 w-8 rounded-full flex-shrink-0",
          variant === 'user' ? 'hover:bg-primary/20' : 'hover:bg-muted-foreground/10'
        )}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </Button>

      {/* Waveform / Progress Bar */}
      <div className="flex-1 flex flex-col gap-1">
        <div 
          className="relative h-6 cursor-pointer group"
          onClick={handleProgressClick}
        >
          {/* Background bars (waveform simulation) */}
          <div className="absolute inset-0 flex items-center gap-[2px]">
            {Array.from({ length: 30 }).map((_, i) => {
              const height = Math.random() * 60 + 40 // 40-100% height
              const isPassed = (i / 30) * 100 <= progress
              
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-full transition-all",
                    isPassed 
                      ? variant === 'user' 
                        ? 'bg-primary' 
                        : 'bg-foreground' 
                      : variant === 'user'
                        ? 'bg-primary/30'
                        : 'bg-muted-foreground/30',
                    "group-hover:bg-primary/50"
                  )}
                  style={{ height: `${height}%` }}
                />
              )
            })}
          </div>
        </div>

        {/* Time Display */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(audioDuration)}</span>
        </div>
      </div>
    </div>
  )
}

