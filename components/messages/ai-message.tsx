"use client";

import { useState, useEffect } from "react";
import { BranchSwitcher, CommandBar } from "./shared";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { messageMetadataManager } from "@/lib/message-metadata";
import { VoiceMessagePlayer } from "@/components/voice-message-player";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "human" | "ai";
  audioUrl?: string;
  audioDuration?: number;
  ttsEnabled?: boolean;
}

interface MessageMetadata {
  branch?: string;
  branchOptions?: string[];
  firstSeenState?: {
    parent_checkpoint?: string;
    values?: any;
  };
}

interface AIMessageProps {
  message: Message;
  isLoading: boolean;
  onRegenerate?: (parentCheckpoint?: string) => void;
  metadata?: MessageMetadata;
}

export function AIMessage({
  message,
  isLoading,
  onRegenerate,
  metadata,
}: AIMessageProps) {
  const contentString = message.content;
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(message.audioUrl || null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const handleRegenerate = () => {
    if (onRegenerate) {
      const parentCheckpoint = metadata?.firstSeenState?.parent_checkpoint;
      onRegenerate(parentCheckpoint);
    }
  };

  // Generate TTS audio on demand
  const handleGenerateTTS = async () => {
    if (!contentString || generatedAudioUrl) return;

    setIsGeneratingAudio(true);
    try {
      const response = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: contentString,
          model: 'openai/tts-1',
          voice: 'alloy',
          speed: 1.0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(audioUrl);
    } catch (error) {
      console.error('[AIMessage] Error generating TTS:', error);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (generatedAudioUrl && !message.audioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
    };
  }, [generatedAudioUrl, message.audioUrl]);

  return (
    <div className="group mr-auto flex items-start gap-2">
      <div className="flex flex-col gap-1">
        {/* Text Content */}
        {contentString.length > 0 && (
          <div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{contentString}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* TTS Audio Player - show if audio exists or if TTS is enabled */}
        {(generatedAudioUrl || message.ttsEnabled) && (
          <div className="mt-2">
            {generatedAudioUrl ? (
              <VoiceMessagePlayer
                audioUrl={generatedAudioUrl}
                duration={message.audioDuration}
                variant="ai"
              />
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateTTS}
                disabled={isGeneratingAudio}
                className="gap-2"
              >
                <Volume2 className="h-4 w-4" />
                {isGeneratingAudio ? 'Generating...' : 'Listen'}
              </Button>
            )}
          </div>
        )}

        <div
          className={cn(
            "mr-auto flex items-center gap-2 transition-opacity",
            "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          <CommandBar
            content={contentString}
            isLoading={isLoading}
            isAiMessage={true}
            handleRegenerate={handleRegenerate}
          />
        </div>
      </div>
    </div>
  );
} 