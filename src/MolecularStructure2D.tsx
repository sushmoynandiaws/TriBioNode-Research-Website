import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  cleaned = cleaned.replace(/<path\s+class='(bond-[^']*)'([^>]*?)style='([^']*)'/g, (_match, cls, rest, style) => {
    const index = /bond-(\d+)/.exec(cls)![1]
    const newStyle = style
      .replace(/stroke-width:\s*[\d.]+px/gi, 'stroke-width: 3.8px')
      .replace(/stroke-linecap:\s*\w+/gi, 'stroke-linecap: round')
      .replace(/stroke-linejoin:\s*\w+/gi, 'stroke-linejoin: round')
    return `<path class="molecule-bond ${cls}" data-assembly-index="${index}" pathLength="1"${rest}style="${newStyle}"`
  })

  // Tag atoms with animation indices
  cleaned = cleaned.replace(/<path\s+class='(atom-[^']*)'/g, (_match, cls) => {
    const index = /atom-(\d+)/.exec(cls)![1]
    return `<path class="molecule-atom ${cls}" data-assembly-index="${index}"`
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
  const [loaded, setLoaded] = useState(() => ({ structure, svg: svgCache.get(structure) ?? null }))
  const [failed, setFailed] = useState<string | null>(null)
  const [isAssembling, setIsAssembling] = useState(false)
  const canvas = useRef<HTMLDivElement>(null)
  const lastReplay = useRef(replayCount)

  useEffect(() => {
    if (svgCache.has(structure)) {
      const svg = svgCache.get(structure)!
      setLoaded(current => current.structure === structure && current.svg === svg ? current : { structure, svg })
      return
    }
    let active = true
    setFailed(null)
    const controller = new AbortController()
    fetch(asset(structure), { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch SVG')
        return response.text()
      })
      .then(raw => {
        if (!active) return
        const svg = transformSvg(raw)
        svgCache.set(structure, svg)
        setLoaded({ structure, svg })
      })
      .catch(() => { if (active) setFailed(structure) })
    return () => { active = false; controller.abort() }
  }, [structure, replayCount])

  useLayoutEffect(() => {
    const root = canvas.current
    if (!root || loaded.structure !== structure || !loaded.svg) return
    const manual = lastReplay.current !== replayCount
    lastReplay.current = replayCount
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    let active = true, started = false, visible = false
    let animations: Animation[] = []
    setIsAssembling(false)
    const settle = () => {
      root.removeAttribute('data-assembly-pending')
      animations.forEach(animation => animation.cancel())
      if (active) setIsAssembling(false)
    }
    const start = () => {
      if (started || document.hidden) return
      started = true
      root.removeAttribute('data-assembly-pending')
      setIsAssembling(true)
      const bonds = [...root.querySelectorAll<SVGPathElement>('.molecule-bond')]
      const atoms = [...root.querySelectorAll<SVGPathElement>('.molecule-atom')]
      const maxBond = Math.max(1, ...bonds.map(path => Number(path.dataset.assemblyIndex)))
      const maxAtom = Math.max(1, ...atoms.map(path => Number(path.dataset.assemblyIndex)))
      // Finite bond drawing explains assembly; keep repainting confined to this small SVG.
      animations = bonds.map(path => path.animate(preference.matches
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ strokeDasharray: '1', strokeDashoffset: '1', opacity: 0 }, { strokeDasharray: '1', strokeDashoffset: '0', opacity: 1 }],
      { duration: 520, delay: Number(path.dataset.assemblyIndex) / maxBond * 600, fill: 'backwards', easing: 'linear' }))
      animations.push(...atoms.map(path => path.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: 220, delay: 180 + Number(path.dataset.assemblyIndex) / maxAtom * 600, fill: 'backwards', easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })))
      Promise.all(animations.map(animation => animation.finished)).then(() => { if (active) settle() }).catch(() => {})
    }
    const sync = () => {
      if (document.hidden && started) settle()
      else if (visible && !started && !preference.matches) start()
    }
    const motionChange = () => { if (preference.matches) { started = true; settle() } }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .35
      if (!visible && started) settle()
      else sync()
    }, { threshold: [0, .35] })
    if (manual) {
      root.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      start()
    } else if (!preference.matches) {
      root.setAttribute('data-assembly-pending', 'true')
      observer.observe(root)
    }
    preference.addEventListener('change', motionChange)
    document.addEventListener('visibilitychange', sync)
    return () => {
      active = false
      observer.disconnect()
      preference.removeEventListener('change', motionChange)
      document.removeEventListener('visibilitychange', sync)
      settle()
    }
  }, [loaded, structure, replayCount])

  if (loaded.structure !== structure || !loaded.svg) {
    return failed === structure
      ? <img className="molecule-image" src={asset(structure)} alt={`RDKit 2D molecular structure of ${name}`} width="560" height="340" />
      : <div className="molecule-2d-canvas" role="status">Loading molecular structure…</div>
  }

  return (
    <div
      key={id}
      ref={canvas}
      className={`molecule-2d-canvas ${isAssembling ? 'is-assembling' : ''}`}
      role="img"
      aria-label={`RDKit 2D molecular structure of ${name}`}
      dangerouslySetInnerHTML={{ __html: loaded.svg }}
    />
  )
}
