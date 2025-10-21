import { Suspense } from "react"
import { EmbedClientPage } from "@/components/embed-client-page"
import "./embed.css"

export default function EmbedPage() {
  return (
    <>
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <EmbedClientPage />
      </Suspense>
    </>
  )
}
