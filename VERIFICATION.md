# Local verification

Verified on 27 October 2026 (Asia/Dhaka), using Node 24.19.0, Python from the local Anaconda environment, and installed Google Chrome through Playwright.

| Check | Result |
| --- | --- |
| Strict TypeScript | Passed |
| Vite production build | Passed |
| Python data tests | 4 passed |
| Browser scenarios | All 10 passed across the final full run and targeted rerun |
| Responsive page overflow | None at 390, 768, and 1440px |
| Automated accessibility | Zero reported violations at 390 and 1440px; 34 passing rules each |
| Production dependency audit | Zero reported vulnerabilities |
| Source integrity | Source checksums match; research Git working tree unchanged |

Browser scenarios cover responsive rendering and console errors; search, examples, empty states, selection and reset; actual clipboard writes and the fallback; selected-result JSON export; keyboard rotation and zoom of 3D geometry; conformer failure/retry; result filters and architecture state; download URLs and anchors; mobile navigation; and axe accessibility checks.

The final full browser run passed eight scenarios. Two encountered native Chrome process crashes during test setup, before application assertions. Both passed when rerun with `npx playwright test --last-failed`. No application exception was reported by the rendering/3D tests.

Screenshots are in `artifacts/`; `preview-desktop.png` shows the overview. Accessibility reports are `artifacts/accessibility-1440.json` and `artifacts/accessibility-390.json`. Automated accessibility testing is not a full manual assistive-technology audit; axe flags some molecular/SVG color combinations for manual review.

Not verified: a public deployment, a final public domain/social crawler, other browser engines, independent scaffold reconstruction, retraining, or literature/manuscript claim validation. Results are limited to the saved ESOL evaluation. The temporary QA preview server is stopped after verification; use the README commands to start a new preview.
