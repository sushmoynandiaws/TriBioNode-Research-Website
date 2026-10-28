import { expect, test } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import data from '../src/research-data.json' with { type: 'json' }

test('desktop, tablet, and mobile layouts preserve content without overflow', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('from molecule to solubility prediction')
  await expect(page.getByRole('table', { name: /Measured ESOL performance/ })).toBeVisible()
  for (const width of [1440, 1920, 1024, 768, 721, 720, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const smallControls = await page.locator('button, input, select').evaluateAll(nodes => nodes.filter(node => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden' && box.height < 43.5
    }).map(node => node.textContent || node.getAttribute('aria-label')))
    expect(smallControls, `Controls need a 44px touch target at ${width}px`).toEqual([])
    if (width === 1440) await page.screenshot({ path: 'artifacts/preview-desktop.png' })
    const broken = await page.evaluate(() => Array.from(document.images).filter(image => image.loading !== 'lazy' && (!image.complete || image.naturalWidth === 0)).map(image => image.src))
    expect(broken).toEqual([])
    await page.screenshot({ path: `artifacts/site-${width}.png`, fullPage: true })
    if (width === 390) {
      await page.getByRole('link', { name: 'Back to top' }).click()
      await page.screenshot({ path: 'artifacts/preview-mobile.png' })
    }
    if (width === 1440 || width === 390) {
      for (const section of ['explorer', 'results', 'architecture', 'research']) {
        await page.locator(`#${section}`).screenshot({ path: `artifacts/${section}-${width}.png`, style: '.site-header, .skip-link { visibility: hidden !important; }' })
      }
    }
  }
  expect(errors).toEqual([])
})

test('search, empty state, examples, selection, and reset use actual saved records', async ({ page }) => {
  await page.goto('/#explorer')
  const search = page.getByRole('searchbox', { name: 'Find a molecule' })
  const detail = page.getByRole('region', { name: 'Selected molecule results' })
  await search.fill('esol-036')
  await expect(page.getByText('1 match in the saved evaluation')).toBeVisible()
  await expect(detail.getByRole('heading', { level: 3 })).toContainText('ESOL 036')
  await expect(page.locator('.architecture-prediction')).toContainText('ESOL 036')
  await search.fill(data.records[0].smiles)
  await expect(page.getByRole('button', { name: /ESOL 001/ })).toBeVisible()
  await search.fill('definitely-not-a-molecule')
  await expect(page.getByRole('heading', { name: 'Not present in this evaluation' })).toBeVisible()
  await page.getByRole('button', { name: 'Return to an example' }).click()
  await expect(search).toHaveValue('')
  await page.getByRole('button', { name: 'Largest error', exact: true }).click()
  const largest = data.examples.find(e => e.label === 'Largest error')!
  await expect(detail.getByRole('heading', { level: 3 })).toContainText(`ESOL ${largest.id.split('-')[1]}`)
  await page.getByRole('button', { name: /ESOL 001/ }).click()
  await expect(detail.getByRole('heading', { level: 3 })).toContainText('ESOL 001')
  await page.getByRole('button', { name: 'Reset explorer' }).click()
  await expect(detail.getByRole('heading', { level: 3 })).toContainText('ESOL 044')
})

test('copy writes the selected SMILES and JSON export contains measured values', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#explorer')
  await page.getByRole('button', { name: 'Copy SMILES', exact: true }).click()
  const record = data.records.find(r => r.id === data.examples[2].id)!
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(record.smiles)
  await expect(page.getByText('SMILES copied to clipboard.')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download selected molecule result' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(`tribionode-${record.id}.json`)
  const exported = JSON.parse(await readFile((await download.path())!, 'utf-8'))
  expect(exported.predictions).toEqual(record.predictions)
  expect(exported.experimental).toBe(record.target)
  expect(exported.sourceRevision).toBe(data.meta.sourceRevision)
})

test('clipboard failure gives a manual copy alternative', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Unavailable')) } }))
  await page.goto('/#explorer')
  await page.getByRole('button', { name: 'Copy SMILES', exact: true }).click()
  await expect(page.getByText(/Clipboard unavailable/)).toBeVisible()
})

test('3D viewer loads real geometry, rotates by keyboard, zooms, and resets', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#explorer')
  await page.getByRole('button', { name: '3D', exact: true }).click()
  const viewer = page.getByRole('group', { name: /Interactive 3D conformer/ })
  await expect(viewer).toBeVisible()
  await expect(page.getByText(/not the original training geometry/)).toBeVisible()
  const initial = await viewer.locator('circle').first().getAttribute('cx')
  await viewer.focus()
  await page.keyboard.press('ArrowRight')
  expect(await viewer.locator('circle').first().getAttribute('cx')).not.toBe(initial)
  await page.getByRole('slider', { name: '3D conformer zoom' }).fill('1.3')
  await expect(page.getByRole('slider', { name: '3D conformer zoom' })).toHaveValue('1.3')
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(page.getByRole('slider', { name: '3D conformer zoom' })).toHaveValue('1')
  await page.getByRole('button', { name: '2D', exact: true }).click()
  await expect(viewer).toHaveCount(0)
  expect(errors).toEqual([])
})

test('result filters and architecture selection change displayed evidence', async ({ page }) => {
  await page.goto('/#results')
  await page.getByLabel('Comparison metric').selectOption('R2')
  await expect(page.getByText('R² describes variance explained; higher is better.')).toBeVisible()
  const views = page.getByRole('group', { name: 'Result prediction view' })
  await views.getByRole('button', { name: 'View 1', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'View 1: observed vs. predicted' })).toBeVisible()
  await page.getByText('Inspect all 113 underlying observations').click()
  await expect(page.getByRole('table', { name: /View 1 — values/ }).locator('tbody tr')).toHaveCount(113)
  const architecture = page.locator('#architecture')
  await architecture.getByRole('button', { name: /03.*3D.*Geometry/ }).click()
  await expect(architecture.getByRole('heading', { name: 'The molecule as spatial relationships' })).toBeVisible()
  await expect(architecture.getByText(/coordinate-update branch/)).toBeVisible()
})

test('a failed conformer request can be retried without losing saved predictions', async ({ page }) => {
  await page.route('**/conformers/*.json', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.goto('/#explorer')
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expect(page.getByText('The conformer could not be loaded.')).toBeVisible()
  await expect(page.locator('.fused-value')).toHaveText('-4.459')
  await page.unroute('**/conformers/*.json')
  await page.getByRole('button', { name: 'Retry 3D view' }).click()
  await expect(page.getByRole('group', { name: /Interactive 3D conformer/ })).toBeVisible()
})

test('all resource URLs and anchor links resolve', async ({ page, request }) => {
  await page.goto('/')
  await page.getByText('View-specific CSVs & manuscript draft').click()
  const links = await page.locator('a').evaluateAll(nodes => nodes.map(a => a.getAttribute('href')!))
  for (const href of new Set(links)) {
    if (href.startsWith('#')) {
      await expect(page.locator(href)).toHaveCount(1)
    } else {
      const response = await request.get(href)
      expect(response.ok(), href).toBe(true)
      expect(response.headers()['content-type'], href).not.toContain('text/html')
    }
  }
})

test('mobile menu and keyboard navigation are usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  await menu.click()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeFocused()
  await menu.click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(['Overview', 'Molecules', 'Results', 'Architecture', 'Resources'])
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCSS('backdrop-filter', /blur\(18px\)/)
  await page.screenshot({ path: 'artifacts/navbar-mobile.png' })
  await page.getByRole('navigation').getByRole('link', { name: 'Results', exact: true }).click()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(page).toHaveURL(/#results$/)
  await expect(page.locator('nav a[href="#results"]')).toHaveAttribute('aria-current', 'location')
  await expect(page.locator('.site-header')).toHaveClass(/scrolled/)
})

test('visible desktop and mobile content passes automated WCAG accessibility checks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('table', { name: /Measured ESOL performance/ })).toBeVisible()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    await writeFile(`artifacts/accessibility-${width}.json`, JSON.stringify({ violations: result.violations, incomplete: result.incomplete.map(v => ({ id: v.id, description: v.description })), passes: result.passes.map(v => v.id) }, null, 2))
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
    if (width === 390) {
      await page.getByRole('button', { name: 'Menu', exact: true }).click()
      const menuResult = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(menuResult.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([])
    }
  }
})
