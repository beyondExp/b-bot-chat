"use client"

export type ChatUserProfile = {
  aboutMe: string
  additionalInstructions: string
}

const STORAGE_PREFIX = "bbot.chatUserProfile.v1."

function _key(userSub: string | null | undefined) {
  const id = (userSub || "anonymous").trim() || "anonymous"
  return `${STORAGE_PREFIX}${id}`
}

export function loadChatUserProfile(userSub: string | null | undefined): ChatUserProfile {
  if (typeof window === "undefined") {
    return { aboutMe: "", additionalInstructions: "" }
  }
  try {
    const raw = localStorage.getItem(_key(userSub))
    if (!raw) return { aboutMe: "", additionalInstructions: "" }
    const parsed = JSON.parse(raw) as Partial<ChatUserProfile> | null
    return {
      aboutMe: typeof parsed?.aboutMe === "string" ? parsed.aboutMe : "",
      additionalInstructions: typeof parsed?.additionalInstructions === "string" ? parsed.additionalInstructions : "",
    }
  } catch {
    return { aboutMe: "", additionalInstructions: "" }
  }
}

export function saveChatUserProfile(userSub: string | null | undefined, next: Partial<ChatUserProfile>) {
  if (typeof window === "undefined") return
  const current = loadChatUserProfile(userSub)
  const merged: ChatUserProfile = {
    aboutMe: typeof next.aboutMe === "string" ? next.aboutMe : current.aboutMe,
    additionalInstructions:
      typeof next.additionalInstructions === "string" ? next.additionalInstructions : current.additionalInstructions,
  }
  try {
    localStorage.setItem(_key(userSub), JSON.stringify(merged))
  } catch {
    // ignore
  }
}

export function clearChatUserProfile(userSub: string | null | undefined) {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(_key(userSub))
  } catch {
    // ignore
  }
}

export function buildSystemMessageWithUserProfile(baseSystemMessage: string, profile: ChatUserProfile): string {
  const base = (baseSystemMessage || "").trim() || "You are a helpful AI assistant."
  const about = (profile.aboutMe || "").trim()
  const extra = (profile.additionalInstructions || "").trim()
  if (!about && !extra) return base

  const parts: string[] = []
  if (about) parts.push(`User profile:\n${about}`)
  if (extra) parts.push(`Additional user instructions:\n${extra}`)
  return `${base}\n\n---\n${parts.join("\n\n")}`.trim()
}

