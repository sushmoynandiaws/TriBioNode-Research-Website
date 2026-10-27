import { test, expect } from '@playwright/test'

test.describe('Molecular structure motion & thick connected bonds', () => {
  test('2D molecular structure features thicker bonds and assembly entrance animation', async ({ page }) => {
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

  test('3D conformer viewer features thicker bonds and assembly motion from distance', async ({ page }) => {
    await page.goto('/#explorer')
    await page.getByRole('button', { name: '3D', exact: true }).click()

    const viewer = page.getByRole('group', { name: /Interactive 3D conformer/ })
    await expect(viewer).toBeVisible()

    // Bonds have thick strokes
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

    // Screenshot 3D assembled conformer
    await page.waitForTimeout(600)
    await page.locator('.structure-panel').screenshot({ path: 'artifacts/molecular-3d-structure.png' })
  })
})
