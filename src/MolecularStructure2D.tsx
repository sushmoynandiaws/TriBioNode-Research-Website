import { useEffect, useState, useRef } from 'react'
import { asset } from './research'

const svgCache = new Map<string, string>()

function transformSvg(rawSvg: string): string {
  // Strip XML declaration, doctype, and HTML comments
  let cleaned = rawSvg
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()

  // Ensure svg has proper classes and preserve aspect ratio
  cleaned = cleaned.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    // Clean existing class or inject molecule-2d-svg
    const cleanAttrs = attrs
      .replace(/\bclass=['"][^'"]*['"]/gi, '')
      .replace(/\bwidth=['"][^'"]*['"]/gi, '')
      .replace(/\bheight=['"][^'"]*['"]/gi, '')
    return `<svg class="molecule-2d-svg" preserveAspectRatio="xMidYMid meet" ${cleanAttrs}>`
  })

  // Thicken bonds and assign animation indices
  let bondIdx = 0
  cleaned = cleaned.replace(/<path\s+class='(bond-[^']*)'([^>]*?)style='([^']*)'/g, (_match, cls, rest, style) => {
    const idx = bondIdx++
    const newStyle = style
      .replace(/stroke-width:\s*[\d.]+px/gi, 'stroke-width: 3.8px')
      .replace(/stroke-linecap:\s*\w+/gi, 'stroke-linecap: round')
      .replace(/stroke-linejoin:\s*\w+/gi, 'stroke-linejoin: round')
    return `<path class="molecule-bond ${cls}"${rest}style="${newStyle}; --bond-idx: ${idx};"`
  })

  // Tag atoms with animation indices
  let atomIdx = 0
  cleaned = cleaned.replace(/<path\s+class='(atom-[^']*)'/g, (_match, cls) => {
    const idx = atomIdx++
    return `<path class="molecule-atom ${cls}" style="--atom-idx: ${idx};"`
  })

  return cleaned
}

type Props = {
  structure: string
  name: string
  id: string
  replayCount?: number
}

export default function MolecularStructure2D({ structure, name, id, replayCount = 0 }: Props) {
  const [svgContent, setSvgContent] = useState<string | null>(() => svgCache.get(structure) ?? null)
  const [isAssembling, setIsAssembling] = useState(true)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    setIsAssembling(true)

    if (svgCache.has(structure)) {
      setSvgContent(svgCache.get(structure)!)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        if (active) setIsAssembling(false)
      }, 950)
      return
    }

    const controller = new AbortController()
    fetch(asset(structure), { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch SVG')
        return res.text()
      })
      .then(raw => {
        if (!active) return
        const transformed = transformSvg(raw)
        svgCache.set(structure, transformed)
        setSvgContent(transformed)
        if (timerRef.current) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => {
          if (active) setIsAssembling(false)
        }, 950)
      })
      .catch(() => {
        // Handled: fallback to img tag on error
      })

    return () => {
      active = false
      controller.abort()
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [structure, id, replayCount])

  if (!svgContent) {
    return (
      <img
        className="molecule-image"
        src={asset(structure)}
        alt={`RDKit 2D molecular structure of ${name}`}
        width="560"
        height="340"
      />
    )
  }

  return (
    <div
      key={`${id}-${replayCount}`}
      className={`molecule-2d-canvas ${isAssembling ? 'is-assembling' : ''}`}
      role="img"
      aria-label={`RDKit 2D molecular structure of ${name}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}

