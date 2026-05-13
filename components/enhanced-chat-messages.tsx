"use client"

import type React from "react"

import { useCallback, useRef, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Wrench, CheckCircle, ChevronDown, ChevronRight, CornerUpLeft } from 'lucide-react'
import { HumanMessage } from "./messages/human-message"
import { AIMessage } from "./messages/ai-message"
import { ensureToolCallsHaveResponses, DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useI18n } from "@/lib/i18n"

import { StreamingAudioPlayer } from "./streaming-audio-player"

function SwipeToReply({
  enabled,
  onReply,
  children,
}: {
  enabled: boolean
  onReply: () => void
  children: React.ReactNode
}) {
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const triggeredRef = useRef(false)
  const [dx, setDx] = useState(0)

  const reset = useCallback(() => {
    startRef.current = null
    triggeredRef.current = false
    setDx(0)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return
      if (e.pointerType !== "touch") return
      startRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
      triggeredRef.current = false
      setDx(0)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    },
    [enabled],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = startRef.current
      if (!enabled || !start) return
      if (e.pointerType !== "touch") return
      if (e.pointerId !== start.pointerId) return

      const rawDx = e.clientX - start.x
      const rawDy = e.clientY - start.y

      // If the user is scrolling vertically, do not treat it as a swipe.
      if (Math.abs(rawDy) > 24 && Math.abs(rawDx) < 24) {
        setDx(0)
        return
      }

      if (rawDx <= 0) {
        setDx(0)
        return
      }

      const clamped = Math.min(rawDx, 84)
      setDx(clamped)

      if (!triggeredRef.current && rawDx >= 64) {
        triggeredRef.current = true
        onReply()
        reset()
      }
    },
    [enabled, onReply, reset],
  )

  const onPointerUp = useCallback(() => {
    reset()
  }, [reset])

  const opacity = Math.max(0, Math.min(1, dx / 64))

  return (
    <div
      className="relative touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2"
        style={{ opacity }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm">
          <CornerUpLeft className="h-4 w-4" />
        </div>
      </div>
      <div style={{ transform: `translateX(${dx}px)` }}>{children}</div>
    </div>
  )
}

// Tool Calls Component (like agent-chat-ui) - Now collapsible
function ToolCalls({ toolCalls }: { toolCalls: Array<{ id?: string; name: string; args: Record<string, any> }> }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!toolCalls || toolCalls.length === 0) return null;

  const totalCalls = toolCalls.length;
  const callNames = toolCalls.map(tc => tc.name).join(", ");

  return (
    <div className="w-full my-2">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div 
          className="flex items-center gap-2 border-b border-border/60 bg-card px-4 py-2 cursor-pointer select-none hover:bg-muted/40 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Wrench className="w-4 h-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">
              Tool Calls ({totalCalls})
            </div>
            {!isExpanded && (
              <div className="text-xs text-muted-foreground truncate">
                {callNames}
              </div>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        
        {isExpanded && (
          <div className="p-3 space-y-2">
            {toolCalls.map((tc, idx) => {
              const args = tc.args as Record<string, any>;
              const hasArgs = Object.keys(args).length > 0;
              return (
                <div
                  key={idx}
                  className="overflow-hidden rounded-xl border border-border bg-background"
                >
                  <div className="border-b border-border/60 bg-muted/30 px-3 py-2">
                    <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                      <Wrench className="w-3 h-3 text-muted-foreground" />
                      {tc.name}
                      {tc.id && (
                        <code className="ml-2 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">
                          {tc.id}
                        </code>
                      )}
                    </h4>
                  </div>
                  {hasArgs ? (
                    <table className="min-w-full divide-y divide-border/60">
                      <tbody className="divide-y divide-border/60">
                        {Object.entries(args).map(([key, value], argIdx) => (
                          <tr key={argIdx}>
                            <td className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-foreground align-top">
                              {key}
                            </td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground">
                              {typeof value === 'object' ? (
                                <code className="block rounded bg-muted/40 px-2 py-1 font-mono text-xs whitespace-pre-wrap break-words">
                                  {JSON.stringify(value, null, 2)}
                                </code>
                              ) : (
                                String(value)
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <code className="block p-3 text-xs text-muted-foreground">{"{}"}</code>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Tool Result Component (like agent-chat-ui)
function ToolResult({ message }: { message: ChatMessage }) {
  if (!message.content) return null;

  return (
    <div className="w-full my-2">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border/60 bg-card px-4 py-2">
          <CheckCircle className="w-4 h-4 text-muted-foreground" />
          <div className="text-sm font-semibold text-foreground">
            Tool Result: {message.name || "Unknown Tool"}
          </div>
        </div>
        <div className="p-3 bg-background">
          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
            {typeof message.content === "string" ? message.content : JSON.stringify(message.content, null, 2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tool Events Collapsible Component
function ToolEventsCollapsible({ toolEvents }: { toolEvents: any[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!toolEvents || toolEvents.length === 0) return null;

  const totalEvents = toolEvents.length;
  const eventNames = toolEvents.map(event => event.tool_name || event.name || "Tool").join(", ");

  return (
    <div className="my-2">
      <div className="w-full">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div 
            className="flex items-center gap-2 border-b border-border/60 bg-card px-4 py-2 cursor-pointer select-none hover:bg-muted/40 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Wrench className="w-4 h-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">
                Tool Events ({totalEvents})
              </div>
              {!isExpanded && (
                <div className="text-xs text-muted-foreground truncate">
                  {eventNames}
                </div>
              )}
            </div>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          
          {isExpanded && (
            <div className="p-3 space-y-2">
              {toolEvents.map((event, index) => (
                <div key={index}>
                  <div className="flex items-start gap-3 rounded-xl px-3 py-2 border border-border bg-background">
                    <Wrench className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-foreground mb-1 text-sm">
                        {event.tool_name || event.name || "Tool Processing"}
                      </div>
                      <div className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {event.content || event.tool_response?.content || "Processing..."}
                      </div>
                      {event.status && (
                        <div className="mt-1">
                          <span className={`text-xs px-2 py-1 rounded ${
                            event.status === 'success' 
                              ? 'bg-green-100 text-green-700' 
                              : event.status === 'error' 
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {event.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChatMessage {
  id: string
  role: "user" | "assistant" | "tool_call" | "tool_response"
  content: string
  type?: "human" | "ai" | "tool"
  tool_calls?: Array<{
    id?: string;
    name: string;
    args: Record<string, any>;
  }>;
  tool_call_id?: string;
  name?: string;
}

interface MessageMetadata {
  branch?: string
  branchOptions?: string[]
  firstSeenState?: {
    parent_checkpoint?: string
    values?: any
  }
}

interface EnhancedChatMessagesProps {
  messages: ChatMessage[]
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  selectedAgent: string | null
  agents: any[]
  incomingMessage?: string
  onSuggestionClick: (suggestion: string) => void
  suggestions?: string[]
  userColor?: string
  isLoading?: boolean
  onSwipeReply?: (message: ChatMessage) => void
  onMessageEdit?: (messageId: string, newContent: string, parentCheckpoint?: string) => void
  audioMap?: Record<string, string[]> // 🔊 TTS audio chunks mapped by message ID
  onMessageRegenerate?: (messageId: string, parentCheckpoint?: string) => void
  onBranchSelect?: (messageId: string, direction: 'prev' | 'next') => void
  getMessageMetadata?: (message: ChatMessage) => MessageMetadata | undefined
  toolEvents?: any[] // Tool events like B-Bot Hub
  followUpSuggestions?: any[] // Hub-style follow-ups at end of stream
  followUpSuggestionsLoading?: boolean
  onFollowupClick?: (value: string) => void
  shouldAutoPlayAudio?: boolean // Whether to auto-play audio (false for old conversations)
  playedMessageIds?: Set<string> // Message IDs that were already played (e.g., during a call)
  welcomeTitle?: string
  welcomeSubtitle?: string
}

// Helper to determine readable text color
function getContrastYIQ(hexcolor: string) {
  hexcolor = hexcolor.replace('#', '');
  if (hexcolor.length === 3) {
    hexcolor = hexcolor.split('').map(x => x + x).join('');
  }
  const r = parseInt(hexcolor.substr(0,2),16);
  const g = parseInt(hexcolor.substr(2,2),16);
  const b = parseInt(hexcolor.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? '#000' : '#fff';
}

export function EnhancedChatMessages({
  messages,
  messagesEndRef,
  selectedAgent,
  agents,
  incomingMessage = "",
  onSuggestionClick,
  suggestions,
  userColor = '#2563eb',
  isLoading = false,
  onSwipeReply,
  onMessageEdit,
  onMessageRegenerate,
  onBranchSelect,
  getMessageMetadata,
  toolEvents,
  followUpSuggestions = [],
  followUpSuggestionsLoading = false,
  onFollowupClick,
  audioMap = {}, // 🔊 TTS audio chunks map
  shouldAutoPlayAudio = true, // Auto-play audio by default (false for old conversations)
  playedMessageIds = new Set(), // Message IDs already played during call
  welcomeTitle,
  welcomeSubtitle,
}: EnhancedChatMessagesProps) {
  const { t } = useI18n()
  const normalizedFollowups = (Array.isArray(followUpSuggestions) ? followUpSuggestions : [])
    .map((s: any) => {
      if (!s) return null
      if (typeof s === "string") {
        const text = s.trim()
        return text ? { label: text, value: text, action: "send_message" } : null
      }
      if (typeof s === "object") {
        const label = String(s.label || s.text || s.value || "").trim()
        const value = String(s.value || s.text || label || "").trim()
        const action = String(s.action || "send_message").trim() || "send_message"
        if (!label || !value) return null
        return { label, value, action }
      }
      return null
    })
    .filter(Boolean) as Array<{ label: string; value: string; action: string }>

  const showFollowups = !isLoading && normalizedFollowups.length > 0
  const showFollowupsLoading = !isLoading && !!followUpSuggestionsLoading && normalizedFollowups.length === 0
  // Get agent avatar
  const getAgentAvatar = () => {
    if (selectedAgent === "bbot" || selectedAgent === "b-bot" || !selectedAgent) {
      return "/api/branding/main-agent.svg";
    }
    const agent = agents.find(a => a.id === selectedAgent);
    if (agent && agent.profileImage) {
      return agent.profileImage;
    }
    return "/helpful-robot.png";
  }

  // Get agent name
  const getAgentName = () => {
    if (selectedAgent === "bbot" || !selectedAgent) {
      return "B-Bot";
    }
    const agent = agents.find(a => a.id === selectedAgent);
    if (agent && agent.name) {
      return agent.name;
    }
    return "AI Agent";
  }

  // Handle message editing
  const handleMessageEdit = (message: ChatMessage, newContent: string, parentCheckpoint?: string) => {
    if (onMessageEdit) {
      onMessageEdit(message.id, newContent, parentCheckpoint);
    }
  };

  // Handle message regeneration
  const handleMessageRegenerate = (message: ChatMessage, parentCheckpoint?: string) => {
    if (onMessageRegenerate) {
      onMessageRegenerate(message.id, parentCheckpoint);
    }
  };

  // Handle branch selection
  const handleBranchSelect = (message: ChatMessage, direction: 'prev' | 'next') => {
    if (onBranchSelect) {
      onBranchSelect(message.id, direction);
    }
  };

  // Welcome message suggestions
  const welcomeSuggestions =
    suggestions && suggestions.length > 0
      ? suggestions
      : [t("welcome.fallbackSuggestion1"), t("welcome.fallbackSuggestion2"), t("welcome.fallbackSuggestion3")];

  const visibleMessages = messages
    .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
    .filter((m) => {
      // Handle both string and array content
      let contentIsEmpty = false

      const content = m.content as any

      if (typeof content === "string") {
        contentIsEmpty = !content || content.trim() === ""
      } else if (Array.isArray(content)) {
        // Array content (multimodal) - check if it has any content
        contentIsEmpty = content.length === 0
      } else {
        contentIsEmpty = !content
      }

      // Filter out empty AI messages that only contain tool_calls (trigger messages)
      if (m.type === "ai" && contentIsEmpty && m.tool_calls && m.tool_calls.length > 0) {
        return false
      }
      // Filter out tool messages since they're displayed separately as tool events
      if (m.type === "tool") {
        return false
      }

      return true
    })

  const lastAiIndex = (() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const m = visibleMessages[i] as any
      const type = String(m.type || m.role || "").toLowerCase()
      if (type === "ai" || type === "assistant") return i
    }
    return -1
  })()

  const welcomeTitleText = welcomeTitle || t("welcome.fallbackTitle").replace("{name}", getAgentName())
  const renderSwissStyled = (text: string) => {
    // Highlight the word "Swiss" (red fill with black outline) for Swiss Chat welcome.
    // If the string doesn't include "Swiss", render it as-is.
    if (!text.includes("Swiss")) return text
    const parts = text.split(/(Swiss)/g)
    return parts.map((part, i) =>
      part === "Swiss" ? (
        <span
          key={`swiss-${i}`}
          className="text-primary font-extrabold"
        >
          Swiss
        </span>
      ) : (
        <span key={`swiss-part-${i}`}>{part}</span>
      ),
    )
  }

  return (
    <div className="chat-messages p-4 space-y-2">
      {messages.length === 0 ? (
        isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
              </div>
              <p className="text-lg font-semibold text-foreground mb-2">{t("chat.loadingConversationTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("chat.loadingConversationSubtitle")}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
              <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold mb-2">
              {renderSwissStyled(welcomeTitleText)}
            </h2>
            <p className="text-gray-500 mb-6 text-center max-w-md">
              {welcomeSubtitle || t("welcome.fallbackSubtitle")}
            </p>
            <div className="flex flex-col gap-2 items-center w-full max-w-md mx-auto px-2">
              {welcomeSuggestions.slice(0, 3).map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outlineTemplate"
                  onClick={() => onSuggestionClick(suggestion)}
                  className="w-full h-auto items-start text-left text-sm whitespace-normal break-words"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          {visibleMessages.map((message: ChatMessage, idx: number) => {
            // Get metadata for this message
            const metadata = getMessageMetadata ? getMessageMetadata(message) : undefined;

            // Skip legacy tool calls and tool responses 
            if (message.role === "tool_call" || message.role === "tool_response") {
              return null; // Don't render as separate messages
            }

            // Handle human messages with editing capability
            if (message.role === "user" || message.type === "human") {
              // Convert to compatible message format
              const compatibleMessage = {
                id: message.id,
                role: "user" as const,
                content: message.content,
                type: "human" as const
              };
              
              return (
                <div key={message.id || idx} className="flex justify-end">
                  <div className="flex gap-3 max-w-[80%] flex-row-reverse">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <SwipeToReply enabled={typeof onSwipeReply === "function"} onReply={() => onSwipeReply?.(message)}>
                        <HumanMessage
                          message={compatibleMessage}
                          isLoading={isLoading}
                          onEdit={(newContent, parentCheckpoint) => handleMessageEdit(message, newContent, parentCheckpoint)}
                          metadata={metadata}
                          onBranchSelect={(direction) => handleBranchSelect(message, direction)}
                        />
                      </SwipeToReply>
                    </div>
                  </div>
                </div>
              );
            }

            // Handle ALL non-human messages (AI and tool) like agent-chat-ui
            // Both AI messages and tool messages go through the same rendering logic
            const isToolResult = message.type === "tool";
            const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
            
            return (
              <div key={message.id || idx} className="group mr-auto flex items-start gap-2 w-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
                  <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {isToolResult ? (
                    // Show tool result (like agent-chat-ui)
                    <ToolResult message={message} />
                  ) : (
                    // Show AI message with tool calls BEFORE the message content
                    <>
                      {/* Show tool calls FIRST (before AI message content) */}
                      {hasToolCalls && message.tool_calls && (
                        <ToolCalls toolCalls={message.tool_calls} />
                      )}
                      
                      {/* Show AI message content with markdown rendering */}
                      {message.content && (
                        <SwipeToReply enabled={typeof onSwipeReply === "function"} onReply={() => onSwipeReply?.(message)}>
                          <div className="py-1 w-full max-w-3xl">
                            <div className="p-3 bg-muted rounded-lg w-full">
                              <div className="prose prose-sm dark:prose-invert max-w-none prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                              </div>
                              
                              {/* 🔊 TTS Audio Player: Show if this message has audio chunks */}
                              {audioMap[message.id] && audioMap[message.id].length > 0 && (
                                <div className="mt-2 pt-2 border-t border-muted-foreground/20">
                                  <StreamingAudioPlayer 
                                    audioChunks={audioMap[message.id]} 
                                    autoPlay={shouldAutoPlayAudio && !playedMessageIds.has(message.id)} 
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </SwipeToReply>
                      )}
                    </>
                  )}

                  {idx === lastAiIndex && (showFollowups || showFollowupsLoading) && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">{t("followups.title")}</div>
                      <div className="flex flex-wrap gap-2">
                        {showFollowups
                          ? normalizedFollowups.map((s, i) => (
                              <Button
                                key={`${s.value}-${i}`}
                                type="button"
                                variant="outlinePrimary"
                                size="sm"
                                onClick={() => {
                                  if (s.action !== "send_message") return
                                  onFollowupClick?.(s.value)
                                }}
                                className="h-auto whitespace-normal text-left"
                              >
                                {s.label}
                              </Button>
                            ))
                          : Array.from({ length: 3 }).map((_, i) => (
                              <Button
                                key={`loading-${i}`}
                                type="button"
                                variant="outlinePrimary"
                                size="sm"
                                disabled
                                className="h-auto opacity-70"
                              >
                                {t("followups.loading")}
                              </Button>
                            ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Streaming message */}
          {incomingMessage && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
                  <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{incomingMessage}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Display tool events like B-Bot Hub - separate from messages, now collapsible */}
          {toolEvents && toolEvents.length > 0 && (
            <ToolEventsCollapsible toolEvents={toolEvents} />
          )}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  )
} 