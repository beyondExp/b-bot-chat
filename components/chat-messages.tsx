"use client"

import type { Message } from "ai"
import type { RefObject } from "react"
import { useState, useEffect } from "react"
import { UserIcon, BotIcon, Sparkles } from "lucide-react"
import { WelcomePricingBanner } from "./welcome-pricing-banner"

interface ChatMessagesProps {
  messages: Message[]
  messagesEndRef: RefObject<HTMLDivElement>
  selectedAgent: string | null
  onSuggestionClick: (suggestion: string) => void
}

export function ChatMessages({ messages, messagesEndRef, selectedAgent, onSuggestionClick }: ChatMessagesProps) {
  // Group messages by role for better visual presentation
  const groupedMessages = groupMessagesByRole(messages)
  const [showPricingBanner, setShowPricingBanner] = useState(true)

  // Check if this is the first visit
  useEffect(() => {
    const hasSeenPricingBanner = localStorage.getItem("hasSeenPricingBanner")
    if (hasSeenPricingBanner) {
      setShowPricingBanner(false)
    }
  }, [])

  const handleDismissBanner = () => {
    setShowPricingBanner(false)
    localStorage.setItem("hasSeenPricingBanner", "true")
  }

  return (
    <div className="message-container">
      {messages.length === 0 && (
        <div className="welcome-container">
          {showPricingBanner && <WelcomePricingBanner onDismiss={handleDismissBanner} />}

          <div className="welcome-icon">
            <Sparkles size={24} />
          </div>
          <h2 className="welcome-title">Welcome to Beyond-Bot.ai</h2>
          <p className="welcome-description">
            {selectedAgent
              ? `You're chatting with ${getAgentName(selectedAgent)}. Ask anything!`
              : "Chat with our AI assistant or select a specialized agent."}
          </p>
          <div className="suggestions-grid">
            {selectedAgent === "b-bot" ? (
              <>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Tell me about yourself")}>
                  Tell me about yourself
                </button>
                <button className="suggestion-button" onClick={() => onSuggestionClick("What can you help me with?")}>
                  What can you help me with?
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("How do I create my own AI agent?")}
                >
                  How do I create my own AI agent?
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("Give me a creative writing prompt")}
                >
                  Give me a creative writing prompt
                </button>
              </>
            ) : selectedAgent === "professor" ? (
              <>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Explain quantum entanglement")}>
                  Explain quantum entanglement
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("Help me understand relativity")}
                >
                  Help me understand relativity
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("What is the Schrödinger equation?")}
                >
                  What is the Schrödinger equation?
                </button>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Explain the Higgs boson")}>
                  Explain the Higgs boson
                </button>
              </>
            ) : selectedAgent === "chef" ? (
              <>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Recipe for homemade pasta")}>
                  Recipe for homemade pasta
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("How to perfectly sear a steak")}
                >
                  How to perfectly sear a steak
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("Best spices for Mediterranean dishes")}
                >
                  Best spices for Mediterranean dishes
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("Tips for baking sourdough bread")}
                >
                  Tips for baking sourdough bread
                </button>
              </>
            ) : selectedAgent === "therapist" ? (
              <>
                <button className="suggestion-button" onClick={() => onSuggestionClick("How to manage anxiety")}>
                  How to manage anxiety
                </button>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Tips for better sleep habits")}>
                  Tips for better sleep habits
                </button>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Ways to practice mindfulness")}>
                  Ways to practice mindfulness
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("How to set healthy boundaries")}
                >
                  How to set healthy boundaries
                </button>
              </>
            ) : selectedAgent === "coder" ? (
              <>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("Explain async/await in JavaScript")}
                >
                  Explain async/await in JavaScript
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("How to optimize React performance")}
                >
                  How to optimize React performance
                </button>
                <button
                  className="suggestion-button"
                  onClick={() => onSuggestionClick("Design patterns for scalable apps")}
                >
                  Design patterns for scalable apps
                </button>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Explain Docker containers")}>
                  Explain Docker containers
                </button>
              </>
            ) : (
              <>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Explain quantum computing")}>
                  Explain quantum computing
                </button>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Write a poem about AI")}>
                  Write a poem about AI
                </button>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Help me learn JavaScript")}>
                  Help me learn JavaScript
                </button>
                <button className="suggestion-button" onClick={() => onSuggestionClick("Plan a healthy meal")}>
                  Plan a healthy meal
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex} className="message-group">
          {group.messages.map((message, messageIndex) => (
            <div key={message.id} className="flex items-start gap-2">
              {messageIndex === 0 && message.role !== "user" && (
                <div className={`message-avatar ${selectedAgent ? "bg-primary" : "bg-black"}`}>
                  <BotIcon size={16} className="text-white" />
                </div>
              )}

              <div
                className={`message-bubble ${
                  message.role === "user" ? "user-message" : selectedAgent ? "agent-message" : "assistant-message"
                } ${messageIndex === 0 ? "" : "ml-10"}`}
              >
                {message.content}
              </div>

              {messageIndex === 0 && message.role === "user" && (
                <div className="message-avatar bg-black">
                  <UserIcon size={16} className="text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}

function getAgentName(agentId: string): string {
  const agents: Record<string, string> = {
    "b-bot": "B-Bot",
    default: "Beyond Assistant",
    professor: "Professor Einstein",
    chef: "Chef Gordon",
    therapist: "Dr. Thompson",
    coder: "Dev Patel",
  }

  return agents[agentId] || "Beyond Assistant"
}

// Helper function to group consecutive messages by the same role
function groupMessagesByRole(messages: Message[]) {
  return messages.reduce((groups: { role: string; messages: Message[] }[], message) => {
    const lastGroup = groups[groups.length - 1]

    if (lastGroup && lastGroup.role === message.role) {
      lastGroup.messages.push(message)
    } else {
      groups.push({ role: message.role, messages: [message] })
    }

    return groups
  }, [])
}
