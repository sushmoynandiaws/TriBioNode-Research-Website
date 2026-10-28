import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Results section: interactive graphics & real thesis figures', () => {
  test('interactive charts remain intact while real thesis figures are seamlessly integrated', async ({ page }) => {
    await page.goto('/#results')
    const results = page.locator('#results')
    await expect(results).toBeVisible()

    // 1. Verify existing interactive graphics and controls remain functional
    const metricSelect = page.getByLabel('Comparison metric')
    await expect(metricSelect).toBeVisible()
    await metricSelect.selectOption('R2')
    await expect(page.getByText('R² describes variance explained; higher is better.')).toBeVisible()

    const viewSwitcher = page.getByRole('group', { name: 'Result prediction view' })
    await expect(viewSwitcher).toBeVisible()
    await viewSwitcher.getByRole('button', { name: 'View 1', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'View 1: observed vs. predicted' })).toBeVisible()

    // 2. Verify real thesis figures panel is rendered
    const figuresPanel = page.locator('.thesis-figures-panel')
    await expect(figuresPanel).toBeVisible()
    await figuresPanel.scrollIntoViewIfNeeded()
    await expect(page.getByRole('heading', { name: 'Source manuscript figures' })).toBeVisible()

    // Count figure cards
    const cards = page.locator('.figure-card')
    const totalCards = await cards.count()
    expect(totalCards).toBe(9)

    // Wait for all card images to complete loading
    await expect.poll(async () => {
      return page.evaluate(() =>
        Array.from(document.querySelectorAll('.figure-card-media img'))
          .filter(img => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0)
          .length
      )
    }).toBe(0)

    // 3. Test category filtering
    const filterChips = page.getByRole('group', { name: 'Filter figures by topic' })
    await filterChips.getByRole('button', { name: 'Performance', exact: true }).click()
    await expect(page.locator('.figure-card')).toHaveCount(3)

    await filterChips.getByRole('button', { name: 'All', exact: true }).click()
    await expect(page.locator('.figure-card')).toHaveCount(9)

    // 4. Test lightbox modal inspection
    await cards.first().click()
    const modal = page.locator('.figure-modal-backdrop')
    await expect(modal).toBeVisible()
    await expect(modal.locator('.figure-modal-header h3')).toBeVisible()
    await expect(modal.locator('.figure-modal-image-wrap img')).toBeVisible()

    // Close modal via ✕ button
    const closeBtn = page.getByRole('button', { name: 'Close high-resolution figure modal' })
    await closeBtn.click()
    await expect(modal).toHaveCount(0)

    // Reopen and close via Escape
    await cards.nth(1).click()
    await expect(modal).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)

    // 5. Capture verification screenshots
    await page.locator('.results-top-grid').screenshot({ path: 'artifacts/results-interactive-charts.png' })
    await page.locator('.thesis-figures-panel').screenshot({ path: 'artifacts/results-thesis-figures.png' })
  })
})

test('professional presentation keeps figure context, clear images and keyboard-safe inspection', async ({ page }) => {
  await page.goto('/#explorer')
  await expect(page.getByRole('heading', {name: 'Molecular predictions', exact: true})).toBeInViewport()
  await expect(page.getByRole('heading', { name: 'Source manuscript figures', exact: true })).toBeVisible()
  const copy = await page.locator('body').innerText()
  expect(copy).not.toMatch(/[🔍🧬🔬🧪📊✨🚀⚠✅⌬◈↺⧉☰✕]/u)
  expect(copy).not.toContain('Every architectural component provides statistically significant error reduction')
  await expect(page.locator('.figures-header p')).toContainText('not validated by the saved ESOL evaluation')
  await expect(page.locator('.figure-card')).toHaveCount(9)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const chart = page.locator('.parity-chart-scroll')
    await expect(chart).toHaveCSS('overflow-x', 'auto')
    expect(await chart.locator('svg').evaluate(svg => svg.getBoundingClientRect().width)).toBeGreaterThanOrEqual(480)
    const card = page.locator('.figure-card').first()
    await card.focus()
    await card.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const close = page.getByRole('button', { name: 'Close high-resolution figure modal' })
    await expect(close).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('link', { name: 'Download image' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    expect(await dialog.locator('img').evaluate(img => getComputedStyle(img).objectFit)).toBe('contain')
    expect(await dialog.evaluate(element => { const box=element.getBoundingClientRect();return box.width <= innerWidth && box.height <= innerHeight })).toBe(true)
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()
    expect(audit.violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([])
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(card).toBeFocused()
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  }
})
