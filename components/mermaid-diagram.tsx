"use client"

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

interface MermaidDiagramProps {
  chart: string
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)

  useEffect(() => {
    if (containerRef.current && isScriptLoaded) {
      // @ts-ignore - mermaid is loaded via script
      const mermaid = window.mermaid
      if (mermaid) {
        mermaid.initialize({
          startOnLoad: true,
          theme: 'default',
          securityLevel: 'loose',
        })

        mermaid.render('mermaid-diagram', chart).then(({ svg }: { svg: string }) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = svg
          }
        }).catch((error: Error) => {
          console.error('Error rendering Mermaid diagram:', error)
          if (containerRef.current) {
            containerRef.current.innerHTML = 'Error rendering diagram'
          }
        })
      }
    }
  }, [chart, isScriptLoaded])

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"
        onLoad={() => setIsScriptLoaded(true)}
      />
      <div ref={containerRef} className="mermaid-diagram" />
    </>
  )
} 