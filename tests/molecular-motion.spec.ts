import { test, expect } from '@playwright/test'

test.describe('Molecular structure motion & thick connected bonds', () => {
  test('2D molecular structure features thicker bonds and assembly entrance animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/#explorer')
    const explorer = page.locator('#explorer')
    await expect(explorer).toBeVisible()

    // 2D canvas rendered with SVG
    const canvas = page.locator('.molecule-2d-canvas')
    await expect(canvas).toBeVisible()

    // Bonds have thickened stroke-width
    const bonds = canvas.locator('.molecule-bond')
    await expect(bonds.first()).toBeVisible()
    const bondCount = await bonds.count()
    expect(bondCount).toBeGreaterThan(10)

    const bondStyle = await bonds.first().getAttribute('style')
    expect(bondStyle).toMatch(/stroke-width:\s*3\.8px/i)

    // Assemble button exists with >= 44px touch target
    const assembleBtn = page.getByRole('button', { name: 'Replay molecular assembly animation' })
    await expect(assembleBtn).toBeVisible()
    const btnBox = await assembleBtn.boundingBox()
    expect(btnBox!.height).toBeGreaterThanOrEqual(43.5)

    // Clicking assemble triggers assembly state
    await assembleBtn.click()
    await expect(canvas).toHaveClass(/is-assembling/)

    // Screenshot 2D assembled molecule
    await page.waitForTimeout(600)
    await page.locator('.structure-panel').screenshot({ path: 'artifacts/molecular-2d-structure.png' })
  })

  test('3D conformer viewer features thicker bonds and bounded assembly motion', async ({ page }) => {
    await page.goto('/#explorer')
    await page.getByRole('button', { name: '3D', exact: true }).click()

    const viewer = page.getByRole('group', { name: /Interactive 3D conformer/ })
    await expect(viewer).toBeVisible()

    // Bonds have thick strokes
    await expect(viewer.locator('radialGradient')).toHaveCount(8)
    const lines = viewer.locator('line')
    await expect(lines.first()).toBeVisible()
    const lineCount = await lines.count()
    expect(lineCount).toBeGreaterThan(10)

    const firstWidth = await lines.first().getAttribute('stroke-width')
    expect(Number(firstWidth)).toBeGreaterThanOrEqual(4.5)

    // Assemble button inside conformer-controls
    const conformerAssembleBtn = page.getByRole('button', { name: 'Replay molecular assembly', exact: true })
    await expect(conformerAssembleBtn).toBeVisible()
    await conformerAssembleBtn.click()

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const iconBox = await conformerAssembleBtn.locator('svg').boundingBox()
      expect(iconBox!.width).toBe(18)
      expect(iconBox!.height).toBe(18)
      expect((await conformerAssembleBtn.boundingBox())!.height).toBeLessThanOrEqual(60)
      if (width !== 320) await page.locator('.structure-panel').screenshot({ path: `artifacts/motion-polish-conformer-${width}.png` })
    }

    // Screenshot 3D assembled conformer
    await page.waitForTimeout(600)
    await page.locator('.structure-panel').screenshot({ path: 'artifacts/molecular-3d-structure.png' })
  })

  test('large 2D structures finish every bond before the assembly settles', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/#explorer')
    await page.getByRole('button', { name: /^ESOL 077 / }).click()
    const canvas = page.locator('.molecule-2d-canvas')
    await expect(canvas.locator('.molecule-bond').first()).toBeVisible()
    await expect(canvas).not.toHaveClass(/is-assembling/)
    await page.getByRole('button', { name: 'Replay molecular assembly animation' }).click()
    const timings = await canvas.evaluate(element => {
      const animationEnd = (node: Element) => {
        const style = getComputedStyle(node)
        return (parseFloat(style.animationDuration) + parseFloat(style.animationDelay)) * 1000
      }
      return { entrance: animationEnd(element.querySelector('svg')!), latestPart: Math.max(...[...element.querySelectorAll('.molecule-bond, .molecule-atom')].map(animationEnd)) }
    })
    expect(timings.latestPart).toBeLessThanOrEqual(timings.entrance)
    expect(timings.entrance).toBeLessThan(300)
    await expect(canvas).not.toHaveClass(/is-assembling/)
    await expect(canvas.locator('.molecule-bond').last()).toHaveCSS('opacity', '1')
    await page.getByRole('button', { name: 'Replay molecular assembly animation' }).click()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(canvas).not.toHaveClass(/is-assembling/)
    await page.getByRole('button', { name: 'Replay molecular assembly animation' }).click()
    await expect(canvas).not.toHaveClass(/is-assembling/)
  })

  test('3D replay animates without per-frame geometry writes and yields immediately to input', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/#explorer')
    await page.getByRole('button', { name: '3D', exact: true }).click()
    const viewer = page.getByRole('group', { name: /Interactive 3D conformer/ })
    await expect(viewer.locator('circle').first()).toBeVisible()
    expect(await viewer.evaluate(svg => svg.getAnimations({ subtree: true }).length)).toBe(0)
    const [motion] = await Promise.all([
      viewer.evaluate(svg => new Promise<{ geometryWrites: number; animations: number }>(resolve => {
        let geometryWrites = 0, animations = 0
        const observer = new MutationObserver(records => { geometryWrites += records.filter(record => ['cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2'].includes(record.attributeName ?? '')).length })
        observer.observe(svg, { attributes: true, subtree: true })
        const start = performance.now()
        const sample = () => {
          animations = Math.max(animations, svg.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)
          if (performance.now() - start < 450) requestAnimationFrame(sample)
          else { observer.disconnect(); resolve({ geometryWrites, animations }) }
        }
        sample()
      })),
      page.getByRole('button', { name: 'Replay molecular assembly', exact: true }).click(),
    ])
    expect(motion.animations).toBe(3)
    expect(motion.geometryWrites).toBe(0)
    await page.getByRole('button', { name: 'Replay molecular assembly', exact: true }).click()
    await viewer.press('ArrowRight')
    expect(await viewer.evaluate(svg => svg.getAnimations({ subtree: true }).length)).toBe(0)
    const box = await viewer.boundingBox()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    const before = await viewer.locator('circle').first().getAttribute('cx')
    await viewer.dispatchEvent('pointerdown', { pointerId: 2, button: 0, clientX: 10, clientY: 10 })
    await viewer.dispatchEvent('pointermove', { pointerId: 2, clientX: 100, clientY: 100 })
    await viewer.dispatchEvent('pointerup', { pointerId: 2 })
    expect(await viewer.locator('circle').first().getAttribute('cx')).toBe(before)
    await page.mouse.move(box!.x + box!.width / 2 + 30, box!.y + box!.height / 2)
    expect(await viewer.locator('circle').first().getAttribute('cx')).not.toBe(before)
    await page.mouse.up()
  })

  test('3D assembly stays within its viewport and reduced motion settles it immediately', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/#explorer')
    await page.getByRole('button', { name: '3D', exact: true }).click()
    const viewer = page.getByRole('group', { name: /Interactive 3D conformer/ })
    await expect(viewer).toBeVisible()
    await page.getByRole('button', { name: 'Replay molecular assembly', exact: true }).click()
    const frames = await viewer.evaluate(svg => new Promise<{ outside: number; samples: number }>(resolve => {
      const start = performance.now()
      let outside = 0, samples = 0
      const sample = () => {
        for (const circle of svg.querySelectorAll('circle')) {
          if (Number(circle.parentElement?.getAttribute('opacity')) < .05) continue
          const x = Number(circle.getAttribute('cx')), y = Number(circle.getAttribute('cy')), r = Number(circle.getAttribute('r'))
          if (x - r < 0 || x + r > 560 || y - r < 0 || y + r > 300) outside++
        }
        samples++
        if (performance.now() - start < 900) requestAnimationFrame(sample)
        else resolve({ outside, samples })
      }
      sample()
    }))
    expect(frames.samples).toBeGreaterThan(10)
    expect(frames.outside).toBe(0)
    await page.getByRole('button', { name: 'Replay molecular assembly', exact: true }).click()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect.poll(() => viewer.locator('circle').evaluateAll(circles => circles.every(circle => circle.parentElement?.getAttribute('opacity') === '1'))).toBe(true)
    const settled = await viewer.locator('circle').first().getAttribute('cx')
    await page.waitForTimeout(150)
    expect(await viewer.locator('circle').first().getAttribute('cx')).toBe(settled)
  })
})
