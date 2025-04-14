"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import {
  SendIcon,
  PaperclipIcon,
  MicIcon,
  ZapIcon,
  AppWindowIcon as AppsIcon,
  XIcon,
  ImageIcon,
  FileTextIcon,
  CheckIcon,
  PlusIcon,
  MinusIcon,
  MoreHorizontalIcon,
  InfoIcon,
  AudioWaveformIcon as Waveform,
} from "lucide-react"
import type { FormEvent } from "react"

interface ChatInputProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  selectedAgent?: string | null
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

export function ChatInput({ input, handleInputChange, handleSubmit, isLoading, selectedAgent }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    const textarea = textareaRef.current
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto"
      // Set the height to scrollHeight with a min of 56px and max of 200px
      textarea.style.height = input ? `${Math.min(textarea.scrollHeight, 200)}px` : "56px"
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

  return (
    <div className="input-area">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="attachments-preview">
          {attachments.map((file, index) => (
            <div key={index} className="attachment-item">
              <div className="attachment-icon">
                {file.type.startsWith("image/") ? <ImageIcon size={16} /> : <FileTextIcon size={16} />}
              </div>
              <span className="attachment-name">{file.name}</span>
              <button
                type="button"
                className="attachment-remove"
                onClick={() => removeAttachment(index)}
                aria-label="Remove attachment"
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleFormSubmit}>
        {/* Audio mode interface */}
        {isAudioMode ? (
          <div className="audio-mode-container">
            <div className="audio-visualization">
              <div className="audio-waveform">
                <Waveform size={24} className="waveform-icon pulse" />
              </div>
              <div className="audio-timer">{formatDuration(audioDuration)}</div>
            </div>
            <button
              type="button"
              onClick={stopAudioRecording}
              className="audio-stop-button"
              aria-label="Stop recording"
            >
              <span>Stop recording</span>
            </button>
          </div>
        ) : (
          /* Regular input container with optimized buttons */
          <div className="enhanced-input-container">
            {/* Primary feature button - always visible */}
            <div className="input-features">
              {/* Upload button - always visible */}
              <button
                type="button"
                className="feature-button tooltip-container"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach files"
              >
                <PaperclipIcon size={18} />
                <span className="tooltip">Attach files</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                multiple
                accept="image/*,application/pdf,text/plain"
              />

              {/* More options button - reveals secondary features */}
              <div className="relative">
                <button
                  type="button"
                  className={`feature-button more-options-button tooltip-container ${showMoreOptions ? "active-feature" : ""}`}
                  onClick={() => {
                    setShowMoreOptions(!showMoreOptions)
                    setShowAbilities(false)
                    setShowApps(false)

                    // Add a small delay to ensure the DOM is updated before checking position
                    if (!showMoreOptions) {
                      setTimeout(() => {
                        // Check if we're on mobile and adjust dropdown position if needed
                        const isMobile = window.innerWidth <= 640
                        if (isMobile) {
                          const dropdown = document.querySelector(".more-options-dropdown")
                          if (dropdown) {
                            const rect = dropdown.getBoundingClientRect()
                            if (rect.right > window.innerWidth) {
                              ;(dropdown as HTMLElement).style.left = "auto"
                              ;(dropdown as HTMLElement).style.right = "0"
                            }
                          }
                        }
                      }, 10)
                    }
                  }}
                  aria-label="More options"
                  aria-expanded={showMoreOptions}
                >
                  <MoreHorizontalIcon size={18} />
                  <span className="tooltip">More options</span>
                </button>

                {/* More options dropdown */}
                {showMoreOptions && (
                  <div className="feature-dropdown more-options-dropdown">
                    <div className="more-options-grid">
                      {/* Audio button */}
                      <button
                        type="button"
                        className="option-button tooltip-container"
                        onClick={startAudioRecording}
                        aria-label="Start recording"
                      >
                        <MicIcon size={18} />
                        <span className="option-label">Audio</span>
                        <span className="tooltip">Record audio message</span>
                      </button>

                      {/* Abilities button */}
                      <button
                        type="button"
                        className={`option-button tooltip-container ${abilities.some((a) => a.active) ? "active-option" : ""}`}
                        onClick={() => {
                          setShowAbilities(true)
                          setShowApps(false)
                          setShowMoreOptions(false)
                        }}
                        aria-label="Abilities"
                      >
                        <ZapIcon size={18} />
                        <span className="option-label">Abilities</span>
                        <span className="tooltip">Add special abilities</span>
                      </button>

                      {/* Apps button */}
                      <button
                        type="button"
                        className={`option-button tooltip-container ${apps.some((a) => a.active) ? "active-option" : ""}`}
                        onClick={() => {
                          setShowApps(true)
                          setShowAbilities(false)
                          setShowMoreOptions(false)
                        }}
                        aria-label="Apps"
                      >
                        <AppsIcon size={18} />
                        <span className="option-label">Apps</span>
                        <span className="tooltip">Connect apps</span>
                      </button>

                      {/* Help button */}
                      <button type="button" className="option-button tooltip-container" aria-label="Help">
                        <InfoIcon size={18} />
                        <span className="option-label">Help</span>
                        <span className="tooltip">Get help</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Abilities dropdown */}
            {showAbilities && (
              <div className="feature-dropdown abilities-dropdown">
                <div className="dropdown-header">
                  <h3>Abilities</h3>
                  <p>Enhance your assistant with additional capabilities</p>
                </div>
                <div className="dropdown-items">
                  {abilities.map((ability) => (
                    <div key={ability.id} className="dropdown-item">
                      <div className="item-info">
                        <div className="item-name">{ability.name}</div>
                        <div className="item-description">{ability.description}</div>
                      </div>
                      <button
                        type="button"
                        className={`toggle-button ${ability.active ? "active" : ""}`}
                        onClick={() => toggleAbility(ability.id)}
                        aria-label={`${ability.active ? "Disable" : "Enable"} ${ability.name}`}
                      >
                        {ability.active ? <CheckIcon size={14} /> : <PlusIcon size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Apps dropdown */}
            {showApps && (
              <div className="feature-dropdown apps-dropdown">
                <div className="dropdown-header">
                  <h3>Apps</h3>
                  <p>Connect and use apps with your assistant</p>
                </div>
                <div className="dropdown-items">
                  {apps.map((app) => (
                    <div key={app.id} className="dropdown-item">
                      <div className="app-icon">{app.icon}</div>
                      <div className="item-info">
                        <div className="item-name">{app.name}</div>
                        <div className="item-description">{app.description}</div>
                      </div>
                      {app.needsConnection && !app.isConnected ? (
                        <button
                          type="button"
                          className="connect-button"
                          onClick={() => connectApp(app.id)}
                          aria-label={`Connect ${app.name}`}
                        >
                          Connect
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`toggle-button ${app.active ? "active" : ""}`}
                          onClick={() => toggleApp(app.id)}
                          aria-label={`${app.active ? "Disable" : "Enable"} ${app.name}`}
                        >
                          {app.active ? <MinusIcon size={14} /> : <PlusIcon size={14} />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text input */}
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Message Beyond-Bot.ai..."
              value={input}
              onChange={handleInputChange}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (input.trim() || attachments.length > 0) {
                    handleFormSubmit(e as unknown as FormEvent<HTMLFormElement>)
                  }
                }
              }}
            />

            {/* Send button */}
            <button
              type="submit"
              className="send-button tooltip-container"
              disabled={isLoading || (!input.trim() && attachments.length === 0)}
              aria-label="Send message"
            >
              <SendIcon size={18} />
              <span className="tooltip tooltip-left">Send message</span>
            </button>
          </div>
        )}

        {/* Active features indicator */}
        {hasActiveFeatures && (
          <div className="active-features">
            {abilities
              .filter((a) => a.active)
              .map((ability) => (
                <div key={ability.id} className="active-feature-tag">
                  <ZapIcon size={12} />
                  <span>{ability.name}</span>
                  <button
                    type="button"
                    className="remove-feature"
                    onClick={() => toggleAbility(ability.id)}
                    aria-label={`Remove ${ability.name}`}
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              ))}

            {apps
              .filter((a) => a.active)
              .map((app) => (
                <div key={app.id} className="active-feature-tag">
                  <span className="app-tag-icon">{app.icon}</span>
                  <span>{app.name}</span>
                  <button
                    type="button"
                    className="remove-feature"
                    onClick={() => toggleApp(app.id)}
                    aria-label={`Remove ${app.name}`}
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
          </div>
        )}

        <div className="disclaimer">
          Beyond-Bot.ai may produce inaccurate information about people, places, or facts.
        </div>
      </form>
    </div>
  )
}
