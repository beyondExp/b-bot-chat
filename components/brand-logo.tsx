"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { fetchBranding } from "@/lib/branding"

type Props = {
  alt: string
  size: number
  className?: string
}

export function BrandLogo({ alt, size, className }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const b = await fetchBranding()
      if (mounted) setUrl(b.appLogoUrl)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <Image
      src={url || "/logo.svg"}
      alt={alt}
      width={size}
      height={size}
      className={className}
      unoptimized
    />
  )
}

