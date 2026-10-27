import { Component, lazy, Suspense, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { absoluteError, asset, fmt, heroMolecule, label, matchingRecords, research, resultExport } from './research'
import type { Molecule } from './research'

const ResultsCharts = lazy(() => import('./ResultsCharts'))
const ConformerViewer = lazy(() => import('./ConformerViewer'))

function Arrow({ down = false }: { down?: boolean }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" style={down ? { transform: 'rotate(90deg)' } : undefined}><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function Logo({ light = false }: { light?: boolean }) {
  return <a className={`brand ${light ? 'brand-light' : ''}`} href="#overview" aria-label="TriBioNode home"><svg aria-hidden="true" width="34" height="38" viewBox="0 0 34 38"><path d="M17 6 5 29h24Z" fill="none" stroke="currentColor" strokeWidth="1.4" /><g fill="currentColor"><circle cx="17" cy="6" r="4" /><circle cx="5" cy="29" r="4" /><circle cx="29" cy="29" r="4" /></g></svg><span>TriBioNode<span className="brand-caption">MOLECULAR RESEARCH</span></span></a>
}

class VisualBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <p role="alert" className="notice">This visualization could not load. The measured results remain available in the table and downloads. Reload the page to retry.</p> : this.props.children
  }
}

function SectionHeading({ index, eyebrow, title, children }: { index: string; eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow"><span>{index}</span> {eyebrow}</p><h2>{title}</h2></div>{children && <div className="section-intro">{children}</div>}</div>
}

function Gating({ molecule }: { molecule: Molecule }) {
  return <div className="gating"><div className="small-heading"><h4>How this molecule is routed</h4><span>Gating weights</span></div><div className="gate-track" role="img" aria-label={research.views.slice(0, 3).map((v, i) => `${v.label}: ${fmt(molecule.gates[i] * 100, 2)} percent`).join(', ')}>{research.views.slice(0, 3).map((view, i) => <span key={view.key} style={{ width: `${molecule.gates[i] * 100}%`, background: view.color }} />)}</div><div className="gate-labels">{research.views.slice(0, 3).map((view, i) => <span key={view.key}><i style={{ background: view.color }} />{view.label}<strong>{fmt(molecule.gates[i] * 100, 2)}%</strong></span>)}</div><p className="micro">Routing weights describe the model’s allocation between views; they do not establish causal importance.</p></div>
}

function PredictionComparison({ molecule }: { molecule: Molecule }) {
  const values = [molecule.target, ...research.views.map(v => molecule.predictions[v.key])]
  const min = Math.floor(Math.min(...values)) - 0.5
  const max = Math.ceil(Math.max(...values)) + 0.5
  const position = (value: number) => (130 + ((value - min) / (max - min)) * 405) / 6.4
  return <div className="prediction-plot"><div className="small-heading"><h4>Four predictions. One observation.</h4><span>log₁₀(mol/L)</span></div><svg viewBox="0 0 640 210" role="img" aria-label={`Predictions compared with experimental log solubility ${fmt(molecule.target)}. Dashed line marks the observation.`}><line x1={position(molecule.target) * 6.4} x2={position(molecule.target) * 6.4} y1="12" y2="169" stroke="#62767e" strokeDasharray="4 4" /><text x={position(molecule.target) * 6.4} y="200" textAnchor="middle" fill="#52656e" fontSize="11">Observed {fmt(molecule.target, 2)}</text>{research.views.map((view, i) => <g key={view.key}><text x="2" y={34 + i * 39} fill={view.color} fontSize="12" fontWeight="600">{view.label}</text><line x1="105" x2="572" y1={30 + i * 39} y2={30 + i * 39} stroke="#e6ecea" /><line x1={position(molecule.target) * 6.4} x2={position(molecule.predictions[view.key]) * 6.4} y1={30 + i * 39} y2={30 + i * 39} stroke={view.color} strokeWidth="2" opacity="0.45" /><circle cx={position(molecule.predictions[view.key]) * 6.4} cy={30 + i * 39} r="6" fill={view.color}><title>{view.label}: {fmt(molecule.predictions[view.key])}</title></circle><text x="635" y={34 + i * 39} textAnchor="end" fill={view.color} fontSize="13" fontWeight="600">{fmt(molecule.predictions[view.key])}</text></g>)}</svg></div>
}

function MoleculeExplorer({ onSelected }: { onSelected: (record: Molecule) => void }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(heroMolecule.id)
  const [dimension, setDimension] = useState<'2d' | '3d'>('2d')
  const [status, setStatus] = useState('')
  const filtered = matchingRecords(query)
  const molecule = filtered.find(r => r.id === selectedId) ?? filtered[0]
  function choose(record: Molecule) {
    setSelectedId(record.id)
    setStatus('')
    onSelected(record)
  }
  function example(id: string) {
    const record = research.records.find(r => r.id === id)!
    setQuery('')
    choose(record)
  }
  async function copySmiles() {
    if (!molecule) return
    try {
      await navigator.clipboard.writeText(molecule.smiles)
      setStatus('SMILES copied to clipboard.')
    } catch {
      setStatus('Clipboard unavailable. Select the SMILES text below and copy it manually.')
    }
  }
  function download() {
    if (!molecule) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(resultExport(molecule), null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `tribionode-${molecule.id}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus('Result exported as JSON.')
  }
  function reset() {
    setQuery('')
    setDimension('2d')
    choose(heroMolecule)
  }
  return <section id="explorer" className="section wrap">
    <SectionHeading index="01" eyebrow="MOLECULE EXPLORER" title="Meet the molecules behind the metrics."><p>Look closer at a saved test observation. Compare what each view sees, where fusion helps, and where it falls short.</p></SectionHeading>
    <div className="explorer-top"><span className="status-badge"><span />Saved ESOL evaluation · {research.meta.sampleCount} molecules</span><span className="subtle">Explore recorded predictions. New molecules are not evaluated here.</span></div>
    <div className="explorer-shell">
      <aside className="explorer-sidebar" aria-label="Molecule selection">
        <div className="sidebar-top"><div className="small-heading"><h3>Evaluation set</h3><span>{research.meta.sampleCount}</span></div><label className="search-label" htmlFor="molecule-search">Find a molecule</label><div className="search-field"><svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.6" /></svg><input id="molecule-search" type="search" placeholder="Search SMILES or ESOL ID" value={query} onChange={e => { const text = e.target.value; setQuery(text); setStatus(''); const matches = matchingRecords(text); const active = matches.find(r => r.id === selectedId) ?? matches[0]; if (active) onSelected(active) }} /></div><p role="status" className="micro search-count">{filtered.length} {filtered.length === 1 ? 'match' : 'matches'} in the saved evaluation</p><p className="mini-label">START WITH AN EXAMPLE</p><div className="example-buttons">{research.examples.map(e => <button key={e.id} onClick={() => example(e.id)}>{e.label}<Arrow /></button>)}</div></div>
        <div className="molecule-list" role="group" aria-label="Evaluated molecules">{filtered.map(record => <button key={record.id} aria-pressed={record.id === molecule?.id} className={`molecule-option ${record.id === molecule?.id ? 'selected' : ''}`} onClick={() => choose(record)}><span className="molecule-glyph" aria-hidden="true">⌬</span><span><strong>{label(record)}</strong><span>{record.atoms} atoms · {record.rings} rings</span></span><span className="option-arrow" aria-hidden="true">↗</span></button>)}{!filtered.length && <p className="empty-sidebar">No saved molecules match this search.</p>}</div>
        <button className="reset-button" onClick={reset}>↺ Reset explorer</button>
      </aside>
      <div className="explorer-detail" role="region" aria-label="Selected molecule results">
        {!molecule ? <div className="empty-state"><span aria-hidden="true">⌬</span><h3>Not present in this evaluation</h3><p>Search the {research.meta.sampleCount} saved ESOL molecules by SMILES or ID, or choose an example. This site does not run predictions for unseen molecules.</p><button className="button primary" onClick={reset}>Return to an example <Arrow /></button></div> : <>
          <div className="molecule-heading"><div><p className="mini-label">TEST OBSERVATION / {String(molecule.ordinal).padStart(3, '0')}</p><h3>{label(molecule)} <span>Delaney ESOL</span></h3></div><button className="button compact secondary" onClick={download} aria-label="Download selected molecule result">Export result <Arrow down /></button></div>
          <div className="molecule-stage"><div className="structure-panel"><div className="structure-toolbar"><span className="mini-label">MOLECULAR STRUCTURE</span><div className="segmented" role="group" aria-label="Structure display"><button aria-pressed={dimension === '2d'} onClick={() => setDimension('2d')}>2D</button><button aria-pressed={dimension === '3d'} onClick={() => setDimension('3d')}>3D</button></div></div>{dimension === '2d' ? <img className="molecule-image" src={asset(molecule.structure)} alt={`RDKit 2D molecular structure of ${label(molecule)}`} width="560" height="340" /> : <VisualBoundary key={molecule.id}><Suspense fallback={<p className="viewer-loading" role="status">Loading conformer viewer…</p>}><ConformerViewer path={molecule.conformer} name={label(molecule)} /></Suspense></VisualBoundary>}<div className="structure-meta"><span>{molecule.atoms} heavy atoms</span><span>{molecule.rings} rings</span><span>{fmt(molecule.mass, 2)} g/mol</span></div></div><div className="observation-card"><p className="mini-label">EXPERIMENTAL LOG SOLUBILITY</p><strong>{fmt(molecule.target)}</strong><span className="unit">log₁₀(mol/L)</span><div className="observed-divider" /><p className="mini-label">FUSED PREDICTION</p><span className="fused-value">{fmt(molecule.predictions.fused)}</span><span className="error-pill">Absolute error {fmt(absoluteError(molecule, 'fused'))}</span><p className="micro">One held-out observation from the saved test set.</p></div></div>
          <div className="smiles-box"><div className="small-heading"><span className="mini-label">SOURCE SMILES</span><button onClick={copySmiles} className="text-button" aria-label="Copy SMILES">Copy SMILES <span aria-hidden="true">⧉</span></button></div><code>{molecule.smiles}</code></div>
          <div className="prediction-cards">{research.views.map(view => <div key={view.key} style={{ '--view-color': view.color } as CSSProperties}><p>{view.label}<span>{view.name}</span></p><strong>{fmt(molecule.predictions[view.key])}</strong><span className="micro">Abs. error {fmt(absoluteError(molecule, view.key))}</span></div>)}</div>
          <PredictionComparison molecule={molecule} />
          <Gating molecule={molecule} />
        </>}
        <p className="interaction-status" role="status">{status}</p>
      </div>
    </div>
  </section>
}

const architectureNotes = [
  { title: 'The molecule as a sequence', input: 'SMILES string', detail: 'Character token embeddings and a Transformer learn patterns in the SMILES sequence. This implementation is trained from scratch; it does not load pretrained ChemBERTa weights.', representation: '1D', symbol: 'C C ( O )', annotation: 'Character-level Transformer' },
  { title: 'The molecule as a connected structure', input: 'Atoms + bonds + BRICS motifs', detail: 'Atom-level message passing is combined with BRICS fragment pooling and a motif Transformer. The current model does not consume its computed ECFP4 fingerprint features.', representation: '2D', symbol: '⌬', annotation: 'Atom + motif graph encoder' },
  { title: 'The molecule as spatial relationships', input: 'Conformer distance features', detail: 'A geometric encoder combines atom features and fixed radial basis function (RBF) distances. Its coordinate-update branch does not feed predictions; this is not a validated implementation of learned coordinate refinement.', representation: '3D', symbol: '◈', annotation: 'Distance-based geometric encoder' },
]

function Architecture({ molecule }: { molecule: Molecule }) {
  const [selected, setSelected] = useState(0)
  const note = architectureNotes[selected]
  const view = research.views[selected]
  return <section id="architecture" className="section wrap"><SectionHeading index="03" eyebrow="INSIDE TRIBIONODE" title="Different representations. A shared task."><p>Sequence, connectivity, and spatial relationships offer different ways to describe a molecule. Select a view to follow its path.</p></SectionHeading><div className="architecture-grid"><div className="architecture-diagram"><p className="mini-label diagram-caption">CONCEPTUAL DATA FLOW · CURRENT IMPLEMENTATION</p><div className="encoder-row">{architectureNotes.map((item, i) => <button key={item.representation} aria-pressed={i === selected} onClick={() => setSelected(i)} style={{ '--view-color': research.views[i].color } as CSSProperties}><span className="encoder-number">0{i + 1} / {item.representation}</span><span className="encoder-symbol" aria-hidden="true">{item.symbol}</span><strong>{research.views[i].name}</strong><span>{item.annotation}</span></button>)}</div><div className="flow-connectors" aria-hidden="true"><span /><span /><span /></div><div className="contrastive-strip"><span className="connection-dot" />Contrastive alignment <span className="micro">shared training objective</span></div><div className="flow-down" aria-hidden="true">↓</div><div className="fusion-row"><div>Dynamic view gating<span>Weighted representation</span></div><span aria-hidden="true">+</span><div>Cross-modal Transformer<span>Interactions between views</span></div></div><div className="flow-down" aria-hidden="true">↓</div><div className="output-node">Fused property prediction <span>log solubility</span><Arrow /></div></div><div className="architecture-note" style={{ '--view-color': view.color } as CSSProperties}><p className="mini-label">VIEW {selected + 1} / {note.representation} REPRESENTATION</p><h3>{note.title}</h3><p>{note.detail}</p><div className="input-label"><span className="mini-label">INPUT</span><span>{note.input}</span></div><div className="architecture-prediction"><p>Selected explorer molecule <strong>{label(molecule)}</strong></p><span>{fmt(molecule.predictions[view.key])}<small>log₁₀(mol/L)</small></span><p className="micro">View-specific prediction · Experimental {fmt(molecule.target)}</p></div></div></div><p className="footnote">The three view-specific prediction heads are jointly trained with the fused head. They are not independently trained baseline models.</p></section>
}

function ResearchResources() {
  const resources = [
    { name: 'Saved test predictions', detail: 'Fused predictions + per-molecule routing weights · CSV', path: 'tribionode_fused_predictions.csv', tag: '113 ROWS' },
    { name: 'Evaluation summary', detail: 'Four prediction heads · RMSE, MAE, R² · CSV', path: 'views_evaluation_summary.csv', tag: 'MEASURED' },
    { name: 'Source provenance', detail: 'Revision, SHA-256 checksums, and preparation method · JSON', path: 'provenance.json', tag: 'TRACEABLE' },
  ]
  return <section id="research" className="section research-section"><div className="wrap"><SectionHeading index="04" eyebrow="RESEARCH & RESOURCES" title="Follow the evidence."><p>A focused research snapshot, with the artifacts and limitations needed to read it in context.</p></SectionHeading><div className="research-grid"><article className="research-story"><p className="mini-label">THE RESEARCH QUESTION</p><h3>Can multiple views improve molecular property prediction?</h3><p>Predicting properties from molecular structure can help prioritize compounds for further study. TriBioNode explores whether a sequence model, a hierarchical graph model, and geometric features can complement one another on aqueous solubility.</p><p>In the saved ESOL evaluation, the fused head has lower RMSE than any of its view-specific heads. This observation is limited to this run and test set; it does not establish superiority across datasets.</p><div className="research-scope"><div><strong>{research.meta.catalogueCount}</strong><span>datasets catalogued<br />in the EDA notebook</span></div><div><strong>01</strong><span>dataset with saved<br />evaluation shown here</span></div></div></article><article className="evidence-card"><p className="mini-label">HOW TO READ THESE RESULTS</p><h3>Useful evidence has boundaries.</h3><ul><li><strong>Evaluation protocol</strong><span>The training notebook reports an 80/10/10 Bemis–Murcko scaffold split. The original dataset is absent here, so the split has not been independently verified.</span></li><li><strong>A single saved run</strong><span>These {research.meta.sampleCount} observations do not establish variation across seeds, statistical significance, or calibrated uncertainty.</span></li><li><strong>Implementation limits</strong><span>The notebook’s checkpoint copy shares live tensors. Its 3D coordinate updates do not affect predictions. Both need correction before a new evaluation.</span></li><li><strong>Proposed work versus measured work</strong><span>Other benchmark scores, synthetic ablations, and manually scaled ensemble metrics are excluded from this website’s results.</span></li></ul></article></div><div className="resources-heading"><h3>Explore the source artifacts</h3><span className="mini-label">DOWNLOAD & REPRODUCE</span></div><div className="resource-list">{resources.map(r => <a key={r.path} className="resource-link" href={asset(`downloads/${r.path}`)} download><span className="resource-icon" aria-hidden="true">↧</span><span><strong>{r.name}</strong><small>{r.detail}</small></span><span className="resource-tag">{r.tag}</span><Arrow /></a>)}</div><details className="additional-resources"><summary>View-specific CSVs & manuscript draft <span aria-hidden="true">＋</span></summary><div><p className="micro">The manuscript is an unvalidated draft containing tables and claims not supported by the saved evaluation. It is provided for context, not as validated performance evidence. Its figure links refer to the original repository.</p><div className="download-chips">{research.views.slice(0, 3).map((v, i) => <a key={v.key} href={asset(`downloads/view${i + 1}_predictions_and_metrics.csv`)} download>{v.label} predictions ↓</a>)}<a href={asset('downloads/manuscript-draft.md')} download>Unvalidated manuscript draft ↓</a><a href={asset('downloads/README.txt')} download>Artifact notes ↓</a></div></div></details><div className="provenance-line"><span className="status-badge"><span />Checked against saved artifacts</span><span>Source revision <code>{research.meta.sourceRevision?.slice(0, 7) ?? 'unavailable'}</code> · Molecular drawings: RDKit {research.meta.rdkitVersion}</span></div></div></section>
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedMolecule, setSelectedMolecule] = useState(heroMolecule)
  const fused = research.views[3]
  const bestSingleRmse = Math.min(...research.views.slice(0, 3).map(v => v.metrics.RMSE))
  const improvement = (1 - fused.metrics.RMSE / bestSingleRmse) * 100
  const links = [['overview', 'Overview'], ['explorer', 'Explorer'], ['results', 'Results'], ['architecture', 'Architecture'], ['research', 'Research']]
  return <>
    <a className="skip-link" href="#main">Skip to main content</a>
    <header className="site-header"><div className="wrap header-inner"><Logo /><button className="menu-button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close menu' : 'Menu'}<span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button><nav id="main-navigation" aria-label="Main navigation" className={menuOpen ? 'is-open' : ''}>{links.map(([id, name]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{name}</a>)}</nav><a className="header-action" href="#explorer">Explore the research <Arrow /></a></div></header>
    <main id="main"><section id="overview" className="hero"><div className="wrap"><div className="hero-topline"><p className="eyebrow"><span className="connection-dot" />MULTI-VIEW MOLECULAR LEARNING</p><span className="issue-label">RESEARCH ATLAS / VOL. 01</span></div><div className="hero-grid"><div className="hero-copy"><h1>Three views.<br />One molecular<br /><em>perspective.</em></h1><p>From chemical sequences to connected structures and spatial relationships. Explore how TriBioNode brings molecular representations together to predict solubility.</p><div className="hero-actions"><a className="button primary" href="#explorer">Explore molecules <Arrow /></a><a className="button text-link" href="#results">View measured results <span aria-hidden="true">↗</span></a></div><p className="hero-note"><span className="tiny-check" aria-hidden="true">✓</span>Real molecules. Saved predictions. Evidence you can inspect.</p></div><div className="hero-visual"><div className="molecule-orbit"><div className="orbit-ring orbit-one" /><div className="orbit-ring orbit-two" /><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /><div className="hero-structure"><img src={asset(heroMolecule.structure)} width="560" height="340" alt={`RDKit molecular structure of ${label(heroMolecule)}, a saved ESOL test molecule`} fetchPriority="high" /></div><div className="orbit-label orbit-label-one"><i style={{ background: research.views[0].color }} />01 <span>Sequence</span></div><div className="orbit-label orbit-label-two"><i style={{ background: research.views[1].color }} />02 <span>Structure</span></div><div className="orbit-label orbit-label-three"><i style={{ background: research.views[2].color }} />03 <span>Geometry</span></div></div><div className="hero-specimen"><div><span className="mini-label">SPECIMEN / {label(heroMolecule)}</span><p>One molecule. Complementary representations.</p></div><a href="#explorer" aria-label={`Explore ${label(heroMolecule)}`}><Arrow /></a></div></div></div><div className="hero-stat-row"><div><strong>{research.meta.sampleCount}</strong><span>Held-out ESOL molecules<small>Saved test observations</small></span></div><div><strong>3<span className="stat-plus">+1</span></strong><span>Views & fused prediction<small>Jointly trained heads</small></span></div><div><strong>{fmt(fused.metrics.RMSE, 4)}</strong><span>Fused test RMSE<small>log₁₀(mol/L) · lower is better</small></span></div><div><strong>{fmt(improvement, 1)}<span className="stat-plus">%</span></strong><span>Lower RMSE than View 3<small>Best view-specific head in this run</small></span></div></div></div></section>
      <MoleculeExplorer onSelected={setSelectedMolecule} />
      <section id="results" className="section results-section"><div className="wrap"><SectionHeading index="02" eyebrow="MEASURED PERFORMANCE" title="A clearer view of the results."><p>Every number below is recalculated from the same {research.meta.sampleCount} saved test observations. Compare the four prediction heads on equal terms.</p></SectionHeading><VisualBoundary><Suspense fallback={<div className="chart-loading" role="status">Loading measured result charts…</div>}><ResultsCharts /></Suspense></VisualBoundary><div className="results-caption"><span className="connection-dot" /><p>ESOL · log₁₀(mol/L) · Scaffold split reported by the training notebook. No confidence intervals or cross-dataset rankings are inferred from this run.</p></div></div></section>
      <Architecture molecule={selectedMolecule} />
      <ResearchResources />
    </main><footer className="site-footer"><div className="wrap footer-main"><div><Logo light /><p>Understanding molecules through<br />complementary perspectives.</p></div><div><span className="mini-label">EXPLORE</span><a href="#explorer">Molecule explorer</a><a href="#results">Measured results</a><a href="#architecture">Model architecture</a></div><div><span className="mini-label">RESEARCH SNAPSHOT</span><p>Delaney ESOL · {research.meta.sampleCount} test observations<br />For research and education.</p><a href={asset('downloads/provenance.json')} download>View source provenance ↗</a></div></div><div className="wrap footer-bottom"><span>TriBioNode / Molecular Research</span><span>Built around inspectable evidence.</span><a href="#overview">Back to top ↑</a></div></footer>
  </>
}
