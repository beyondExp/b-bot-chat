import { Suspense } from "react"
import { ClientPage } from "@/components/client-page"

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ClientPage />
    </Suspense>
  )
}
