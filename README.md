# TriBioNode Research Website

A static research showcase built with React, TypeScript, and Vite. It contains a searchable atlas of 113 saved ESOL test observations, genuine RDKit molecular structures, an interactive 3D conformer viewer, measured result charts, an implementation-aware architecture diagram, and source downloads.

## Run locally

Use Node.js 20.19+ (20.x), 22.12+ (22.x), or a later supported version. This project was verified with Node 24.19.0 and npm 10.8.0.

```powershell
Set-Location 'E:\Ship Studio\TriBioNode Research Website'
npm ci
npm run dev
```

Open the printed URL, normally http://127.0.0.1:5173. No API keys, Python runtime, database, external fonts, or inference service are needed to run or build the website. All required prepared data and assets are included.

## Verify and build

```powershell
npm run typecheck
npm run test:data
npm run build
npm run test:e2e
npm run preview
```

`test:data` uses Python's standard-library unittest runner. It checks generated metrics, molecule assets, geometry references, finite number validation, and rejected source alignment/gating/summary errors. The original-source checks are skipped if the original repository is unavailable; generated-artifact checks still run.

`test:e2e` uses installed Google Chrome through Playwright and starts the production preview automatically at port 4173 if it is not running. Install Chrome first, or change `channel: 'chrome'` in `playwright.config.ts` and install Playwright Chromium with `npx playwright install chromium`. Tests cover responsive layouts, search, examples, empty states, reset, clipboard success/failure, JSON downloads, 3D controls, view filters, source links, mobile navigation, and automated WCAG checks through axe. Screenshots and accessibility results are written to `artifacts/`. No pre-existing lint configuration was present; strict TypeScript checks run as part of the production build.

`npm run preview` serves `dist/` at http://127.0.0.1:4173. A successful build outputs only static files. Do not serve the project source directory or treat Vite's development/preview server as the public production server.

## Refresh research data

The source is read-only:

`E:\Ship Studio\Research TriBioNode\ADD_thesis`

To regenerate the snapshot, use Python 3.11+ with NumPy and RDKit. Their versions used for the prepared snapshot are recorded in `public/downloads/provenance.json` and pinned in `requirements-data.txt`.

```powershell
python -m pip install -r requirements-data.txt
npm run prepare:data
```

Or specify another source checkout:

```powershell
python scripts/prepare_data.py --source 'C:\path\to\ADD_thesis'
```

The script:

1. Requires 113 rows in the audited snapshot and matches raw row order, SMILES, and targets across all four prediction CSVs. Repeated SMILES remain separate observations with stable row IDs.
2. Rejects non-finite values, invalid probabilities, inconsistent gating sums, mismatched metrics, and misaligned NPZ targets or molecule identities. It checks embedding shapes without publishing the embeddings.
3. Recalculates RMSE, MAE, and R² and checks each against the source summary with an absolute tolerance of `1e-5`.
4. Generates real 2D structure SVGs and deterministic ETKDGv3 conformers using seed 42. Available MMFF94 optimization is attempted for up to 100 iterations; convergence status is recorded. A failed embedding is marked unavailable, not replaced with random geometry.
5. Writes `src/research-data.json`, molecular assets, selected source downloads, and SHA-256 provenance inside this website directory. It never writes to the research repository.

Examples are selected deterministically: minimum fused absolute error, maximum fused absolute error, and greatest fused advantage over the best view-specific prediction on the same molecule. The first source row breaks ties. These examples are explanatory cases, not additional performance estimates.

Run the checks and rebuild after refreshing the data. Source versions and checksums establish artifact lineage; a Git revision alone does not establish a clean source checkout. If the evaluation set changes, explicitly update and review the snapshot checks rather than relaxing them silently.

## Evidence and limitations

- The published metrics come from 113 saved ESOL test observations. Sixteen datasets are catalogued in the EDA notebook; this website does not claim sixteen evaluated datasets.
- The notebook reports an 80/10/10 Bemis–Murcko scaffold split. The original dataset is missing, so the split was not independently verified.
- The view-specific heads were jointly trained. They are not independent baseline models.
- The implemented sequence model is a character-level Transformer trained from scratch, not pretrained ChemBERTa. Computed ECFP4 fingerprints are not consumed by the current model.
- The geometric encoder uses fixed distance features. Its coordinate-update branch does not affect predictions. The notebook's best-checkpoint copy shares live parameter storage. The website documents these limits; it does not repair or retrain the model.
- Gating weights are routing allocations, not causal explanations. A separate cross-modal pathway also contributes to the final prediction.
- The 3D geometry is generated afresh for visualization. It is not recovered training geometry, and is not evidence of the original conformer's quality. Hydrogens are omitted from the view for clarity. Geometry loads only when requested and never produces predictions.
- No simulated inference, uncertainty intervals, significance claims, synthetic ablations, or unsupported leaderboard scores are displayed.
- The downloadable Markdown manuscript is an **unvalidated draft** containing unsupported tables and claims. It is intentionally labeled at the download. Relative figure links refer to the source repository and are not bundled.
- No reference-paper PDFs are redistributed. No authors or affiliations are inferred from incomplete source information.

## Static deployment

1. Run `npm ci`, checks, and `npm run build`.
2. Publish **only `dist/`** to an HTTPS static host. On Netlify, Cloudflare Pages, or a comparable service, use build command `npm run build` and output directory `dist`.
3. There are no server routes or API endpoints. `base: './'` keeps application assets relative for subdirectory hosting. Every navigation target is an in-page anchor.
4. Once the real public domain and path are known, set absolute `og:image` and `twitter:image` URLs in `index.html`, add a canonical URL and `og:url`, and rebuild. The local preview intentionally has no invented canonical domain. The included social preview is a 1200×630 PNG, with an editable SVG source.
5. Serve `.svg` as `image/svg+xml`, `.json` as `application/json`, and `.csv` as `text/csv`. Cache hashed `assets/` files immutably; revalidate HTML, downloads, research geometry, and drawings because their filenames are stable across snapshots.
6. Verify the public origin, subdirectory if applicable, downloads, and social preview after deployment. No public deployment or domain has been configured in this local delivery.

For self-hosting, the optional `deploy/nginx.conf` shows MIME types, compression, cache policy, and common response headers. Add the host's TLS configuration and real domain before using it. Equivalent headers may be configured in other static hosts. The app makes no runtime requests to third-party services; clipboard access works in secure contexts with a manual-copy fallback when unavailable.

## Layout

- `src/App.tsx`: overview, explorer, architecture, and resources.
- `src/ResultsCharts.tsx`: SVG charts and accessible result tables; separate bundle.
- `src/ConformerViewer.tsx`: on-demand orthographic 3D viewer with pointer and keyboard rotation.
- `src/research.ts`: data types, formatting, search, and result exports.
- `scripts/prepare_data.py`: validation and asset preparation.
- `public/downloads/provenance.json`: source revision, checksums, and preparation details.
- `tests/website.spec.ts`: real-browser interaction, layout, and accessibility checks.

The reference site informed the introduction → interactive exploration → results → explanation flow. The TriBioNode layout, copy, molecular assets, icons, favicon, and social preview were created for this project. No reference-site branding or images are shipped.
"# TriBioNode-Research-Website" 
