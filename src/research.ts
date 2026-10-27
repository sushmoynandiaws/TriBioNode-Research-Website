import raw from './research-data.json'

export type ViewKey = 'view1' | 'view2' | 'view3' | 'fused'
export type MetricKey = 'RMSE' | 'MAE' | 'R2'
export type Molecule = {
  id: string
  ordinal: number
  smiles: string
  canonicalSmiles: string
  target: number
  predictions: Record<ViewKey, number>
  gates: number[]
  structure: string
  conformer: string | null
  atoms: number
  rings: number
  mass: number
}
export type View = {
  key: ViewKey
  label: string
  name: string
  color: string
  description: string
  metrics: Record<MetricKey, number>
}
export const research = { ...raw, views: raw.views.map(view => ({ ...view, color: `var(--${view.key})` })) } as Omit<typeof raw, 'records' | 'views'> & { records: Molecule[]; views: View[] }
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`
export const fmt = (value: number, digits = 3) => value.toFixed(digits)
export const label = (molecule: Molecule) => `ESOL ${String(molecule.ordinal).padStart(3, '0')}`
export const absoluteError = (molecule: Molecule, view: ViewKey) => Math.abs(molecule.target - molecule.predictions[view])
export const heroMolecule = research.records.find(r => r.id === research.examples[2].id)!

export function matchingRecords(query: string) {
  const text = query.trim().toLowerCase()
  return research.records.filter(r => `${r.id} ${label(r)} ${r.smiles} ${r.canonicalSmiles}`.toLowerCase().includes(text))
}

export function resultExport(molecule: Molecule) {
  return {
    evaluation: 'Saved ESOL test observation',
    id: molecule.id,
    smiles: molecule.smiles,
    unit: 'log10(mol/L)',
    experimental: molecule.target,
    predictions: molecule.predictions,
    absoluteErrors: Object.fromEntries(research.views.map(v => [v.key, absoluteError(molecule, v.key)])),
    gatingWeights: Object.fromEntries(research.views.slice(0, 3).map((v, i) => [v.key, molecule.gates[i]])),
    sourceRevision: research.meta.sourceRevision,
    note: 'View-specific heads were jointly trained. Gating is model routing, not causal feature importance.',
  }
}
