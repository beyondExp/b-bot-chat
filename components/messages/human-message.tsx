"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { BranchSwitcher, CommandBar } from "./shared";
import { cn } from "@/lib/utils";
import { messageMetadataManager } from "@/lib/message-metadata";
import { VoiceMessagePlayer } from "@/components/voice-message-player";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string | Array<{ 
    type: string; 
    data?: string; 
    mime_type?: string; 
    duration?: number; 
    text?: string;
  }>;
  type?: "human" | "ai";
  audioUrl?: string;
  audioDuration?: number;
  isVoiceMessage?: boolean;
}

interface MessageMetadata {
  branch?: string;
  branchOptions?: string[];
  firstSeenState?: {
    parent_checkpoint?: string;
    values?: any;
  };
}

interface HumanMessageProps {
  message: Message;
  isLoading: boolean;
  onEdit?: (newContent: string, parentCheckpoint?: string) => void;
  metadata?: MessageMetadata;
  onBranchSelect?: (direction: 'prev' | 'next') => void;
}

function EditableContent({
  value,
  setValue,
  onSubmit,
}: {
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className="focus-visible:ring-0"
    />
  );
}

export function HumanMessage({
  message,
  isLoading,
  onEdit,
  metadata,
  onBranchSelect,
}: HumanMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  
  // Parse content - could be string or array of content blocks
  const contentBlocks = Array.isArray(message.content) ? message.content : [];
  const contentString = typeof message.content === 'string' ? message.content : '';
  
  // Extract audio if present (media type with audio mime_type)
  const audioBlock = contentBlocks.find(block => 
    block.type === 'media' && block.mime_type?.startsWith('audio/')
  );
  const textBlock = contentBlocks.find(block => block.type === 'text');

  const handleSubmitEdit = () => {
    setIsEditing(false);
    
    if (onEdit) {
      const parentCheckpoint = metadata?.firstSeenState?.parent_checkpoint;
      onEdit(value, parentCheckpoint);
    }
  };

  return (
    <div
      className={cn(
        "group ml-auto flex items-center gap-2",
        isEditing && "w-full max-w-xl",
      )}
    >
      <div className={cn("flex flex-col gap-1", isEditing && "w-full")}>
        {isEditing ? (
          <EditableContent
            value={value}
            setValue={setValue}
            onSubmit={handleSubmitEdit}
          />
        ) : (
          <div className="flex flex-col gap-1">
            {/* Voice Message from audio block */}
            {audioBlock && (
              <div className="ml-auto">
                <VoiceMessagePlayer
                  audioUrl={audioBlock.data || ''}
                  duration={audioBlock.duration}
                  variant="user"
                />
              </div>
            )}
            
            {/* Legacy: Voice Message from props */}
            {!audioBlock && message.isVoiceMessage && message.audioUrl && (
              <div className="ml-auto">
                <VoiceMessagePlayer
                  audioUrl={message.audioUrl}
                  duration={message.audioDuration}
                  variant="user"
                />
              </div>
            )}
            
            {/* Text Message from string content */}
            {contentString && !audioBlock && !message.isVoiceMessage && (
              <p className="bg-muted ml-auto w-fit rounded-3xl px-4 py-2 text-right whitespace-pre-wrap">
                {contentString}
              </p>
            )}
            
            {/* Text Message from text block */}
            {textBlock && textBlock.text && !audioBlock && (
              <p className="bg-muted ml-auto w-fit rounded-3xl px-4 py-2 text-right whitespace-pre-wrap">
                {textBlock.text}
              </p>
            )}
            
            {/* Voice Message Transcription (optional, shown below audio) */}
            {audioBlock && textBlock && textBlock.text && (
              <p className="text-xs text-muted-foreground ml-auto w-fit italic max-w-[350px]">
                "{textBlock.text}"
              </p>
            )}
          </div>
        )}

        <div
          className={cn(
            "ml-auto flex items-center gap-2 transition-opacity",
            "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
            isEditing && "opacity-100",
          )}
        >
          <BranchSwitcher
            branchInfo={messageMetadataManager.getBranchInfo(message.id)}
            onSelect={(direction) => onBranchSelect?.(direction)}
            isLoading={isLoading}
          />
          <CommandBar
            isLoading={isLoading}
            content={contentString}
            isEditing={isEditing}
            setIsEditing={(editing) => {
              if (editing) {
                setValue(contentString);
              }
              setIsEditing(editing);
            }}
            handleSubmitEdit={handleSubmitEdit}
            isHumanMessage={true}
          />
        </div>
      </div>
    </div>
  );
} 