"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Please try again — if the problem persists, contact
        support@beyond-bot.ai{error.digest ? ` and mention error ${error.digest}` : ""}.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-lg border border-border px-5 py-2.5 font-medium transition-colors hover:bg-muted"
        >
          Back to chat
        </a>
      </div>
    </div>
  )
}
