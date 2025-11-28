"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Brain, Sparkles, Globe } from "lucide-react"

interface AgentInfoModalProps {
  isOpen: boolean
  onClose: () => void
  agent: any
}

export function AgentInfoModal({ isOpen, onClose, agent }: AgentInfoModalProps) {
  if (!agent) return null

  const getProviderName = (provider: string) => {
    const map: Record<string, string> = {
      openai: "OpenAI",
      anthropic: "Anthropic",
      google: "Google Gemini",
      mistral: "Mistral AI",
      cohere: "Cohere",
      elevenlabs: "ElevenLabs",
      kvant: "Kvant Cloud"
    }
    return map[provider?.toLowerCase()] || provider || "Unknown Provider"
  }

  // Extract abilities from attributes if available
  const abilities = agent.attributes?.abilities || agent.abilities || []
  
  // Extract modalities
  const config = agent.rawData?.config || agent.rawData?.metadata?.config || {}
  const inputModalities = config.input_modalities || []
  const outputModalities = config.output_modalities || []

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Agent Information</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-background shadow-lg">
            <Image
              src={agent.profileImage || "/helpful-robot.png"}
              alt={agent.name || "Agent"}
              fill
              className="object-cover bg-muted"
            />
          </div>
          
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold">{agent.name}</h2>
            <p className="text-sm text-muted-foreground">{agent.profession || "AI Assistant"}</p>
          </div>

          {agent.description && (
            <p className="text-center text-sm text-muted-foreground px-4">
              {agent.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {agent.attributes?.expert_llm_models?.[0]?.attributes?.provider && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Brain size={12} />
                {getProviderName(agent.attributes.expert_llm_models[0].attributes.provider)}
              </Badge>
            )}
            
            {inputModalities.some((m: any) => m.type === 'voice' || m.type === 'audio') && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Globe size={12} />
                Voice Enabled
              </Badge>
            )}
          </div>
        </div>

        {(abilities.length > 0) && (
          <>
            <Separator />
            <div className="py-2">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Sparkles size={14} className="text-primary" />
                Capabilities
              </h3>
              <div className="flex flex-wrap gap-2">
                {abilities.map((ability: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs font-normal">
                    {ability.text || ability.attributes?.text || "Ability"}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

