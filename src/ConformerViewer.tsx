import Icon from './Icon'
import { useEffect, useState, useRef, useId, useMemo } from 'react'
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
  const atomGradient = useId()
  const [loaded, setLoaded] = useState<{ path: string; geometry: Geometry } | null>(null)
  const [error, setError] = useState(false)
  const [rotation, setRotation] = useState([0.3, -0.4])
  const [zoom, setZoom] = useState(1)
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null)
  const [retry, setRetry] = useState(0)
  const [assemblyKey, setAssemblyKey] = useState(0)
  const model = useRef<SVGGElement>(null)
  const animations = useRef<Animation[]>([])
  const lastReplay = useRef(0)

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

  function settleAssembly() {
    animations.current.forEach(animation => animation.cancel())
    animations.current = []
  }

  useEffect(() => {
    const replay = lastReplay.current !== assemblyKey
    lastReplay.current = assemblyKey
    const root = model.current
    if (loaded?.path !== path || !root || !replay) return
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const settleIfNeeded = () => { if (preference.matches || document.hidden) settleAssembly() }
    if (!preference.matches && !document.hidden) {
      // Predetermined replay runs outside React; coordinates remain scientifically stable.
      animations.current = [root.animate([
        { transform: 'translateY(4px) scale(0.97)', opacity: .3 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })]
      root.querySelectorAll<SVGGElement>('.conformer-bonds, .conformer-atoms').forEach((group, index) => {
        animations.current.push(group.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 180, delay: index * 60, fill: 'backwards', easing: 'ease-out' }))
      })
    }
    preference.addEventListener('change', settleIfNeeded)
    document.addEventListener('visibilitychange', settleIfNeeded)
    return () => {
      settleAssembly()
      preference.removeEventListener('change', settleIfNeeded)
      document.removeEventListener('visibilitychange', settleIfNeeded)
    }
  }, [loaded, path, assemblyKey])

  const centered = useMemo(() => {
    if (!loaded) return []
    const center = [0, 1, 2].map(axis => loaded.geometry.atoms.reduce((sum, atom) => sum + atom.position[axis], 0) / loaded.geometry.atoms.length)
    return loaded.geometry.atoms.map(atom => atom.position.map((value, axis) => value - center[axis]))
  }, [loaded])

  if (!path) return <p className="viewer-loading">A reliable 3D conformer is unavailable for this molecule. Its 2D structure and saved predictions are available.</p>
  if (error) return <div className="viewer-loading" role="alert"><p>The conformer could not be loaded.</p><button className="button compact secondary" onClick={() => setRetry(retry + 1)}>Retry 3D view</button></div>
  if (loaded?.path !== path) return <p className="viewer-loading" role="status">Loading molecular conformer…</p>

  const geometry = loaded.geometry
  const size = Math.max(...centered.map(a => Math.hypot(...a)), 1)
  const scale = (112 / size) * zoom

  const projected = centered.map(([x, y, z], i) => {
    const rx = x * Math.cos(rotation[0]) + z * Math.sin(rotation[0])
    const rz = -x * Math.sin(rotation[0]) + z * Math.cos(rotation[0])
    const ry = y * Math.cos(rotation[1]) - rz * Math.sin(rotation[1])
    const depth = y * Math.sin(rotation[1]) + rz * Math.cos(rotation[1])

    return {
      x: 280 + rx * scale,
      y: 150 + ry * scale,
      depth,
      index: i,
      element: geometry.atoms[i].element,
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
            settleAssembly()
            setRotation(r => r.map((v, i) => v + directions[e.key][i]))
          }
        }}
        onPointerDown={e => {
          if (e.button === 0 && !drag.current) {
            settleAssembly()
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY }
          }
        }}
        onPointerUp={e => { if (drag.current?.pointer === e.pointerId) drag.current = null }}
        onPointerCancel={e => { if (drag.current?.pointer === e.pointerId) drag.current = null }}
        onLostPointerCapture={e => { if (drag.current?.pointer === e.pointerId) drag.current = null }}
        onPointerMove={e => {
          const previous = drag.current
          if (previous?.pointer !== e.pointerId) return
          setRotation(r => [r[0] + (e.clientX - previous.x) * 0.01, r[1] + (e.clientY - previous.y) * 0.01])
          drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY }
        }}
      >
        <defs>
          {Object.entries(colors).map(([element, color]) => <radialGradient key={element} id={`${atomGradient}-${element}`} cx="30%" cy="25%" r="80%">
            <stop offset="0" stopColor="var(--surface)" />
            <stop offset=".35" stopColor={color} />
            <stop offset="1" stopColor="var(--text)" />
          </radialGradient>)}
        </defs>
        <g ref={model} className="conformer-model">
        <g className="conformer-bonds">
        {geometry.bonds.map((bond, i) => {
          const a = projected[bond.start]
          const b = projected[bond.end]
          const strokeWidth = bond.order > 2 ? 8.5 : bond.order > 1 ? 7.0 : 4.8

          return (
            <g key={i} opacity="1">
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

        </g>
        <g className="conformer-atoms">
        {[...projected]
          .sort((a, b) => a.depth - b.depth)
          .map(a => (
            <g key={a.index} opacity="1">
              <circle
                cx={a.x}
                cy={a.y}
                r={a.element === 'C' ? 8.5 : 11.5}
                fill={colors[a.element] ? `url(#${atomGradient}-${a.element})` : '#735c96'}
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
        </g>
        </g>
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
            onChange={e => { settleAssembly(); setZoom(Number(e.target.value)) }}
          />
        </label>
        <button
          className="text-button"
          onClick={() => setAssemblyKey(k => k + 1)}
          title="Replay molecular assembly"
          aria-label="Replay molecular assembly"
        >
          <Icon name="replay" /> Replay assembly
        </button>
        <button
          className="text-button"
          onClick={() => {
            settleAssembly()
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
