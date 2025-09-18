"use client"

import type React from "react"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Wrench, CheckCircle } from 'lucide-react'
import { HumanMessage } from "./messages/human-message"
import { AIMessage } from "./messages/ai-message"
import { ensureToolCallsHaveResponses, DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses"

// Tool Calls Component (like agent-chat-ui)
function ToolCalls({ toolCalls }: { toolCalls: Array<{ id?: string; name: string; args: Record<string, any> }> }) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mx-auto grid max-w-3xl gap-2 my-2">
      {toolCalls.map((tc, idx) => {
        const args = tc.args as Record<string, any>;
        const hasArgs = Object.keys(args).length > 0;
        return (
          <div
            key={idx}
            className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50"
          >
            <div className="border-b border-amber-200 bg-amber-100 px-4 py-2">
              <h3 className="font-medium text-amber-900 flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                {tc.name}
                {tc.id && (
                  <code className="ml-2 rounded bg-amber-200 px-2 py-1 text-sm">
                    {tc.id}
                  </code>
                )}
              </h3>
            </div>
            {hasArgs ? (
              <table className="min-w-full divide-y divide-amber-200">
                <tbody className="divide-y divide-amber-200">
                  {Object.entries(args).map(([key, value], argIdx) => (
                    <tr key={argIdx}>
                      <td className="px-4 py-2 text-sm font-medium whitespace-nowrap text-amber-900">
                        {key}
                      </td>
                      <td className="px-4 py-2 text-sm text-amber-700">
                        {typeof value === 'object' ? (
                          <code className="rounded bg-amber-100 px-2 py-1 font-mono text-sm break-all">
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
              <code className="block p-3 text-sm text-amber-700">{"{}"}</code>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Tool Result Component (like agent-chat-ui)
function ToolResult({ message }: { message: ChatMessage }) {
  if (!message.content) return null;

  return (
    <div className="mx-auto grid max-w-3xl gap-2 my-2">
      <div className="overflow-hidden rounded-lg border border-green-200 bg-green-50">
        <div className="border-b border-green-200 bg-green-100 px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-green-900 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Tool Result: {message.name || "Unknown Tool"}
            </h3>
          </div>
        </div>
        <div className="p-3 bg-green-50">
          <div className="text-sm text-green-800 whitespace-pre-wrap">
            {typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)}
          </div>
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
  onMessageEdit?: (messageId: string, newContent: string, parentCheckpoint?: string) => void
  onMessageRegenerate?: (messageId: string, parentCheckpoint?: string) => void
  onBranchSelect?: (messageId: string, direction: 'prev' | 'next') => void
  getMessageMetadata?: (message: ChatMessage) => MessageMetadata | undefined
  toolEvents?: any[] // Tool events like B-Bot Hub
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
  onMessageEdit,
  onMessageRegenerate,
  onBranchSelect,
  getMessageMetadata,
  toolEvents,
}: EnhancedChatMessagesProps) {
  // Get agent avatar
  const getAgentAvatar = () => {
    if (selectedAgent === "bbot" || !selectedAgent) {
      return "/helpful-robot.png";
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
  const welcomeSuggestions = suggestions && suggestions.length > 0 ? suggestions : ["Hello! How can you help me?", "What can you do?", "Tell me about yourself"];

  return (
    <div className="chat-messages h-full overflow-y-auto p-4 space-y-2">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Avatar className="h-20 w-20 mb-4">
            <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
            <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold mb-2">Hello I am {getAgentName()}</h2>
          <p className="text-gray-500 mb-6 text-center max-w-md">
            Start a conversation by sending a message or try one of these suggestions:
          </p>
          <div className="flex flex-col gap-2 items-center w-full max-w-md mx-auto px-2">
            {welcomeSuggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                onClick={() => onSuggestionClick(suggestion)}
                className="w-full h-auto items-start text-left text-sm whitespace-normal break-words"
                style={{ backgroundColor: userColor, color: getContrastYIQ(userColor) }}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages
            .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
            .filter((m) => {
              console.log("Processing message for display:", {
                id: m.id,
                type: m.type,
                role: m.role,
                hasContent: !!(m.content && m.content.trim()),
                contentLength: m.content?.length || 0,
                hasToolCalls: !!(m.tool_calls && m.tool_calls.length > 0),
                toolCallsCount: m.tool_calls?.length || 0
              });
              
              // Filter out empty AI messages that only contain tool_calls (trigger messages)
              if (m.type === "ai" && (!m.content || m.content.trim() === "") && m.tool_calls && m.tool_calls.length > 0) {
                console.log("🚫 Filtering out empty AI message with tool_calls:", m.id);
                return false;
              }
              // Filter out tool messages since they're displayed separately as tool events
              if (m.type === "tool") {
                console.log("🚫 Filtering out tool message (shown as tool event):", m.id);
                return false;
              }
              
              console.log("✅ Message will be displayed:", m.id, m.type);
              return true;
            })
            .map((message: ChatMessage, idx: number) => {
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
                      <HumanMessage
                        message={compatibleMessage}
                        isLoading={isLoading}
                        onEdit={(newContent, parentCheckpoint) => handleMessageEdit(message, newContent, parentCheckpoint)}
                        metadata={metadata}
                        onBranchSelect={(direction) => handleBranchSelect(message, direction)}
                      />
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
              <div key={message.id || idx} className="group mr-auto flex items-start gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
                  <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  {isToolResult ? (
                    // Show tool result (like agent-chat-ui)
                    <ToolResult message={message} />
                  ) : (
                    // Show AI message with inline tool calls (like agent-chat-ui)
                    <>
                      {message.content && (
                        <div className="py-1">
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="prose prose-sm dark:prose-invert whitespace-pre-wrap">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Show tool calls inline */}
                      {hasToolCalls && message.tool_calls && (
                        <ToolCalls toolCalls={message.tool_calls} />
                      )}
                    </>
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
                  <div className="prose prose-sm dark:prose-invert">
                    {incomingMessage}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Display tool events like B-Bot Hub - separate from messages */}
          {toolEvents && toolEvents.length > 0 && (
            <div className="my-2">
              {toolEvents.map((event, index) => (
                <div key={index} className="mx-4 my-2">
                  <div className="flex items-start gap-3 bg-amber-50 text-amber-800 rounded-lg px-4 py-3 border-l-4 border-amber-400">
                    <Wrench className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-amber-900 mb-1">
                        {event.tool_name || event.name || "Tool Processing"}
                      </div>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {event.content || event.tool_response?.content || "Processing..."}
                      </div>
                      {event.status && (
                        <div className="mt-2">
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
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  )
} 