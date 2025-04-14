import { ChatInterface } from "@/components/chat-interface"
import { AuthGuard } from "@/components/auth-guard"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <AuthGuard>
        <ChatInterface />
      </AuthGuard>
    </main>
  )
}
