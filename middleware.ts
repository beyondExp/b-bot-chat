import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add CORS headers for the embed route
  if (request.nextUrl.pathname.startsWith("/embed")) {
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  }

  return response
}

export const config = {
  matcher: ["/embed/:path*", "/api/:path*"],
}
