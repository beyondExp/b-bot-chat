"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { BranchSwitcher, CommandBar } from "./shared";
import { cn } from "@/lib/utils";
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
  const contentString = message.content;

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
      <div className={cn("flex flex-col gap-2", isEditing && "w-full")}>
        {isEditing ? (
          <EditableContent
            value={value}
            setValue={setValue}
            onSubmit={handleSubmitEdit}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {contentString && (
              <p className="bg-muted ml-auto w-fit rounded-3xl px-4 py-2 text-right whitespace-pre-wrap">
                {contentString}
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