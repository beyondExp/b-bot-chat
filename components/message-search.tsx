"use client"

import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageSearchProps {
  messages: any[]
  onClose: () => void
  onSelectMessage?: (messageIndex: number) => void
}

export function MessageSearch({ messages, onClose, onSelectMessage }: MessageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [matchingIndices, setMatchingIndices] = useState<number[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

  // Helper to extract text content from message
  const getMessageText = (content: any): string => {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join(' ')
    }
    return ''
  }

  // Search through messages
  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchingIndices([])
      setCurrentMatchIndex(0)
      return
    }

    const query = searchQuery.toLowerCase()
    const matches: number[] = []

    messages.forEach((message, index) => {
      const text = getMessageText(message.content).toLowerCase()
      if (text.includes(query)) {
        matches.push(index)
      }
    })

    setMatchingIndices(matches)
    setCurrentMatchIndex(0)
  }, [searchQuery, messages])

  const handlePrevious = () => {
    if (matchingIndices.length === 0) return
    const newIndex = currentMatchIndex > 0 ? currentMatchIndex - 1 : matchingIndices.length - 1
    setCurrentMatchIndex(newIndex)
    if (onSelectMessage) {
      onSelectMessage(matchingIndices[newIndex])
    }
  }

  const handleNext = () => {
    if (matchingIndices.length === 0) return
    const newIndex = currentMatchIndex < matchingIndices.length - 1 ? currentMatchIndex + 1 : 0
    setCurrentMatchIndex(newIndex)
    if (onSelectMessage) {
      onSelectMessage(matchingIndices[newIndex])
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search in conversation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-4"
          autoFocus
        />
      </div>

      {matchingIndices.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {currentMatchIndex + 1} / {matchingIndices.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrevious}
            disabled={matchingIndices.length === 0}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNext}
            disabled={matchingIndices.length === 0}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

