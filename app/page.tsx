import { Suspense } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { AuthGuard } from "@/components/auth-guard"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <AuthGuard>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <ClientPage />
        </Suspense>
      </AuthGuard>
    </main>
  )
}

// Client component that handles URL parameters
function ClientPage() {
  // Get agent from URL query parameters using useSearchParams
  // This is now safely wrapped in a client component inside a Suspense boundary
  const searchParams = useSearchParams()
  const agentFromUrl = searchParams?.get("agent")

  return <ChatInterface initialAgent={agentFromUrl} />
}
// Add the missing import
;("use client")
import { useSearchParams } from "next/navigation"
