import type { Publisher } from "./publisher"

export interface AgentAbility {
  id: string
  name: string
  description: string
}

export interface AgentApp {
  id: string
  name: string
  icon: string
}

export interface Agent {
  id: string
  name: string
  description: string
  shortDescription: string
  profileImage: string
  category: string
  abilities: AgentAbility[]
  apps: AgentApp[]
  featured?: boolean
  new?: boolean
  popular?: boolean
  publisherId: string
  publisher?: Publisher
  isPublishedByUser?: boolean
  metadata?: any
  rawData?: any
  templates?: any[]
}
