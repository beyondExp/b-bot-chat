"use client";

import { BranchSwitcher, CommandBar } from "./shared";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { messageMetadataManager } from "@/lib/message-metadata";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "human" | "ai";
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

  const handleRegenerate = () => {
    if (onRegenerate) {
      const parentCheckpoint = metadata?.firstSeenState?.parent_checkpoint;
      onRegenerate(parentCheckpoint);
    }
  };

  return (
    <div className="group mr-auto flex items-start gap-2">
      <div className="flex flex-col gap-1">
        {contentString.length > 0 && (
          <div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{contentString}</ReactMarkdown>
            </div>
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