"""Validate research artifacts and prepare a static, traceable website dataset."""
import argparse
import ast
import csv
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT.parent / 'Research TriBioNode' / 'ADD_thesis'
FILES = [
    ('view1', 'view1_predictions_and_metrics.csv', 'pred_view1'),
    ('view2', 'view2_predictions_and_metrics.csv', 'pred_view2'),
    ('view3', 'view3_predictions_and_metrics.csv', 'pred_view3'),
    ('fused', 'tribionode_fused_predictions.csv', 'pred_fused'),
]
VIEWS = [
    {'key': 'view1', 'label': 'View 1', 'name': 'Sequence', 'color': '#2872b8', 'description': 'Character-level SMILES Transformer'},
    {'key': 'view2', 'label': 'View 2', 'name': 'Structure', 'color': '#8b5aaa', 'description': 'Atom graph + BRICS motif Transformer'},
    {'key': 'view3', 'label': 'View 3', 'name': 'Geometry', 'color': '#a35224', 'description': 'Geometric encoder with fixed RBF distance features'},
    {'key': 'fused', 'label': 'TriBioNode', 'name': 'Fused', 'color': '#087b68', 'description': 'Gated representations + cross-modal fusion'},
]


def read_csv(path):
    with path.open(encoding='utf-8', newline='') as handle:
        return list(csv.DictReader(handle))


def number(value, context):
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{context}: expected a number') from exc
    if not math.isfinite(result):
        raise ValueError(f'{context}: non-finite value')
    return result


def metrics(targets, predictions):
    if len(targets) != len(predictions) or len(targets) < 2:
        raise ValueError('Metrics require at least two aligned predictions')
    mean = sum(targets) / len(targets)
    variance = sum((v - mean) ** 2 for v in targets)
    if variance == 0:
        raise ValueError('R-squared is undefined for constant targets')
    squared_error = sum((a - b) ** 2 for a, b in zip(targets, predictions))
    return {
        'RMSE': math.sqrt(squared_error / len(targets)),
        'MAE': sum(abs(a - b) for a, b in zip(targets, predictions)) / len(targets),
        'R2': 1 - squared_error / variance,
    }


def validate_and_join(tables, summary):
    """Keep source row order, including repeated SMILES with distinct observations."""
    reference = tables['fused']
    if len(reference) != 113:
        raise ValueError(f'Expected the audited 113 records, found {len(reference)}')
    if len(summary) != 4:
        raise ValueError('Expected four summary rows')
    records = []
    for i, ref in enumerate(reference):
        smiles = ref['smiles'].strip()
        if not smiles:
            raise ValueError(f'Row {i + 1}: empty SMILES')
        target = number(ref['target_true'], f'Row {i + 1} target')
        predictions = {}
        for key, _, column in FILES:
            rows = tables[key]
            if len(rows) != len(reference):
                raise ValueError(f'{key}: row count mismatch')
            row = rows[i]
            if row['smiles'] != ref['smiles'] or number(row['target_true'], key) != target:
                raise ValueError(f'{key}: alignment mismatch at row {i + 1}')
            predictions[key] = number(row[column], f'{key} row {i + 1}')
        gates = [number(ref[f'gate_w_v{j}'], f'Gate {j} row {i + 1}') for j in range(1, 4)]
        if any(v < 0 or v > 1 for v in gates) or abs(sum(gates) - 1) > 1e-5:
            raise ValueError(f'Invalid gating weights at row {i + 1}')
        records.append({'id': f'esol-{i + 1:03d}', 'ordinal': i + 1,
                        'smiles': smiles, 'target': target,
                        'predictions': predictions, 'gates': gates})
    views = []
    targets = [r['target'] for r in records]
    for i, view in enumerate(VIEWS):
        result = metrics(targets, [r['predictions'][view['key']] for r in records])
        for key, value in result.items():
            if abs(value - number(summary[i][key], f'Summary {key}')) > 1e-5:
                raise ValueError(f"Summary mismatch: {view['key']} {key}")
        views.append({**view, 'metrics': result})
    return records, views


def catalogue_count(source):
    nb = json.loads((source / '01_EDA_Comprehensive_Molecular_Benchmarks.ipynb').read_text(encoding='utf-8'))
    for cell in nb['cells']:
        if cell['cell_type'] != 'code':
            continue
        for node in ast.parse(''.join(cell['source'])).body:
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'DATASET_CATALOG' for t in node.targets):
                return len(ast.literal_eval(node.value))
    raise ValueError('Dataset catalogue not found in EDA notebook')


def prepare(source):
    import numpy as np
    from rdkit import Chem, rdBase
    from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
    from rdkit.Chem.Draw import rdMolDraw2D

    tables = {key: read_csv(source / 'outputs' / filename) for key, filename, _ in FILES}
    summary = read_csv(source / 'outputs/views_evaluation_summary.csv')
    records, views = validate_and_join(tables, summary)
    with np.load(source / 'outputs/multiview_embeddings.npz', allow_pickle=False) as npz:
        expected = {'h_v1': (113, 128), 'h_v2': (113, 128), 'h_v3': (113, 128),
                    'h_fused': (113, 256), 'gate_weights': (113, 3), 'targets': (113, 1), 'smiles': (113,)}
        if set(npz.files) != set(expected):
            raise ValueError('Unexpected NPZ keys')
        for key, shape in expected.items():
            if npz[key].shape != shape:
                raise ValueError(f'Unexpected embedding shape for {key}')
            if key != 'smiles' and not np.isfinite(npz[key]).all():
                raise ValueError(f'Non-finite NPZ values: {key}')
        if [s.strip() for s in npz['smiles'].tolist()] != [r['smiles'] for r in records]:
            raise ValueError('NPZ molecule order mismatch')
        if not np.allclose(npz['targets'].flatten(), [r['target'] for r in records], atol=1e-6, rtol=0):
            raise ValueError('NPZ targets mismatch')
        if not np.allclose(npz['gate_weights'], [r['gates'] for r in records], atol=1e-6, rtol=0):
            raise ValueError('NPZ gates mismatch')
    public = ROOT / 'public'
    for directory in ['molecules', 'conformers', 'downloads']:
        (public / directory).mkdir(parents=True, exist_ok=True)
    for record in records:
        mol = Chem.MolFromSmiles(record['smiles'])
        if mol is None or mol.GetNumAtoms() == 0:
            raise ValueError(f"Invalid molecule {record['id']}")
        record['atoms'] = mol.GetNumHeavyAtoms()
        record['rings'] = rdMolDescriptors.CalcNumRings(mol)
        record['mass'] = round(Descriptors.MolWt(mol), 2)
        record['canonicalSmiles'] = Chem.MolToSmiles(mol)
        drawer = rdMolDraw2D.MolDraw2DSVG(560, 340)
        options = drawer.drawOptions()
        options.clearBackground = False
        options.padding = 0.13
        options.bondLineWidth = 2.0
        rdMolDraw2D.PrepareAndDrawMolecule(drawer, mol)
        drawer.FinishDrawing()
        record['structure'] = f"molecules/{record['id']}.svg"
        (public / record['structure']).write_text(drawer.GetDrawingText(), encoding='utf-8')
        record['conformer'] = None
        # Fresh visualization conformers are separate from the original training geometry.
        mol3d = Chem.AddHs(mol)
        params = AllChem.ETKDGv3()
        params.randomSeed = 42
        params.maxIterations = 100
        if AllChem.EmbedMolecule(mol3d, params) == 0:
            optimization = 'ETKDGv3; no MMFF parameters available'
            if AllChem.MMFFHasAllMoleculeParams(mol3d):
                status = AllChem.MMFFOptimizeMolecule(mol3d, maxIters=100)
                optimization = 'ETKDGv3 + MMFF94 (' + ('converged' if status == 0 else 'iteration limit reached') + ')'
            heavy = Chem.RemoveHs(mol3d)
            xyz = heavy.GetConformer().GetPositions()
            if not np.isfinite(xyz).all():
                raise ValueError(f"Non-finite conformer: {record['id']}")
            geometry = {'atoms': [{'element': a.GetSymbol(), 'position': [round(float(v), 5) for v in xyz[a.GetIdx()]]} for a in heavy.GetAtoms()],
                        'bonds': [{'start': b.GetBeginAtomIdx(), 'end': b.GetEndAtomIdx(), 'order': b.GetBondTypeAsDouble()} for b in heavy.GetBonds()],
                        'method': optimization}
            record['conformer'] = f"conformers/{record['id']}.json"
            (public / record['conformer']).write_text(json.dumps(geometry, allow_nan=False), encoding='utf-8')
    def error(r, key='fused'):
        return abs(r['target'] - r['predictions'][key])
    examples = [
        {'label': 'Closest prediction', 'id': min(records, key=error)['id']},
        {'label': 'Largest error', 'id': max(records, key=error)['id']},
        {'label': 'Fusion advantage', 'id': max(records, key=lambda r: min(error(r, v['key']) for v in views[:3]) - error(r))['id']},
    ]
    paths = [f'outputs/{name}' for _, name, _ in FILES] + [
        'outputs/views_evaluation_summary.csv', 'outputs/multiview_embeddings.npz',
        '01_EDA_Comprehensive_Molecular_Benchmarks.ipynb',
        '02_Train_TriBioNode_MultiView_Architecture.ipynb',
        'reports/TRIBIONODE_V2_PAPER_DRAFT.md',
    ]
    try:
        revision = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        revision = None
    provenance = {'sourceRevision': revision, 'sourceFiles': [
        {'path': name, 'sha256': hashlib.sha256((source / name).read_bytes()).hexdigest()} for name in paths],
        'method': 'Strict row alignment; finite values; probability bounds and sums; recomputed metrics matched to source summary within 1e-5; NPZ alignment checks.',
        'sampleCount': len(records), 'catalogueCount': catalogue_count(source),
        'rdkitVersion': rdBase.rdkitVersion, 'numpyVersion': np.__version__,
        'split': '80/10/10 Bemis–Murcko scaffold split as reported by the training notebook; original dataset not included, split not independently verified.',
        'geometry': 'Fresh deterministic RDKit ETKDGv3 visualization conformers, not recovered training coordinates.',
        'embeddingShapes': {key: list(shape) for key, shape in expected.items()},
    }
    data = {'meta': provenance, 'views': views, 'records': records, 'examples': examples,
            'meanGates': [sum(r['gates'][i] for r in records) / len(records) for i in range(3)]}
    (ROOT / 'src').mkdir(exist_ok=True)
    (ROOT / 'src/research-data.json').write_text(json.dumps(data, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    for _, filename, _ in FILES:
        shutil.copyfile(source / 'outputs' / filename, public / 'downloads' / filename)
    shutil.copyfile(source / 'outputs/views_evaluation_summary.csv', public / 'downloads/views_evaluation_summary.csv')
    shutil.copyfile(source / 'reports/TRIBIONODE_V2_PAPER_DRAFT.md', public / 'downloads/manuscript-draft.md')
    (public / 'downloads/provenance.json').write_text(json.dumps(provenance, indent=2), encoding='utf-8')
    (public / 'downloads/README.txt').write_text(
        'TriBioNode research export\n\n'
        'Prediction CSVs contain the 113 saved ESOL test observations.\n'
        'Manuscript-draft.md is an unvalidated draft. It contains claims and tables not supported by these saved outputs. '
        'It is provided for research context, not as validated performance evidence. Relative figure links refer to the original research repository and are not bundled.\n'
        'provenance.json records source checksums, revision, preparation method, and limitations.\n', encoding='utf-8')
    print(f'Prepared {len(records)} aligned records, {len(views)} verified metric sets, '
          f"{sum(r['conformer'] is not None for r in records)} visualization conformers.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    prepare(args.source.resolve())
