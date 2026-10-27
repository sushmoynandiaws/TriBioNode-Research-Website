import { useEffect, useState, useRef } from 'react'
import { asset } from './research'

type Geometry = {
  atoms: { element: string; position: number[] }[]
  bonds: { start: number; end: number; order: number }[]
  method: string
}

const colors: Record<string, string> = {
  C: '#334e60',
  N: '#2872b8',
  O: '#c54e41',
  S: '#a77c13',
  Cl: '#37824b',
  F: '#37824b',
  Br: '#a64e30',
  P: '#a96520',
}

export default function ConformerViewer({ path, name }: { path: string | null; name: string }) {
  const [loaded, setLoaded] = useState<{ path: string; geometry: Geometry } | null>(null)
  const [error, setError] = useState(false)
  const [rotation, setRotation] = useState([0.3, -0.4])
  const [zoom, setZoom] = useState(1)
  const [drag, setDrag] = useState<number[] | null>(null)
  const [retry, setRetry] = useState(0)
  const [assemblyProgress, setAssemblyProgress] = useState(1)
  const [assemblyKey, setAssemblyKey] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    setError(false)
    fetch(asset(path), { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Conformer unavailable')
        return response.json() as Promise<Geometry>
      })
      .then(geometry => {
        if (!geometry.atoms?.length || !geometry.bonds || !geometry.method) throw new Error('Invalid conformer')
        setLoaded({ path, geometry })
        setRotation([0.3, -0.4])
        setZoom(1)
      })
      .catch(reason => {
        if (reason.name !== 'AbortError') setError(true)
      })
    return () => controller.abort()
  }, [path, retry])

  // Assembly motion from distance
  useEffect(() => {
    if (!loaded) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAssemblyProgress(1)
      return
    }

    setAssemblyProgress(0)
    const startTime = performance.now()
    const duration = 850 // ms

    const step = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(1, elapsed / duration)
      // Easing curve: smooth deceleration
      const eased = 1 - Math.pow(1 - t, 3)
      setAssemblyProgress(eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setAssemblyProgress(1)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [loaded?.path, assemblyKey])

  if (!path) return <p className="viewer-loading">A reliable 3D conformer is unavailable for this molecule. Its 2D structure and saved predictions are available.</p>
  if (error) return <div className="viewer-loading" role="alert"><p>The conformer could not be loaded.</p><button className="button compact secondary" onClick={() => setRetry(retry + 1)}>Retry 3D view</button></div>
  if (loaded?.path !== path) return <p className="viewer-loading" role="status">Loading molecular conformer…</p>

  const geometry = loaded.geometry
  const center = [0, 1, 2].map(axis => geometry.atoms.reduce((sum, a) => sum + a.position[axis], 0) / geometry.atoms.length)
  const centered = geometry.atoms.map(a => a.position.map((v, axis) => v - center[axis]))
  const size = Math.max(...centered.map(a => Math.hypot(...a)), 1)
  const scale = (112 / size) * zoom

  // Project atoms with arrival animation from distance
  const atomCount = geometry.atoms.length
  const projected = centered.map(([x, y, z], i) => {
    let curX = x
    let curY = y
    let curZ = z
    let radiusScale = 1
    let atomOpacity = 1

    if (assemblyProgress < 1) {
      const stagger = (i / atomCount) * 0.28
      const p = Math.max(0, Math.min(1, (assemblyProgress - stagger) / (1 - stagger)))
      const e = 1 - Math.pow(1 - p, 3)
      // Far in negative z and expanded outward
      const x0 = x * 1.7 + ((i % 5) - 2) * 16
      const y0 = y * 1.7 + ((i % 7) - 3) * 16
      const z0 = z - 280
      curX = x0 + (x - x0) * e
      curY = y0 + (y - y0) * e
      curZ = z0 + (z - z0) * e
      radiusScale = 0.25 + 0.75 * e
      atomOpacity = Math.min(1, p * 2.2)
    }

    const rx = curX * Math.cos(rotation[0]) + curZ * Math.sin(rotation[0])
    const rz = -curX * Math.sin(rotation[0]) + curZ * Math.cos(rotation[0])
    const ry = curY * Math.cos(rotation[1]) - rz * Math.sin(rotation[1])
    const depth = curY * Math.sin(rotation[1]) + rz * Math.cos(rotation[1])

    return {
      x: 280 + rx * scale,
      y: 150 + ry * scale,
      depth,
      index: i,
      element: geometry.atoms[i].element,
      radiusScale,
      opacity: atomOpacity,
    }
  })

  return (
    <div className="conformer-viewer">
      <svg
        viewBox="0 0 560 300"
        tabIndex={0}
        role="group"
        aria-label={`Interactive 3D conformer of ${name}. Drag to rotate, or focus here and use arrow keys.`}
        onKeyDown={e => {
          const directions: Record<string, number[]> = {
            ArrowLeft: [-0.15, 0],
            ArrowRight: [0.15, 0],
            ArrowUp: [0, -0.15],
            ArrowDown: [0, 0.15],
          }
          if (directions[e.key]) {
            e.preventDefault()
            setRotation(r => r.map((v, i) => v + directions[e.key][i]))
          }
        }}
        onPointerDown={e => {
          if (e.button === 0) {
            e.currentTarget.setPointerCapture(e.pointerId)
            setDrag([e.clientX, e.clientY])
          }
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onLostPointerCapture={() => setDrag(null)}
        onPointerMove={e => {
          if (!drag) return
          setRotation(r => [r[0] + (e.clientX - drag[0]) * 0.01, r[1] + (e.clientY - drag[1]) * 0.01])
          setDrag([e.clientX, e.clientY])
        }}
      >
        {/* Render thick, substantial connected bonds */}
        {geometry.bonds.map((bond, i) => {
          const a = projected[bond.start]
          const b = projected[bond.end]
          const bondOpacity = Math.min(a.opacity, b.opacity)
          if (bondOpacity <= 0.05) return null

          const baseWidth = bond.order > 2 ? 8.5 : bond.order > 1 ? 7.0 : 4.8
          const strokeWidth = Math.max(1.5, baseWidth * Math.min(1, bondOpacity * 1.3))

          return (
            <g key={i} opacity={bondOpacity}>
              <line
                x1={a.x}
                x2={b.x}
                y1={a.y}
                y2={b.y}
                stroke="var(--control-border)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              {bond.order > 1 && (
                <line
                  x1={a.x}
                  x2={b.x}
                  y1={a.y}
                  y2={b.y}
                  stroke="var(--surface)"
                  strokeWidth={bond.order > 2 ? 3 : 2.2}
                  strokeLinecap="round"
                />
              )}
            </g>
          )
        })}

        {/* Render atom spheres sorted by depth */}
        {[...projected]
          .sort((a, b) => a.depth - b.depth)
          .map(a => (
            <g key={a.index} opacity={a.opacity}>
              <circle
                cx={a.x}
                cy={a.y}
                r={(a.element === 'C' ? 8.5 : 11.5) * a.radiusScale}
                fill={colors[a.element] ?? '#735c96'}
                stroke="var(--surface)"
                strokeWidth="1.8"
              />
              <text
                x={a.x}
                y={a.y + 3}
                textAnchor="middle"
                fontSize={a.element.length > 1 ? '7.5' : '8.5'}
                fontWeight="700"
                fill="var(--surface)"
              >
                {a.element}
              </text>
            </g>
          ))}
      </svg>
      <div className="conformer-controls">
        <span>Drag or use arrow keys to rotate</span>
        <label>
          Zoom
          <input
            aria-label="3D conformer zoom"
            type="range"
            min="0.65"
            max="1.5"
            step="0.05"
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
          />
        </label>
        <button
          className="text-button"
          onClick={() => setAssemblyKey(k => k + 1)}
          title="Replay molecular assembly motion from distance"
          aria-label="Replay molecular assembly"
        >
          ↺ Assemble
        </button>
        <button
          className="text-button"
          onClick={() => {
            setRotation([0.3, -0.4])
            setZoom(1)
          }}
        >
          Reset view
        </button>
      </div>
      <p className="micro conformer-note">
        {geometry.method}. Fresh visualization conformer; not the original training geometry.
      </p>
    </div>
  )
}
