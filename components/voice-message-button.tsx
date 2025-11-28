"use client"

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface VoiceMessageButtonProps {
  onSendVoiceMessage: (audioBlob: Blob, duration: number) => Promise<void>
  onRecordingStateChange?: (isRecording: boolean, recordingTime: number) => void
  onCancelRecording?: () => void
  onStopRecording?: () => void
  disabled?: boolean
  className?: string
  hideButton?: boolean
}

export function VoiceMessageButton({ 
  onSendVoiceMessage,
  onRecordingStateChange,
  onCancelRecording: onCancelRecordingCallback,
  onStopRecording: onStopRecordingCallback,
  disabled = false,
  className,
  hideButton = false
}: VoiceMessageButtonProps) {
  const {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    error
  } = useVoiceRecorder()

  const [isSending, setIsSending] = useState(false)
  const [showRecordingUI, setShowRecordingUI] = useState(false)

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  // Handle recording UI visibility
  useEffect(() => {
    setShowRecordingUI(isRecording)
  }, [isRecording])

  // Notify parent of recording state changes
  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording, recordingTime)
    }
  }, [isRecording, recordingTime, onRecordingStateChange])

  // Handle audio blob after recording stops
  useEffect(() => {
    if (audioBlob && !isRecording) {
      handleSendAudio()
    }
  }, [audioBlob, isRecording])

  const handleStartRecording = async () => {
    try {
      await startRecording()
    } catch (err) {
      console.error('Failed to start recording:', err)
      toast.error('Failed to start recording. Please check microphone permissions.')
    }
  }

  const handleStopRecording = () => {
    stopRecording()
  }

  const handleCancelRecording = () => {
    cancelRecording()
    setShowRecordingUI(false)
    if (onCancelRecordingCallback) {
      onCancelRecordingCallback()
    }
  }

  const handleStopRecordingWrapper = () => {
    stopRecording()
    if (onStopRecordingCallback) {
      onStopRecordingCallback()
    }
  }

  const handleSendAudio = async () => {
    if (!audioBlob) return

    setIsSending(true)
    try {
      await onSendVoiceMessage(audioBlob, recordingTime)
      setShowRecordingUI(false)
      toast.success('Voice message sent!')
    } catch (err) {
      console.error('Failed to send voice message:', err)
      toast.error('Failed to send voice message')
    } finally {
      setIsSending(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // When recording or hideButton is true, return null - the parent will handle the full-width UI
  if (showRecordingUI || hideButton) {
    return null
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={handleStartRecording}
      disabled={disabled}
      className={cn(
        "h-10 w-10 rounded-full hover:bg-primary/10 flex-shrink-0",
        className
      )}
      title="Send voice message"
    >
      <Mic className="h-5 w-5 text-primary" />
    </Button>
  )
}

// Export the handler functions for external use
export { VoiceMessageButton as default }
export type { VoiceMessageButtonProps }

