import { expect, test } from '@playwright/test'

test('input optical sweep progresses once without a four-second reset', async () => {
  const { inputScanAngle } = await import(new URL('../design/architecture-film/film.js', import.meta.url).href)
  const angles = Array.from({ length: 181 }, (_, frame) => Number(inputScanAngle(frame / 30)))
  for (let frame = 1; frame < angles.length; frame++) {
    expect(angles[frame] - angles[frame - 1]).toBeGreaterThanOrEqual(0)
    expect(angles[frame] - angles[frame - 1]).toBeLessThan(.05)
  }
  expect(inputScanAngle(4) - inputScanAngle(3.999)).toBeLessThan(.002)
  expect(inputScanAngle(5)).toBe(inputScanAngle(6))
})

test('every prediction source sends a complete signal before the next layer starts', async () => {
  const { predictionSignal } = await import(new URL('../design/architecture-film/film.js', import.meta.url).href)
  const sources = [6, 5, 3]
  for (const [layer, count] of sources.entries()) {
    const allStarted = 30.3 + layer * 1.65 + (count - 1) * .04 + .01
    for (let source = 0; source < count; source++) {
      const start = 30.3 + layer * 1.65 + source * .04
      expect(predictionSignal(start, layer, source)).toBeCloseTo(0, 8)
      expect(predictionSignal(start + 1.15, layer, source)).toBeCloseTo(1, 8)
      expect(predictionSignal(allStarted, layer, source)).toBeGreaterThan(0)
      expect(predictionSignal(allStarted, layer, source)).toBeLessThan(1)
      expect(predictionSignal(36, layer, source)).toBeGreaterThan(1)
      if (layer < 2) expect(start + 1.15).toBeLessThan(30.3 + (layer + 1) * 1.65)
    }
  }
})

test('fusion uses separate nested lanes in both orientations and the film ends at forty seconds', async () => {
  const { fusionConnector, DURATION } = await import(new URL('../design/architecture-film/film.js', import.meta.url).href)
  const { Vector3 } = await import(new URL('../public/vendor/three/three.module.js', import.meta.url).href)
  expect(DURATION).toBe(40)
  const turn = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  for (const portrait of [false, true]) {
    const paths = []
    for (let view = 0; view < 3; view++) for (const side of [-1, 1]) {
      const source = new Vector3(0, 2.8 - view * .75, 0)
      const gate = [.0272, .011, .9618][view]
      const targetY = side < 0 ? (.25 + gate * 1.35) * .5 * (portrait ? .7 : 1) + .1 : .6 * (portrait ? .7 : 1)
      const target = new Vector3(side * ((portrait ? 1.55 : 3.7) + (1 - view) * (portrait ? .63 : .9)), targetY, 0)
      const points = fusionConnector(source, target).getPoints(80)
      expect(points[0].x).toBeCloseTo(side * .64, 8)
      expect(points[points.length - 1].distanceTo(target)).toBeLessThan(1e-8)
      for (const point of points) {
        expect(point.y).toBeLessThanOrEqual(source.y + 1e-8)
        expect(point.y).toBeGreaterThanOrEqual(target.y - 1e-8)
        expect(point.x * side).toBeGreaterThanOrEqual(.64 - 1e-8)
        expect(point.x * side).toBeLessThanOrEqual(target.x * side + 1e-8)
      }
      paths.push(points)
    }
    for (const [index, path] of paths.entries()) for (const other of paths.slice(index + 1)) {
      const crossing = path.some((b: { x: number; y: number }, i: number) => i && other.some((d: { x: number; y: number }, j: number) => j && turn(path[i - 1], b, other[j - 1]) * turn(path[i - 1], b, d) < 0 && turn(other[j - 1], d, path[i - 1]) * turn(other[j - 1], d, b) < 0))
      expect(crossing).toBe(false)
    }
  }
})
