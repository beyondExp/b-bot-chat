export type ContactsStore = {
  getIds: () => string[]
  setIds: (ids: string[]) => void
  has: (agentId: string) => boolean
  add: (agentId: string) => string[]
  remove: (agentId: string) => string[]
  toggle: (agentId: string) => { ids: string[]; isNowContact: boolean }
}

function uniq(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)))
}

function keyForUser(userSub?: string | null): string {
  const u = (userSub || "").trim()
  return `bbot.contacts.v1.${u || "anonymous"}`
}

export function createContactsStore(userSub?: string | null): ContactsStore {
  const key = keyForUser(userSub)

  const safeParse = (raw: string | null): string[] => {
    if (!raw) return []
    try {
      const v = JSON.parse(raw)
      if (!Array.isArray(v)) return []
      return v.map(String).map((s) => s.trim()).filter(Boolean)
    } catch {
      return []
    }
  }

  const getIds = () => {
    if (typeof window === "undefined") return []
    return uniq(safeParse(window.localStorage.getItem(key)))
  }

  const setIds = (ids: string[]) => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(key, JSON.stringify(uniq(ids)))
  }

  const has = (agentId: string) => {
    const id = (agentId || "").trim()
    if (!id) return false
    return getIds().includes(id)
  }

  const add = (agentId: string) => {
    const id = (agentId || "").trim()
    if (!id) return getIds()
    const next = uniq([...getIds(), id])
    setIds(next)
    return next
  }

  const remove = (agentId: string) => {
    const id = (agentId || "").trim()
    if (!id) return getIds()
    const next = getIds().filter((x) => x !== id)
    setIds(next)
    return next
  }

  const toggle = (agentId: string) => {
    const id = (agentId || "").trim()
    if (!id) return { ids: getIds(), isNowContact: false }
    if (has(id)) return { ids: remove(id), isNowContact: false }
    return { ids: add(id), isNowContact: true }
  }

  return { getIds, setIds, has, add, remove, toggle }
}

