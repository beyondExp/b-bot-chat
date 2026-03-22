"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Download, FileText, Loader2, RefreshCcw, Trash2, Upload } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { toast } from "sonner"

export type QueuedWorkdeskFile = {
  name: string
  size: number
}

type WorkdeskFileItem = {
  name: string
  path: string
  size?: number | null
  source?: string
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null
}

function errorMessageFromUpstream(data: unknown, fallback: string): string {
  const r = asRecord(data)
  const detail = r?.detail
  const error = r?.error
  const message = r?.message
  if (typeof detail === "string" && detail.trim()) return detail
  if (typeof error === "string" && error.trim()) return error
  if (typeof message === "string" && message.trim()) return message
  return fallback
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function fileToBase64Data(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("FileReader failed"))
    reader.onload = () => {
      const raw = String(reader.result || "")
      const idx = raw.indexOf("base64,")
      if (idx >= 0) return resolve(raw.slice(idx + "base64,".length))
      // Fallback: if it isn't a data URL, try to treat it as already-base64 (unlikely).
      resolve(raw)
    }
    reader.readAsDataURL(file)
  })
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function WorkdeskDrawer({
  isOpen,
  onClose,
  getToken,
  threadId,
  queuedFiles,
  localEntries,
  localContents,
  onQueueWorkspaceFile,
  onRemoveQueuedFile,
  autoPick,
  onAutoPickConsumed,
}: {
  isOpen: boolean
  onClose: () => void
  getToken: () => Promise<string | null>
  threadId: string | null
  queuedFiles: QueuedWorkdeskFile[]
  localEntries?: Array<{ name: string; path: string; size?: number | null; source?: string }>
  localContents?: Record<string, string>
  onQueueWorkspaceFile: (name: string, content: string, size: number) => void
  onRemoveQueuedFile: (name: string) => void
  autoPick?: boolean
  onAutoPickConsumed?: () => void
}) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<WorkdeskFileItem[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [extractingName, setExtractingName] = useState<string | null>(null)

  const ready = Boolean(threadId)

  const mergedFileEntries = useMemo(() => {
    const normalize = (p: string) => (p || "").toString().replace(/^\/+/, "").trim()
    const byPath = new Map<string, WorkdeskFileItem>()

    const add = (row: { name?: string; path?: string; size?: number | null; source?: string } | null | undefined) => {
      const rawPath = row?.path || row?.name || ""
      const path = normalize(rawPath)
      if (!path) return
      const name = (row?.name || path.split("/").filter(Boolean).pop() || path).toString()
      const size = typeof row?.size === "number" ? row?.size : row?.size ?? null
      const source = row?.source
      if (!byPath.has(path)) {
        byPath.set(path, { name, path, size, source })
      }
    }

    // Local entries first so "streamed"/queued files are visible even if backend list is empty.
    if (Array.isArray(localEntries)) {
      for (const e of localEntries) add(e)
    }
    for (const e of files) add(e)

    return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path))
  }, [localEntries, files])

  const refreshFiles = useCallback(async () => {
    if (!threadId) {
      setFiles([])
      setFilesError(null)
      return
    }
    setFilesLoading(true)
    setFilesError(null)
    try {
      const token = await getToken()
      if (!token) {
        setFiles([])
        setFilesError(t("workdesk.signInRequired"))
        return
      }
      const res = await fetch(`/api/workdesk/files?thread_id=${encodeURIComponent(threadId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await safeJson(res)
      if (!res.ok) {
        throw new Error(errorMessageFromUpstream(data, res.statusText || "Error"))
      }
      const root = asRecord(data)
      const listRaw = root?.files
      const list = Array.isArray(listRaw) ? listRaw : []
      const normalized: WorkdeskFileItem[] = list
        .map((row) => {
          const r = asRecord(row) || {}
          const name = typeof r.name === "string" ? r.name : ""
          const path = typeof r.path === "string" ? r.path : name
          const size = typeof r.size === "number" ? r.size : null
          const source = typeof r.source === "string" ? r.source : undefined
          return { name: name || path, path, size, source }
        })
        .filter((x) => Boolean(x.path))
      setFiles(normalized)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setFiles([])
      setFilesError(msg)
    } finally {
      setFilesLoading(false)
    }
  }, [threadId, getToken, t])

  useEffect(() => {
    if (!isOpen) return
    refreshFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, threadId])

  useEffect(() => {
    if (!isOpen) return
    if (!autoPick) return
    if (!fileInputRef.current) return
    // Trigger file picker only from explicit user action (the "+" menu) that opened the Workdesk.
    fileInputRef.current.click()
    onAutoPickConsumed?.()
  }, [isOpen, autoPick, onAutoPickConsumed])

  const handlePickFiles = async (picked: File[]) => {
    const token = await getToken()
    if (!token) {
      toast.error(t("workdesk.signInRequired"))
      return
    }

    for (const file of picked) {
      try {
        setExtractingName(file.name)
        const base64 = await fileToBase64Data(file)
        const res = await fetch("/api/workdesk/extract-text", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            base64_data: base64,
            mime_type: file.type || undefined,
          }),
        })
        const data = await safeJson(res)
        if (!res.ok) throw new Error(errorMessageFromUpstream(data, res.statusText || "Error"))

        const root = asRecord(data)
        const content = typeof root?.content === "string" ? root.content : ""
        if (!content.trim()) {
          toast.error(t("workdesk.extractFailed"))
          continue
        }

        onQueueWorkspaceFile(file.name, content, file.size)
        toast.success(t("workdesk.queued"))
        if (!threadId) {
          toast.message(t("workdesk.queuedHint"))
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error("[Workdesk] extract failed", msg)
        toast.error(t("workdesk.extractFailed"))
      } finally {
        setExtractingName(null)
      }
    }
  }

  const onDownloadWorkspaceFile = async (path: string) => {
    const normalized = (path || "").toString().replace(/^\/+/, "").trim()
    const local = localContents && normalized ? localContents[normalized] : undefined
    if (typeof local === "string" && local.trim()) {
      const filename = normalized.split("/").filter(Boolean).pop() || "file.txt"
      downloadText(filename, local)
      return
    }
    if (!threadId) return
    try {
      const token = await getToken()
      if (!token) {
        toast.error(t("workdesk.signInRequired"))
        return
      }
      const res = await fetch(
        `/api/workdesk/files/content?thread_id=${encodeURIComponent(threadId)}&path=${encodeURIComponent(path)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const data = await safeJson(res)
      if (!res.ok) throw new Error(errorMessageFromUpstream(data, res.statusText || "Error"))

      const root = asRecord(data)
      const content = typeof root?.content === "string" ? root.content : ""
      if (!content) throw new Error("Empty content")
      const filename = path.split("/").filter(Boolean).pop() || "file.txt"
      downloadText(filename, content)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[Workdesk] download failed", msg)
      toast.error(t("workdesk.downloadFailed"))
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <SheetContent side="right" className="w-[360px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b space-y-1">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("workdesk.title")}
          </SheetTitle>
          <SheetDescription>{t("workdesk.subtitle")}</SheetDescription>
        </SheetHeader>

        <div className="p-3 border-b space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files ? Array.from(e.target.files) : []
              if (picked.length) {
                handlePickFiles(picked)
              }
              e.currentTarget.value = ""
            }}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              className="flex-1 flex items-center gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={Boolean(extractingName)}
            >
              <Upload className="h-4 w-4" />
              {t("workdesk.addDocuments")}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-10 w-10"
              onClick={() => refreshFiles()}
              aria-label={t("workdesk.refresh")}
              title={t("workdesk.refresh")}
              disabled={!ready || filesLoading}
            >
              {filesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>

          {!threadId ? <div className="text-xs text-muted-foreground">{t("workdesk.noThreadYet")}</div> : null}
          {extractingName ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="truncate">{t("workdesk.uploading").replace("{name}", extractingName)}</span>
            </div>
          ) : null}
          {filesError ? <div className="text-xs text-muted-foreground">{filesError}</div> : null}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {queuedFiles.length ? (
              <div className="space-y-2">
                {queuedFiles.map((f) => (
                  <div key={f.name} className="flex items-start justify-between gap-2 rounded-lg border p-3 overflow-hidden">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(f.size)}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveQueuedFile(f.name)}
                      aria-label={t("workdesk.remove")}
                      title={t("workdesk.remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground">{t("workdesk.queuedHint")}</div>
              </div>
            ) : null}

            {filesLoading ? null : mergedFileEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("workdesk.emptyDownloads")}</div>
            ) : (
              mergedFileEntries.map((f) => (
                <div key={f.path} className="flex items-start justify-between gap-2 rounded-lg border p-3 overflow-hidden">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {typeof f.size === "number" ? formatBytes(f.size) : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => onDownloadWorkspaceFile(f.path)}
                    aria-label={t("workdesk.download")}
                    title={t("workdesk.download")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

