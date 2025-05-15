"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAgents } from "@/lib/agent-service"
import { Markdown } from "react-markdown/lib/react-markdown"

interface ChatMessagesProps {
  messages: any[]
  messagesEndRef: React.RefObject<HTMLDivElement>
  selectedAgent: string | null
  incomingMessage?: string
  onSuggestionClick: (suggestion: string) => void
}

export function ChatMessages({
  messages,
  messagesEndRef,
  selectedAgent,
  incomingMessage = "",
  onSuggestionClick,
}: ChatMessagesProps) {
  const { getAgent } = useAgents()
  const [agentDetails, setAgentDetails] = useState<any>(null)

  // Fetch agent details when selectedAgent changes
  useEffect(() => {
    if (selectedAgent) {
      getAgent(selectedAgent)
        .then((agent) => {
          setAgentDetails(agent)
        })
        .catch((error) => {
          console.error("Error fetching agent details:", error)
        })
    } else {
      setAgentDetails(null)
    }
  }, [selectedAgent, getAgent])

  // Get agent avatar
  const getAgentAvatar = () => {
    if (agentDetails?.avatar) {
      return agentDetails.avatar
    }
    return "/helpful-robot.png" // Default avatar
  }

  // Get agent name
  const getAgentName = () => {
    if (agentDetails?.name) {
      return agentDetails.name
    }
    return selectedAgent || "B-Bot"
  }

  // Welcome message suggestions
  const suggestions = ["Hello! How can you help me?", "What can you do?", "Tell me about yourself"]

  return (
    <div className="chat-messages flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full">
          <Avatar className="h-20 w-20 mb-4">
            <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
            <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold mb-2">Welcome to {getAgentName()}</h2>
          <p className="text-gray-500 mb-6 text-center max-w-md">
            Start a conversation by sending a message or try one of these suggestions:
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                onClick={() => onSuggestionClick(suggestion)}
                className="text-sm"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-3 max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {message.role === "user" ? (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getAgentAvatar() || "/placeholder.svg"} alt={getAgentName()} />
                    <AvatarFallback>{getAgentName().substring(0, 2)}</AvatarFallback>
                  </Avatar>
                )}
                <Card className={`p-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Markdown>{message.content}</Markdown>
                </Card>
              </div>
            </div>
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
                  <Markdown>{incomingMessage}</Markdown>
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
