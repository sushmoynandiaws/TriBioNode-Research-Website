import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

test('overview keeps a full-width architecture video below the header without text columns or cards', async ({ page }) => {
  await page.goto('/')
  const video = page.locator('.architecture-video')
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThan(1)
  const box = await video.boundingBox()
  expect(box!.width).toBe(page.viewportSize()!.width)
  const header = await page.locator('.site-header').boundingBox()
  expect(box!.y - (header!.y + header!.height)).toBeCloseTo(12, 0)
  expect(box!.height).toBeLessThanOrEqual(box!.width * 9 / 16 + 1)
  await expect(page.locator('.hero-copy, .hero-main, .hero-visual, .overview-evidence')).toHaveCount(0)
  expect(await video.evaluate(element => (element as HTMLVideoElement).duration)).toBeGreaterThan(43)
  expect(await video.evaluate(element => (element as HTMLVideoElement).duration)).toBeLessThan(45)
  expect(await video.evaluate(element => (element as HTMLVideoElement).muted)).toBe(true)
  expect(await video.evaluate(element => (element as HTMLVideoElement).videoWidth)).toBe(3840)
})

test('overview spacing stays balanced on phones, tablets, desktops and short screens', async ({ page }) => {
  const report = []
  for (const [width, height] of [[320, 740], [390, 844], [640, 960], [641, 960], [768, 1024], [1024, 768], [1440, 900], [1920, 1080], [844, 390]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const video = page.locator('.architecture-video')
    const portrait = width <= 640 && width <= height
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).videoWidth)).toBe(portrait ? 1440 : 3840)
    const layout = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
      const film = rect('#overview'), header = rect('.site-header'), video = rect('.architecture-video'), controls = rect('.film-controls'), next = rect('#explorer')
      const media = document.querySelector('video')!
      return { width: innerWidth, height: innerHeight, headerGap: video.top - header.bottom, controlGap: controls.top - video.bottom, bottomGap: film.bottom - controls.bottom, nextGap: next.top - film.bottom, videoWidth: video.width, videoHeight: video.height, nativeRatio: media.videoWidth / media.videoHeight, controlLeft: controls.left, controlRight: controls.right, controlsHeight: controls.height, filmBottom: film.bottom, fit: getComputedStyle(media).objectFit, overflow: document.documentElement.scrollWidth > innerWidth }
    })
    expect(layout.headerGap).toBeCloseTo(12, 0)
    expect(layout.controlGap).toBeCloseTo(12, 0)
    expect(layout.bottomGap).toBeGreaterThanOrEqual(24)
    expect(layout.bottomGap).toBeLessThanOrEqual(48)
    expect(Math.abs(layout.nextGap)).toBeLessThan(1)
    expect(layout.videoWidth).toBe(width)
    expect(layout.videoHeight).toBeLessThanOrEqual(width / layout.nativeRatio + 1)
    expect(layout.controlLeft).toBeGreaterThanOrEqual(12)
    expect(layout.controlRight).toBeLessThanOrEqual(width - 12)
    expect(layout.controlsHeight).toBeGreaterThanOrEqual(44)
    expect(layout.fit).toBe('contain')
    expect(layout.overflow).toBe(false)
    if (height > 560) expect(layout.filmBottom).toBeLessThanOrEqual(height + 1)
    report.push(layout)
    if (width === 390 || width === 768 || width === 1440) {
      await page.getByRole('slider', { name: 'Architecture film progress' }).fill('14.5')
      await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).seeking)).toBe(false)
      await page.screenshot({ path: `artifacts/overview-spacing-${width}.png` })
    }
  }
  await writeFile('artifacts/overview-spacing-verification.json', JSON.stringify(report, null, 2))
})

test('the complete film plays, pauses, seeks through every chapter and replays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const video = page.locator('.architecture-video')
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(.2)
  await page.getByRole('button', { name: 'Pause animation' }).click()
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true)
  for (const [time, chapter] of [[2, 'Molecule input'], [9, 'Three representation encoders'], [23, 'Parallel gating'], [32, 'prediction MLP'], [39, 'Saved solubility']] as const) {
    await page.getByRole('slider', { name: 'Architecture film progress' }).fill(String(time))
    await expect(page.locator('#overview [role="status"]')).toContainText(chapter)
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeCloseTo(time, 1)
  }
  await page.getByRole('button', { name: 'Replay architecture film' }).click()
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeLessThan(1)
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(false)
})

test('reduced motion and offscreen visibility pause playback', async ({ page }) => {
  await page.goto('/')
  const video = page.locator('.architecture-video')
  await expect(page.getByRole('button', { name: 'Play animation' })).toBeVisible()
  expect(await video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true)
  await page.getByRole('button', { name: 'Play animation' }).click()
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(.1)
  await page.locator('#results').scrollIntoViewIfNeeded()
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true)
  await page.getByRole('link', { name: 'TriBioNode home' }).first().click()
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(false)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('button', { name: 'Play animation' })).toBeVisible()
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true)
})

test('portrait composition preserves progress when switching from landscape', async ({ page }) => {
  await page.goto('/')
  const video = page.locator('.architecture-video')
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThan(1)
  await page.getByRole('slider', { name: 'Architecture film progress' }).fill('23')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(video).toHaveAttribute('src', /architecture-refined-portrait.mp4$/)
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).videoHeight)).toBe(2560)
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeCloseTo(23, 1)
  await page.setViewportSize({ width: 768, height: 1024 })
  await expect(video).toHaveAttribute('src', /architecture-refined-landscape.mp4$/)
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).videoWidth)).toBe(3840)
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeCloseTo(23, 1)
})

test('unavailable video offers retry and preserves the research website', async ({ page }) => {
  await page.route('**/animation/*.mp4', route => route.fulfill({ status: 503, body: '' }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('film could not load')
  await expect(page.locator('.architecture-video')).toHaveAttribute('poster', /architecture-refined-landscape-poster.png$/)
  await page.unroute('**/animation/*.mp4')
  await page.getByRole('button', { name: 'Retry video' }).click()
  await expect.poll(() => page.locator('.architecture-video').evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Play animation' }).click()
  await expect.poll(() => page.locator('.architecture-video').evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(.1)
  await page.getByRole('navigation').getByRole('link', { name: 'Molecules', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Selected molecule results' })).toBeVisible()
})
