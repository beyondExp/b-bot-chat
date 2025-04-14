import { Suspense } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { AuthGuard } from "@/components/auth-guard"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <AuthGuard>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <ChatInterface />
        </Suspense>
      </AuthGuard>
    </main>
  )
}
