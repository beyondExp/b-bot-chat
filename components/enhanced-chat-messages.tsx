"use client"

import type React from "react"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Wrench, CheckCircle } from 'lucide-react'
import { HumanMessage } from "./messages/human-message"
import { AIMessage } from "./messages/ai-message"

interface ChatMessage {
  id: string
  role: "user" | "assistant" | "tool_call" | "tool_response"
  content: string
  type?: "human" | "ai"
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
          {messages.map((message: ChatMessage, idx: number) => {
            // Get metadata for this message
            const metadata = getMessageMetadata ? getMessageMetadata(message) : undefined;

            // Handle tool calls and tool responses
            if (message.role === "tool_call") {
              return (
                <div key={message.id || idx} className="flex w-full">
                  <div className="flex items-center gap-2 bg-blue-100 text-blue-800 rounded-full px-5 py-2 my-2 w-full max-w-full shadow">
                    <Wrench className="w-5 h-5 text-blue-500" />
                    <span><strong>Tool Call:</strong> {message.content.replace('[Tool call: ', '').replace(']', '')}</span>
                  </div>
                </div>
              );
            }

            if (message.role === "tool_response") {
              return (
                <div key={message.id || idx} className="flex w-full">
                  <div className="flex items-center gap-2 bg-green-100 text-green-800 rounded-full px-5 py-2 my-2 w-full max-w-full shadow">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span><strong>Tool Response:</strong> {message.content.replace('Tool Response:', '').trim()}</span>
                  </div>
                </div>
              );
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

            // Handle AI messages with regeneration capability
            // Convert to compatible message format
            const compatibleMessage = {
              id: message.id,
              role: "assistant" as const,
              content: message.content,
              type: "ai" as const
            };
            
            return (
              <div key={message.id || idx} className="flex justify-start">
                <div className="flex gap-3 max-w-[80%] flex-row">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
                    <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <AIMessage
                      message={compatibleMessage}
                      isLoading={isLoading}
                      onRegenerate={(parentCheckpoint) => handleMessageRegenerate(message, parentCheckpoint)}
                      metadata={metadata}
                    />
                  </div>
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
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  )
} 