import { useEffect, useState } from 'react'
import { asset } from './research'

type Geometry = {
  atoms: { element: string; position: number[] }[]
  bonds: { start: number; end: number; order: number }[]
  method: string
}
const colors: Record<string, string> = { C: '#334e60', N: '#2872b8', O: '#c54e41', S: '#a77c13', Cl: '#37824b', F: '#37824b', Br: '#a64e30', P: '#a96520' }

export default function ConformerViewer({ path, name }: { path: string | null; name: string }) {
  const [loaded, setLoaded] = useState<{ path: string; geometry: Geometry } | null>(null)
  const [error, setError] = useState(false)
  const [rotation, setRotation] = useState([0.3, -0.4])
  const [zoom, setZoom] = useState(1)
  const [drag, setDrag] = useState<number[] | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    setError(false)
    fetch(asset(path), { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Conformer unavailable')
      return response.json() as Promise<Geometry>
    }).then(geometry => {
      if (!geometry.atoms?.length || !geometry.bonds || !geometry.method) throw new Error('Invalid conformer')
      setLoaded({ path, geometry })
      setRotation([0.3, -0.4])
      setZoom(1)
    }).catch(reason => {
      if (reason.name !== 'AbortError') setError(true)
    })
    return () => controller.abort()
  }, [path, retry])
  if (!path) return <p className="viewer-loading">A reliable 3D conformer is unavailable for this molecule. Its 2D structure and saved predictions are available.</p>
  if (error) return <div className="viewer-loading" role="alert"><p>The conformer could not be loaded.</p><button className="button compact secondary" onClick={() => setRetry(retry + 1)}>Retry 3D view</button></div>
  if (loaded?.path !== path) return <p className="viewer-loading" role="status">Loading molecular conformer…</p>
  const geometry = loaded.geometry
  const center = [0, 1, 2].map(axis => geometry.atoms.reduce((sum, a) => sum + a.position[axis], 0) / geometry.atoms.length)
  const centered = geometry.atoms.map(a => a.position.map((v, axis) => v - center[axis]))
  const size = Math.max(...centered.map(a => Math.hypot(...a)), 1)
  const scale = 112 / size * zoom
  const projected = centered.map(([x, y, z], i) => {
    const rx = x * Math.cos(rotation[0]) + z * Math.sin(rotation[0])
    const rz = -x * Math.sin(rotation[0]) + z * Math.cos(rotation[0])
    const ry = y * Math.cos(rotation[1]) - rz * Math.sin(rotation[1])
    const depth = y * Math.sin(rotation[1]) + rz * Math.cos(rotation[1])
    return { x: 280 + rx * scale, y: 150 + ry * scale, depth, index: i, element: geometry.atoms[i].element }
  })
  return <div className="conformer-viewer"><svg viewBox="0 0 560 300" tabIndex={0} role="group" aria-label={`Interactive 3D conformer of ${name}. Drag to rotate, or focus here and use arrow keys.`} onKeyDown={e => {
    const directions: Record<string, number[]> = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }
    if (directions[e.key]) {
      e.preventDefault()
      setRotation(r => r.map((v, i) => v + directions[e.key][i]))
    }
  }} onPointerDown={e => { if (e.button === 0) { e.currentTarget.setPointerCapture(e.pointerId); setDrag([e.clientX, e.clientY]) } }} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)} onLostPointerCapture={() => setDrag(null)} onPointerMove={e => {
    if (!drag) return
    setRotation(r => [r[0] + (e.clientX - drag[0]) * 0.01, r[1] + (e.clientY - drag[1]) * 0.01])
    setDrag([e.clientX, e.clientY])
  }}>
    {geometry.bonds.map((bond, i) => {
      const a = projected[bond.start]
      const b = projected[bond.end]
      return <g key={i}><line x1={a.x} x2={b.x} y1={a.y} y2={b.y} stroke="#91a7ad" strokeWidth={bond.order > 1 ? 4 : 2.5} strokeLinecap="round" />{bond.order > 1 && <line x1={a.x} x2={b.x} y1={a.y} y2={b.y} stroke="#f8faf8" strokeWidth="1" />}</g>
    })}
    {[...projected].sort((a, b) => a.depth - b.depth).map(a => <g key={a.index}><circle cx={a.x} cy={a.y} r={a.element === 'C' ? 7 : 10} fill={colors[a.element] ?? '#735c96'} stroke="white" strokeWidth="1.5" /><text x={a.x} y={a.y + 3} textAnchor="middle" fontSize={a.element.length > 1 ? '7' : '8'} fontWeight="700" fill="white">{a.element}</text></g>)}
  </svg><div className="conformer-controls"><span>Drag or use arrow keys to rotate</span><label>Zoom<input aria-label="3D conformer zoom" type="range" min="0.65" max="1.5" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label><button className="text-button" onClick={() => { setRotation([0.3, -0.4]); setZoom(1) }}>Reset view</button></div><p className="micro conformer-note">{geometry.method}. Fresh visualization conformer; not the original training geometry.</p></div>
}
