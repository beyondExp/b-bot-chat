import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // API routes and auth/embed surfaces must not be crawled.
        disallow: ["/api/", "/auth/", "/embed", "/account"],
      },
    ],
  }
}
