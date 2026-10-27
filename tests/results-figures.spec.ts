import { test, expect } from '@playwright/test'

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
    await expect(page.getByRole('heading', { name: 'View 1: the parity view' })).toBeVisible()

    // 2. Verify real thesis figures panel is rendered
    const figuresPanel = page.locator('.thesis-figures-panel')
    await expect(figuresPanel).toBeVisible()
    await figuresPanel.scrollIntoViewIfNeeded()
    await expect(page.getByRole('heading', { name: 'Thesis research figures & empirical evidence' })).toBeVisible()

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
