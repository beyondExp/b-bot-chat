import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const url =
    process.env.MAIN_AGENT_LOGO_URL ||
    process.env.NEXT_PUBLIC_MAIN_AGENT_LOGO_URL ||
    "https://beyond-bot.ai/logo-schwarz.svg"

  return NextResponse.redirect(new URL(url, req.url), { status: 307 })
}

