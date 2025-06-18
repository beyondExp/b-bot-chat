"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import clsx from "clsx"
import { Wrench, CheckCircle } from 'lucide-react'

interface ChatMessagesProps {
  messages: any[]
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  selectedAgent: string | null
  agents: any[]
  incomingMessage?: string
  onSuggestionClick: (suggestion: string) => void
  suggestions?: string[]
  userColor?: string
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

export function ChatMessages({
  messages,
  messagesEndRef,
  selectedAgent,
  agents,
  incomingMessage = "",
  onSuggestionClick,
  suggestions,
  userColor = '#2563eb',
}: ChatMessagesProps) {
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

  // Welcome message suggestions
  const welcomeSuggestions = suggestions && suggestions.length > 0 ? suggestions : ["Hello! How can you help me?", "What can you do?", "Tell me about yourself"];

  return (
    <div className="chat-messages flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full">
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
          {messages.map((message: any, idx: number) => (
            message.role === "tool_call" ? (
              <div key={message.id || idx} className="flex w-full">
                <div className="flex items-center gap-2 bg-blue-100 text-blue-800 rounded-full px-5 py-2 my-2 w-full max-w-full shadow">
                  <Wrench className="w-5 h-5 text-blue-500" />
                  <span><strong>Tool Call:</strong> {message.content.replace('[Tool call: ', '').replace(']', '')}</span>
                </div>
              </div>
            ) : message.role === "tool_response" ? (
              <div key={message.id || idx} className="flex w-full">
                <div className="flex items-center gap-2 bg-green-100 text-green-800 rounded-full px-5 py-2 my-2 w-full max-w-full shadow">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span><strong>Tool Response:</strong> {message.tool_name || message.content.replace('Tool Response:', '').trim()}</span>
                </div>
              </div>
            ) : (
              <div key={message.id || idx} className={`flex ${(message.role === "user" || message.type === "human") ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-3 max-w-[80%] ${(message.role === "user" || message.type === "human") ? "flex-row-reverse" : "flex-row"}`}>
                  {(message.role === "user" || message.type === "human") ? (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                  ) : (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
                      <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
                    </Avatar>
                  )}
                  <Card className={`p-3 ${(message.role === "user" || message.type === "human") ? "" : "bg-muted"}`}
                    style={(message.role === "user" || message.type === "human") ? { backgroundColor: userColor, color: getContrastYIQ(userColor) } : {}}>
                    <div className="prose prose-sm dark:prose-invert">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </Card>
                </div>
              </div>
            )
          ))}

          {/* Streaming message */}
          {incomingMessage && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
                  <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
                </Avatar>
                <Card className="p-3 bg-muted">
                  <div className="prose prose-sm dark:prose-invert">
                    <ReactMarkdown>{incomingMessage}</ReactMarkdown>
                  </div>
                </Card>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  )
}
