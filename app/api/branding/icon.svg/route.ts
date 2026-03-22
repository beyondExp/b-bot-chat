import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const url =
    process.env.APP_LOGO_URL ||
    process.env.NEXT_PUBLIC_APP_LOGO_URL ||
    "https://beyond-bot.ai/logo-schwarz.svg"

  // Redirect so the icon is always runtime-configurable via env vars.
  return NextResponse.redirect(new URL(url, req.url), { status: 307 })
}

