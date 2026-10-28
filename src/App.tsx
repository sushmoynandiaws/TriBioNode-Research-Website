import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { absoluteError, asset, fmt, heroMolecule, label, matchingRecords, research, resultExport } from './research'
import type { Molecule } from './research'
import ArchitectureFilm from './ArchitectureFilm'
import Icon from './Icon'
import MolecularStructure2D from './MolecularStructure2D'

const ResultsCharts = lazy(() => import('./ResultsCharts'))
const ConformerViewer = lazy(() => import('./ConformerViewer'))

function Arrow({ down = false }: { down?: boolean }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" style={down ? { transform: 'rotate(90deg)' } : undefined}><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function Logo({ paused }: { paused: boolean }) {
  const [failed, setFailed] = useState(false)
  const mark = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!mark.current) return
    let intersecting = false
    const sync = () => setVisible(intersecting && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; sync() })
    observer.observe(mark.current)
    document.addEventListener('visibilitychange', sync)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return <a className="brand" href="#overview" aria-label="TriBioNode home"><span ref={mark} className="brand-mark" aria-hidden="true"><img className={failed ? 'brand-still' : 'brand-motion'} src={asset(failed ? 'brand/trifold-rendered-icon.png' : 'brand/trifold-gentle.webp')} width="128" height="128" alt="" style={{ animationPlayState: paused || !visible ? 'paused' : 'running' }} onError={() => setFailed(true)} /></span><span>TriBioNode<span className="brand-caption">Molecular research</span></span></a>
}

class VisualBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <p role="alert" className="notice">This visualization could not load. The measured results remain available in the table and downloads. Reload the page to retry.</p> : this.props.children
  }
}

function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2></div>{children && <div className="section-intro">{children}</div>}</div>
}

function Gating({ molecule }: { molecule: Molecule }) {
  return <div className="gating"><div className="small-heading"><h4>View allocation</h4><span>Gating weights</span></div><div className="gate-track" role="img" aria-label={research.views.slice(0, 3).map((v, i) => `${v.label}: ${fmt(molecule.gates[i] * 100, 2)} percent`).join(', ')}>{research.views.slice(0, 3).map((view, i) => <span key={view.key} style={{ width: `${molecule.gates[i] * 100}%`, background: view.color }} />)}</div><div className="gate-labels">{research.views.slice(0, 3).map((view, i) => <span key={view.key}><i style={{ background: view.color }} />{view.label}<strong>{fmt(molecule.gates[i] * 100, 2)}%</strong></span>)}</div><p className="micro">Gating weights describe routing, not causal importance.</p></div>
}

function PredictionComparison({ molecule }: { molecule: Molecule }) {
  const values = [molecule.target, ...research.views.map(v => molecule.predictions[v.key])]
  const min = Math.floor(Math.min(...values)) - 0.5
  const max = Math.ceil(Math.max(...values)) + 0.5
  const position = (value: number) => (130 + ((value - min) / (max - min)) * 405) / 6.4
  return <div className="prediction-plot"><div className="small-heading"><h4>Prediction comparison</h4><span>log₁₀(mol/L)</span></div><div className="prediction-chart-scroll" role="region" tabIndex={0} aria-label="Prediction comparison chart; scroll horizontally to inspect"><svg viewBox="0 0 640 210" role="img" aria-label={`Predictions compared with experimental log solubility ${fmt(molecule.target)}. Dashed line marks the observation.`}><line x1={position(molecule.target) * 6.4} x2={position(molecule.target) * 6.4} y1="12" y2="169" stroke="var(--text-2)" strokeDasharray="4 4" /><text x={position(molecule.target) * 6.4} y="200" textAnchor="middle" fill="var(--text-2)" fontSize="14">Observed {fmt(molecule.target, 2)}</text>{research.views.map((view, i) => <g key={view.key}><text x="2" y={34 + i * 39} fill={view.color} fontSize="14" fontWeight="600">{view.label}</text><line x1="105" x2="572" y1={30 + i * 39} y2={30 + i * 39} stroke="var(--hairline)" /><line x1={position(molecule.target) * 6.4} x2={position(molecule.predictions[view.key]) * 6.4} y1={30 + i * 39} y2={30 + i * 39} stroke={view.color} strokeWidth="2" opacity="0.45" /><circle cx={position(molecule.predictions[view.key]) * 6.4} cy={30 + i * 39} r="6" fill={view.color}><title>{view.label}: {fmt(molecule.predictions[view.key])}</title></circle><text x="635" y={34 + i * 39} textAnchor="end" fill={view.color} fontSize="14" fontWeight="600">{fmt(molecule.predictions[view.key])}</text></g>)}</svg></div><p className="chart-scroll-hint">Scroll horizontally to inspect the chart.</p></div>
}

function MoleculeExplorer({ onSelected }: { onSelected: (record: Molecule) => void }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(heroMolecule.id)
  const [dimension, setDimension] = useState<'2d' | '3d'>('2d')
  const [status, setStatus] = useState('')
  const [replayCount, setReplayCount] = useState(0)
  const filtered = matchingRecords(query)
  const molecule = filtered.find(r => r.id === selectedId) ?? filtered[0]
  function choose(record: Molecule) {
    setSelectedId(record.id)
    setStatus('')
    setReplayCount(c => c + 1)
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
    <SectionHeading title="Molecular predictions"><p>Compare experimental solubility with saved predictions from each molecular view.</p></SectionHeading>
    <div className="explorer-top"><span className="status-badge"><span />ESOL · {research.meta.sampleCount} test molecules</span><span className="subtle">Saved predictions · no live inference</span></div>
    <div className="explorer-shell">
      <aside className="explorer-sidebar" aria-label="Molecule selection">
        <div className="sidebar-top"><div className="small-heading"><h3>Evaluation set</h3><span>{research.meta.sampleCount}</span></div><label className="search-label" htmlFor="molecule-search">Find a molecule</label><div className="search-field"><svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.6" /></svg><input id="molecule-search" type="search" placeholder="Search SMILES or ESOL ID" value={query} onChange={e => { const text = e.target.value; setQuery(text); setStatus(''); const matches = matchingRecords(text); const active = matches.find(r => r.id === selectedId) ?? matches[0]; if (active) onSelected(active) }} /></div><p role="status" className="micro search-count">{filtered.length} {filtered.length === 1 ? 'match' : 'matches'} in the saved evaluation</p><p className="mini-label">Examples</p><div className="example-buttons">{research.examples.map(e => <button key={e.id} onClick={() => example(e.id)}>{e.label}<Arrow /></button>)}</div></div>
        <div className="molecule-list" role="group" aria-label="Evaluated molecules">{filtered.map(record => <button key={record.id} aria-pressed={record.id === molecule?.id} className={`molecule-option ${record.id === molecule?.id ? 'selected' : ''}`} onClick={() => choose(record)}><span><strong>{label(record)}</strong><span>{record.atoms} atoms · {record.rings} rings</span></span></button>)}{!filtered.length && <p className="empty-sidebar">No saved molecules match this search.</p>}</div>
        <button className="reset-button" onClick={reset}><Icon name="replay" />Reset explorer</button>
      </aside>
      <div className="explorer-detail" role="region" aria-label="Selected molecule results">
        {!molecule ? <div className="empty-state"><Icon name="molecule" size={32} /><h3>Not present in this evaluation</h3><p>Search the {research.meta.sampleCount} saved ESOL molecules by SMILES or ID, or choose an example. This site does not run predictions for unseen molecules.</p><button className="button primary" onClick={reset}>Return to an example <Arrow /></button></div> : <>
          <div className="molecule-heading"><div><p className="mini-label">Test observation / {String(molecule.ordinal).padStart(3, '0')}</p><h3>{label(molecule)} <span>Delaney ESOL</span></h3></div><button className="button compact secondary" onClick={download} aria-label="Download selected molecule result">Export result <Arrow down /></button></div>
          <div className="molecule-stage"><div className="structure-panel"><div className="structure-toolbar"><span className="mini-label">Molecular structure</span><div className="structure-actions">{dimension === '2d' && <button className="assemble-btn" onClick={() => setReplayCount(c => c + 1)} title="Replay molecular assembly animation" aria-label="Replay molecular assembly animation"><Icon name="replay" /> Replay assembly</button>}<div className="segmented" role="group" aria-label="Structure display"><button aria-pressed={dimension === '2d'} onClick={() => setDimension('2d')}>2D</button><button aria-pressed={dimension === '3d'} onClick={() => setDimension('3d')}>3D</button></div></div></div>{dimension === '2d' ? <MolecularStructure2D key={molecule.id} structure={molecule.structure} name={label(molecule)} id={molecule.id} replayCount={replayCount} /> : <VisualBoundary key={`${molecule.id}-${replayCount}`}><Suspense fallback={<p className="viewer-loading" role="status">Loading conformer viewer…</p>}><ConformerViewer path={molecule.conformer} name={label(molecule)} /></Suspense></VisualBoundary>}<div className="structure-meta"><span>{molecule.atoms} heavy atoms</span><span>{molecule.rings} rings</span><span>{fmt(molecule.mass, 2)} g/mol</span></div></div><div className="observation-card"><p className="mini-label">Experimental log solubility</p><strong>{fmt(molecule.target)}</strong><span className="unit">log₁₀(mol/L)</span><div className="observed-divider" /><p className="mini-label">Fused prediction</p><span className="fused-value">{fmt(molecule.predictions.fused)}</span><span className="error-pill">Absolute error {fmt(absoluteError(molecule, 'fused'))}</span><p className="micro">Saved test observation.</p></div></div>
          <div className="smiles-box"><div className="small-heading"><span className="mini-label">Source SMILES</span><button onClick={copySmiles} className="text-button" aria-label="Copy SMILES">Copy SMILES <Icon name="copy" /></button></div><code>{molecule.smiles}</code></div>
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
  { title: 'The molecule as a sequence', input: 'SMILES string', detail: 'Character embeddings and a Transformer encode SMILES. Trained from scratch; no pretrained ChemBERTa weights.', representation: '1D', symbol: 'C C ( O )', annotation: 'Character-level Transformer' },
  { title: 'The molecule as a connected structure', input: 'Atoms + bonds + BRICS motifs', detail: 'Atom messages, BRICS pooling and a motif Transformer encode structure. Computed ECFP4 features are unused.', representation: '2D', symbol: 'molecule', annotation: 'Atom + motif graph encoder' },
  { title: 'The molecule as spatial relationships', input: 'Conformer distance features', detail: 'Atom features and fixed RBF distances encode geometry. The coordinate-update branch does not affect predictions.', representation: '3D', symbol: 'geometry', annotation: 'Distance-based geometric encoder' },
]

function Architecture({ molecule }: { molecule: Molecule }) {
  const [selected, setSelected] = useState(0)
  const note = architectureNotes[selected]
  const view = research.views[selected]
  return <section id="architecture" className="section wrap"><SectionHeading title="Model architecture"><p>Select a representation to inspect its encoder and saved prediction.</p></SectionHeading><div className="architecture-grid"><div className="architecture-diagram"><p className="mini-label diagram-caption">Implemented model flow</p><div className="encoder-row">{architectureNotes.map((item, i) => <button key={item.representation} aria-pressed={i === selected} onClick={() => setSelected(i)} style={{ '--view-color': research.views[i].color } as CSSProperties}><span className="encoder-number">0{i + 1} / {item.representation}</span><span className="encoder-symbol" aria-hidden="true">{item.symbol === "molecule" || item.symbol === "geometry" ? <Icon name={item.symbol} size={30} /> : item.symbol}</span><strong>{research.views[i].name}</strong><span>{item.annotation}</span></button>)}</div><div className="flow-connectors" aria-hidden="true"><span /><span /><span /></div><div className="contrastive-strip"><span className="connection-dot" />Contrastive alignment <span className="micro">shared training objective</span></div><div className="flow-down" aria-hidden="true"><Arrow down /></div><div className="fusion-row"><div>Dynamic view gating<span>Weighted representation</span></div><span aria-hidden="true">+</span><div>Cross-modal Transformer<span>Interactions between views</span></div></div><div className="flow-down" aria-hidden="true"><Arrow down /></div><div className="output-node">Fused property prediction <span>log solubility</span><Arrow /></div></div><div className="architecture-note" style={{ '--view-color': view.color } as CSSProperties}><p className="mini-label">View {selected + 1} / {note.representation} representation</p><h3>{note.title}</h3><p>{note.detail}</p><div className="input-label"><span className="mini-label">Input</span><span>{note.input}</span></div><div className="architecture-prediction"><p>Selected explorer molecule <strong>{label(molecule)}</strong></p><span>{fmt(molecule.predictions[view.key])}<small>log₁₀(mol/L)</small></span><p className="micro">View-specific prediction · Experimental {fmt(molecule.target)}</p></div></div></div><p className="footnote">All four prediction heads are jointly trained; this is a within-model comparison.</p></section>
}

function ResearchResources() {
  const resources = [
    { name: 'Saved test predictions', detail: 'Fused predictions + per-molecule routing weights · CSV', path: 'tribionode_fused_predictions.csv', tag: '113 rows' },
    { name: 'Evaluation summary', detail: 'Four prediction heads · RMSE, MAE, R² · CSV', path: 'views_evaluation_summary.csv', tag: 'Measured' },
    { name: 'Source provenance', detail: 'Revision, SHA-256 checksums, and preparation method · JSON', path: 'provenance.json', tag: 'Traceable' },
  ]
  return <section id="research" className="section research-section"><div className="wrap"><SectionHeading title="Research resources"><p>Source artifacts, evaluation protocol and implementation notes.</p></SectionHeading><div className="research-grid"><article className="research-story"><p className="mini-label">The research question</p><h3>Multi-view molecular learning</h3><p>TriBioNode combines molecular sequences, atom–motif graphs and 3D distance features to predict aqueous solubility.</p><p>The fused head has the lowest RMSE among the jointly trained heads in this saved ESOL run. Broader performance claims require further evaluation.</p></article><article className="evidence-card"><p className="mini-label">How to read these results</p><h3>Evaluation notes</h3><ul><li><strong>Evaluation protocol</strong><span>Reported 80/10/10 Bemis–Murcko scaffold split; not independently verified.</span></li><li><strong>A single saved run</strong><span>One saved run with {research.meta.sampleCount} observations; no seed variability or calibrated uncertainty established.</span></li><li><strong>Implementation limits</strong><span>Checkpoint storage is shared and coordinate updates do not affect predictions. Correct these before re-evaluation.</span></li><li><strong>Proposed work versus measured work</strong><span>Only the saved ESOL predictions support the measured metrics shown here.</span></li></ul></article></div><div className="resources-heading"><h3>Source downloads</h3><span className="mini-label">Download & reproduce</span></div><div className="resource-list">{resources.map(r => <a key={r.path} className="resource-link" href={asset(`downloads/${r.path}`)} download><span className="resource-icon" aria-hidden="true"><Icon name="download" size={22} /></span><span><strong>{r.name}</strong><small>{r.detail}</small></span><span className="resource-tag">{r.tag}</span><Arrow /></a>)}</div><details className="additional-resources"><summary>View-specific CSVs & manuscript draft <Icon name="plus" /></summary><div><p className="micro">Unvalidated manuscript draft. Additional tables and claims are not established by this saved evaluation; figure links refer to the source repository.</p><div className="download-chips">{research.views.slice(0, 3).map((v, i) => <a key={v.key} href={asset(`downloads/view${i + 1}_predictions_and_metrics.csv`)} download>{v.label} predictions <Icon name="download" /></a>)}<a href={asset('downloads/manuscript-draft.md')} download>Unvalidated manuscript draft <Icon name="download" /></a><a href={asset('downloads/README.txt')} download>Artifact notes <Icon name="download" /></a></div></div></details><div className="provenance-line"><span className="status-badge"><span />Checked against saved artifacts</span><span>Source revision <code>{research.meta.sourceRevision?.slice(0, 7) ?? 'unavailable'}</code> · Molecular drawings: RDKit {research.meta.rdkitVersion}</span></div></div></section>
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoPaused, setLogoPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { if (preference.matches) setLogoPaused(true) }
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  const [activeSection, setActiveSection] = useState('overview')
  const [scrolled, setScrolled] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const initialSection = document.getElementById(window.location.hash.slice(1))
    initialSection?.scrollIntoView({ behavior: 'instant' })
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id)
    }, { rootMargin: '-15% 0px -65% 0px' })
    document.querySelectorAll('main section[id]').forEach(section => observer.observe(section))
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll) }
  }, [])
  const [selectedMolecule, setSelectedMolecule] = useState(heroMolecule)
  const links = [['overview', 'Overview'], ['explorer', 'Molecules'], ['results', 'Results'], ['architecture', 'Architecture'], ['research', 'Resources']]
  return <>
    <a className="skip-link" href="#main">Skip to main content</a>
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`} onKeyDown={event => {
      if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuButton.current?.focus() }
    }}><div className="wrap header-inner"><Logo paused={logoPaused} /><button ref={menuButton} className="menu-button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close menu' : 'Menu'}<Icon name={menuOpen ? "close" : "menu"} /></button><nav id="main-navigation" aria-label="Main navigation" className={menuOpen ? 'is-open' : ''}>{links.map(([id, name]) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined} onClick={() => setMenuOpen(false)}>{name}</a>)}</nav><a className="header-action" href="#explorer">Explore molecules <Arrow /></a></div></header>
    <main id="main"><ArchitectureFilm paused={logoPaused} setPaused={setLogoPaused} />
      <MoleculeExplorer onSelected={setSelectedMolecule} />
      <section id="results" className="section results-section"><div className="wrap"><SectionHeading title="ESOL evaluation"><p>Metrics recalculated from {research.meta.sampleCount} saved test observations.</p></SectionHeading><VisualBoundary><Suspense fallback={<div className="chart-loading" role="status">Loading measured result charts…</div>}><ResultsCharts /></Suspense></VisualBoundary><div className="results-caption"><span className="connection-dot" /><p>ESOL · log₁₀(mol/L) · Single saved run. See evaluation notes for limitations.</p></div></div></section>
      <Architecture molecule={selectedMolecule} />
      <ResearchResources />
    </main><footer className="site-footer"><div className="wrap footer-main"><div><Logo paused={logoPaused} /><p>Multi-view molecular property prediction.</p></div><div><span className="mini-label">Explore</span><a href="#explorer">Molecules</a><a href="#results">Measured results</a><a href="#architecture">Model architecture</a></div><div><span className="mini-label">Research snapshot</span><p>Delaney ESOL · {research.meta.sampleCount} test observations<br />For research and education.</p><a href={asset('downloads/provenance.json')} download>Download provenance <Icon name="download" /></a></div></div><div className="wrap footer-bottom"><span>TriBioNode / Molecular Research</span><a href="#overview">Back to top <Icon name="up" /></a></div></footer>
  </>
}
