import { useEffect, useRef, useState } from 'react'
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

  // Keep the whole assembly within one timing budget, even for large structures.
  return cleaned
    .replace(/--bond-idx: (\d+);/g, (_, index) => `--bond-delay: ${(Number(index) * 80 / Math.max(1, bondIdx - 1)).toFixed(1)}ms;`)
    .replace(/--atom-idx: (\d+);/g, (_, index) => `--atom-delay: ${(40 + Number(index) * 80 / Math.max(1, atomIdx - 1)).toFixed(1)}ms;`)
}

type Props = {
  structure: string
  name: string
  id: string
  replayCount?: number
}

export default function MolecularStructure2D({ structure, name, id, replayCount = 0 }: Props) {
  const [loaded, setLoaded] = useState(() => ({ structure, svg: svgCache.get(structure) ?? null }))
  const [isAssembling, setIsAssembling] = useState(false)
  const lastReplay = useRef(replayCount)

  useEffect(() => {
    let active = true
    const replay = lastReplay.current !== replayCount
    lastReplay.current = replayCount
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const settle = () => { if (preference.matches) setIsAssembling(false) }
    preference.addEventListener('change', settle)
    const show = (svg: string) => {
      setLoaded({ structure, svg })
      setIsAssembling(replay && !preference.matches)
    }
    const controller = new AbortController()

    if (svgCache.has(structure)) {
      show(svgCache.get(structure)!)
    } else fetch(asset(structure), { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch SVG')
        return res.text()
      })
      .then(raw => {
        if (!active) return
        const transformed = transformSvg(raw)
        svgCache.set(structure, transformed)
        show(transformed)
      })
      .catch(() => {
        // Handled: fallback to img tag on error
      })

    return () => {
      active = false
      controller.abort()
      preference.removeEventListener('change', settle)
    }
  }, [structure, id, replayCount])

  if (loaded.structure !== structure || !loaded.svg) {
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
      onAnimationEnd={event => { if (event.animationName === 'molecule2dEntrance') setIsAssembling(false) }}
      dangerouslySetInnerHTML={{ __html: loaded.svg }}
    />
  )
}

