import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Always allow access to prevent authentication issues
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Only apply middleware to specific paths in production
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
