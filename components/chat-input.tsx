"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2, Mic, Trash2 } from "lucide-react"
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import type React from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"

interface ChatInputProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>, input: string) => void
  onVoiceMessage?: (audioBlob: Blob, transcription: string, duration: number) => void
  isLoading: boolean
  selectedAgent: string | null
  agentName?: string
  userColor?: string
}

interface Ability {
  id: string
  name: string
  description: string
  active: boolean
}

interface App {
  id: string
  name: string
  icon: string
  description: string
  active: boolean
  needsConnection: boolean
  isConnected: boolean
}

export function ChatInput({ onSubmit, onVoiceMessage, isLoading, selectedAgent, agentName, userColor = '#2563eb' }: ChatInputProps) {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Voice recording
  const {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    error: recordingError
  } = useVoiceRecorder()

  const [isSendingVoice, setIsSendingVoice] = useState(false)

  const [isAudioMode, setIsAudioMode] = useState(false)
  const [showAbilities, setShowAbilities] = useState(false)
  const [showApps, setShowApps] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [audioDuration, setAudioDuration] = useState(0)

  // Sample abilities data - in a real app, this would come from an API
  const [abilities, setAbilities] = useState<Ability[]>([
    { id: "web-search", name: "Web Search", description: "Search the web for information", active: false },
    { id: "code-analysis", name: "Code Analysis", description: "Analyze and explain code", active: false },
    { id: "data-analysis", name: "Data Analysis", description: "Analyze data and generate insights", active: false },
    { id: "creative-writing", name: "Creative Writing", description: "Generate creative content", active: false },
  ])

  // Sample apps data - in a real app, this would come from an API
  const [apps, setApps] = useState<App[]>([
    {
      id: "google-drive",
      name: "Google Drive",
      icon: "G",
      description: "Access your Google Drive files",
      active: false,
      needsConnection: true,
      isConnected: false,
    },
    {
      id: "notion",
      name: "Notion",
      icon: "N",
      description: "Access your Notion workspace",
      active: false,
      needsConnection: true,
      isConnected: true,
    },
    {
      id: "github",
      name: "GitHub",
      icon: "GH",
      description: "Access your GitHub repositories",
      active: false,
      needsConnection: true,
      isConnected: false,
    },
    {
      id: "calculator",
      name: "Calculator",
      icon: "=",
      description: "Perform calculations",
      active: false,
      needsConnection: false,
      isConnected: true,
    },
  ])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Reset textarea height when agent changes
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = input ? `${Math.min(textarea.scrollHeight, 200)}px` : "56px"
    }
  }, [selectedAgent])

  // Audio mode timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isAudioMode) {
      interval = setInterval(() => {
        setAudioDuration((prev) => prev + 1)
      }, 1000)
    } else {
      setAudioDuration(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isAudioMode])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAbilities || showApps || showMoreOptions) {
        const target = event.target as HTMLElement
        if (
          !target.closest(".abilities-dropdown") &&
          !target.closest(".abilities-button") &&
          !target.closest(".apps-dropdown") &&
          !target.closest(".apps-button") &&
          !target.closest(".more-options-dropdown") &&
          !target.closest(".more-options-button")
        ) {
          setShowAbilities(false)
          setShowApps(false)
          setShowMoreOptions(false)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showAbilities, showApps, showMoreOptions])

  const toggleAbility = (id: string) => {
    setAbilities(abilities.map((ability) => (ability.id === id ? { ...ability, active: !ability.active } : ability)))
  }

  const toggleApp = (id: string) => {
    setApps(apps.map((app) => (app.id === id ? { ...app, active: !app.active } : app)))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setAttachments([...attachments, ...newFiles])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const connectApp = (id: string) => {
    // In a real app, this would open a connection flow
    setApps(apps.map((app) => (app.id === id ? { ...app, isConnected: true } : app)))
  }

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      onSubmit(e, input)
      setInput("")
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }
  }

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // In a real app, you would handle attachments, abilities, and apps here
    // For now, we'll just call the original handleSubmit
    handleSubmit(e)

    // Clear attachments after submit
    setAttachments([])
  }

  const startAudioRecording = () => {
    // In a real app, this would start recording audio
    setIsAudioMode(true)
    setShowMoreOptions(false)
  }

  const stopAudioRecording = () => {
    // In a real app, this would stop recording and process audio
    setIsAudioMode(false)
  }

  // Format audio duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Check if any abilities or apps are active
  const hasActiveFeatures = abilities.some((a) => a.active) || apps.some((a) => a.active)

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.form
      if (form) form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
    }
  }

  // Show recording error
  useEffect(() => {
    if (recordingError) {
      toast.error(recordingError)
    }
  }, [recordingError])

  // Handle audio blob after recording stops
  useEffect(() => {
    if (audioBlob && !isRecording) {
      handleSendVoiceMessage(audioBlob, recordingTime)
    }
  }, [audioBlob, isRecording])

  // Handle voice message sending (send audio directly as modality)
  const handleSendVoiceMessage = async (blob: Blob, duration: number) => {
    setIsSendingVoice(true)
    try {
      console.log('[ChatInput] Sending voice message as audio modality:', { duration, size: blob.size })

      // Call the voice message callback to send audio directly
      if (onVoiceMessage) {
        await onVoiceMessage(blob, '', duration) // No transcription needed
        toast.success('Voice message sent!')
      } else {
        toast.error('Voice message handling not available')
      }
    } catch (error) {
      console.error('[ChatInput] Error sending voice message:', error)
      toast.error('Failed to send voice message')
    } finally {
      setIsSendingVoice(false)
    }
  }

  // Start recording
  const handleStartRecording = async () => {
    try {
      await startRecording()
    } catch (err) {
      console.error('Failed to start recording:', err)
      toast.error('Failed to start recording. Please check microphone permissions.')
    }
  }

  // Stop recording and send
  const handleStopAndSend = () => {
    stopRecording()
  }

  // Cancel recording
  const handleCancelRecording = () => {
    cancelRecording()
  }

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const placeholderName = agentName || selectedAgent || "Assistant"

  return (
    <div className="chat-input-container p-4 sticky bottom-0 bg-background z-10">
      <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto">
        {isRecording ? (
          /* Full-width recording UI */
          <div className="relative flex items-center bg-red-50 dark:bg-red-950/20 rounded-3xl border border-red-200 dark:border-red-900 px-4 py-3 min-h-[52px]">
            {/* Cancel Button */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleCancelRecording}
              disabled={isSendingVoice}
              className="h-10 w-10 flex-shrink-0 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-5 w-5" />
            </Button>

            {/* Recording Indicator & Waveform - Takes full space */}
            <div className="flex items-center gap-3 flex-1 px-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400 min-w-[45px]">
                  {formatTime(recordingTime)}
                </span>
              </div>
              
              {/* Full-width waveform animation */}
              <div className="flex items-center gap-[3px] h-10 flex-1">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-red-400 dark:bg-red-500 rounded-full animate-pulse min-w-[2px]"
                    style={{
                      height: `${Math.random() * 60 + 40}%`,
                      animationDelay: `${i * 0.02}s`,
                      animationDuration: '0.8s'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Send Button */}
            <Button
              type="button"
              size="icon"
              onClick={handleStopAndSend}
              disabled={isSendingVoice}
              className="h-10 w-10 flex-shrink-0 rounded-full bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-700"
            >
              {isSendingVoice ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        ) : (
          /* Normal input UI */
          <div className="relative flex items-center bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-200 focus-within:shadow-lg">
            {/* Main input area */}
            <div className="flex-1 min-w-0">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${placeholderName}`}
                className="w-full min-h-[52px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3 text-base placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isLoading}
                style={{ 
                  lineHeight: '1.5',
                  paddingRight: '60px' // Space for button (voice or send)
                }}
              />
            </div>
            
            {/* Action buttons integrated inside the input - vertically centered */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {/* Voice message button - only show when input is empty AND agent supports audio */}
              {!input.trim() && onVoiceMessage ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleStartRecording}
                  disabled={isLoading}
                  className="h-10 w-10 rounded-full hover:bg-primary/10 flex-shrink-0"
                  title="Send voice message"
                >
                  <Mic className="h-5 w-5 text-primary" />
                </Button>
              ) : (
                /* Send button - always show (disabled when empty and no voice support) */
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="h-10 w-10 rounded-full p-0 transition-all duration-200 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
        
        {/* Loading indicator below input */}
        {isLoading && (
          <div className="flex items-center justify-center mt-3 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Generating response...
          </div>
        )}
      </form>
    </div>
  )
}
