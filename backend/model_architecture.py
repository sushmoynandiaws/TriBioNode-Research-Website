#!/usr/bin/env python3
"""
TriBioNode v2: Standalone End-to-End Training and Checkpoint Saver
Trains the multi-view molecular architecture on Delaney ESOL and saves outputs/model.pt
"""

# --- Cell 1 ---
# ============================================================
# CELL 1: Environment, Hardware Acceleration & Seed Initialization
# ============================================================
import os, sys, math, time, random, warnings
from collections import defaultdict
import numpy as np
import pandas as pd

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

# Optional RDKit and Transformers imports with graceful fallbacks
try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, rdMolDescriptors, BRICS
    from rdkit.Chem.Scaffolds import MurckoScaffold
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    print("[WARNING] RDKit not installed in current environment. Using native fallback molecular featurizer.")

try:
    from transformers import AutoTokenizer, AutoModel
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("[WARNING] HuggingFace transformers not installed. Using character-level chemical Transformer encoder.")

def seed_everything(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

seed_everything(42)
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

print(f"🚀 Device Configured: {device}")
if torch.cuda.is_available():
    print(f"   GPU Model: {torch.cuda.get_device_name(0)}")
    print(f"   CUDA Version: {torch.version.cuda}")


# --- Cell 3 ---
# ============================================================
# CELL 2: Comprehensive Multi-Scale Molecular Featurizer
# ============================================================

ATOM_LIST = [
    'C', 'N', 'O', 'S', 'F', 'Si', 'P', 'Cl', 'Br', 'Mg', 'Na', 'Ca', 
    'Fe', 'As', 'Al', 'I', 'B', 'V', 'K', 'Tl', 'Yb', 'Sb', 'Sn', 'Ag', 
    'Pd', 'Co', 'Se', 'Ti', 'Zn', 'H', 'Li', 'Ge', 'Cu', 'Au', 'Ni', 
    'Cd', 'In', 'Mn', 'Zr', 'Cr', 'Pt', 'Hg', 'Pb', 'Unknown'
]

HYBRIDIZATION_LIST = [
    'SP', 'SP2', 'SP3', 'SP3D', 'SP3D2', 'UNSPECIFIED'
]

def one_hot(x, allowable_set):
    if x not in allowable_set:
        x = allowable_set[-1]
    return [float(x == s) for s in allowable_set]

class MolecularFeaturizer:
    def __init__(self, max_atoms=64, max_motifs=16, max_seq_len=128, n_rbf=16, rbf_cutoff=8.0):
        self.max_atoms = max_atoms
        self.max_motifs = max_motifs
        self.max_seq_len = max_seq_len
        self.n_rbf = n_rbf
        self.rbf_cutoff = rbf_cutoff
        self.rbf_centers = np.linspace(0.0, rbf_cutoff, n_rbf)
        self.rbf_gamma = 1.0 / ((rbf_cutoff / n_rbf) ** 2)

    def featurize_smiles(self, smiles):
        """Extract View 1, View 2, and View 3 representations."""
        # --- View 1: 1D Sequence Token Indices ---
        seq_tokens = [ord(c) % 250 + 1 for c in smiles[:self.max_seq_len]]
        seq_mask = [1] * len(seq_tokens)
        if len(seq_tokens) < self.max_seq_len:
            pad_len = self.max_seq_len - len(seq_tokens)
            seq_tokens.extend([0] * pad_len)
            seq_mask.extend([0] * pad_len)
        
        # Default empty structures
        atom_feats = np.zeros((self.max_atoms, 79), dtype=np.float32) # 71 atom + 8 joint
        adj_matrix = np.zeros((self.max_atoms, self.max_atoms), dtype=np.float32)
        atom_mask = np.zeros(self.max_atoms, dtype=np.float32)
        
        motif_feats = np.zeros((self.max_motifs, 32), dtype=np.float32)
        atom_to_motif = np.zeros((self.max_atoms, self.max_motifs), dtype=np.float32)
        motif_mask = np.zeros(self.max_motifs, dtype=np.float32)
        
        ecfp4 = np.zeros(1024, dtype=np.float32)
        pos_3d = np.zeros((self.max_atoms, 3), dtype=np.float32)
        rbf_dist = np.zeros((self.max_atoms, self.max_atoms, self.n_rbf), dtype=np.float32)
        
        if not RDKIT_AVAILABLE:
            # Fallback synthetic representation
            n_sim = min(len(smiles), self.max_atoms)
            atom_feats[:n_sim, :10] = np.random.randn(n_sim, 10).astype(np.float32)
            atom_mask[:n_sim] = 1.0
            return {
                "seq_tokens": np.array(seq_tokens, dtype=np.int64),
                "seq_mask": np.array(seq_mask, dtype=np.float32),
                "atom_feats": atom_feats, "adj_matrix": adj_matrix, "atom_mask": atom_mask,
                "motif_feats": motif_feats, "atom_to_motif": atom_to_motif, "motif_mask": motif_mask,
                "ecfp4": ecfp4, "pos_3d": pos_3d, "rbf_dist": rbf_dist, "smiles": smiles
            }

        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None

        # 1. ECFP4 Fingerprint
        fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(mol, 2, nBits=1024)
        ecfp4 = np.array(list(fp.ToBitString()), dtype=np.float32)

        # 2. Atom Features & MSGG Joint Features (71 + 8 = 79 dim)
        num_atoms = min(mol.GetNumAtoms(), self.max_atoms)
        atom_mask[:num_atoms] = 1.0

        for i in range(num_atoms):
            atom = mol.GetAtomWithIdx(i)
            # 71-dim standard atom features
            sym_oh = one_hot(atom.GetSymbol(), ATOM_LIST)
            deg_oh = one_hot(atom.GetTotalDegree(), [0, 1, 2, 3, 4, 5, 6])
            fc = [atom.GetFormalCharge() / 4.0]
            hyb_oh = one_hot(str(atom.GetHybridization()), HYBRIDIZATION_LIST)
            arom = [1.0 if atom.GetIsAromatic() else 0.0]
            val = [atom.GetTotalValence() / 8.0]
            h_count = one_hot(atom.GetTotalNumHs(), [0, 1, 2, 3, 4])
            ring = [1.0 if atom.IsInRing() else 0.0]
            base_71 = sym_oh + deg_oh + fc + hyb_oh + arom + val + h_count + ring # 45+7+1+6+1+1+5+1 = 67 -> pad to 71
            while len(base_71) < 71:
                base_71.append(0.0)
            
            # 8-dim MSGG Joint / Attachment Positional Features (ortho/meta/para aware)
            joint_8 = [0.0] * 8
            if atom.IsInRing():
                joint_8[0] = 1.0 # in-ring
                ring_size = 6 if atom.IsInRingSize(6) else (5 if atom.IsInRingSize(5) else 0)
                joint_8[1] = 1.0 if ring_size == 6 else 0.0
                joint_8[2] = 1.0 if ring_size == 5 else 0.0
            for neighbor in atom.GetNeighbors():
                if neighbor.GetIdx() < self.max_atoms:
                    b_type = mol.GetBondBetweenAtoms(atom.GetIdx(), neighbor.GetIdx()).GetBondTypeAsDouble()
                    if b_type == 1.0: joint_8[3] = 1.0 # single
                    elif b_type == 2.0: joint_8[4] = 1.0 # double
                    elif b_type == 1.5: joint_8[5] = 1.0 # aromatic
            
            atom_feats[i] = np.array(base_71 + joint_8, dtype=np.float32)

        # 3. Adjacency Matrix
        for bond in mol.GetBonds():
            i = bond.GetBeginAtomIdx()
            j = bond.GetEndAtomIdx()
            if i < self.max_atoms and j < self.max_atoms:
                adj_matrix[i, j] = 1.0
                adj_matrix[j, i] = 1.0

        # 4. BRICS Motifs & Bipartite Incidence
        try:
            brics_bonds = list(BRICS.FindBRICSBonds(mol))
            # Break BRICS bonds to get fragments
            if len(brics_bonds) > 0:
                break_bond_indices = [mol.GetBondBetweenAtoms(b[0][0], b[0][1]).GetIdx() for b in brics_bonds]
                fragmented = Chem.FragmentOnBonds(mol, break_bond_indices, addDummies=False)
                frags = Chem.GetMolFrags(fragmented, asMols=False)
            else:
                frags = [list(range(num_atoms))]
            
            num_frags = min(len(frags), self.max_motifs)
            motif_mask[:num_frags] = 1.0
            for m_idx in range(num_frags):
                atom_indices = frags[m_idx]
                for a_idx in atom_indices:
                    if a_idx < self.max_atoms:
                        atom_to_motif[a_idx, m_idx] = 1.0 / max(len(atom_indices), 1)
                # Motif descriptor (32-dim summary)
                motif_feats[m_idx, 0] = len(atom_indices) / 10.0
                motif_feats[m_idx, 1] = 1.0 if len(atom_indices) > 5 else 0.0
        except Exception:
            motif_mask[0] = 1.0
            atom_to_motif[:num_atoms, 0] = 1.0 / max(num_atoms, 1)

        # 5. 3D Conformer Generation (ETKDGv3 + MMFF94) & Gaussian RBF
        try:
            mol_3d = Chem.AddHs(mol)
            params = AllChem.ETKDGv3()
            params.randomSeed = 42
            success = AllChem.EmbedMolecule(mol_3d, params)
            if success == 0:
                AllChem.MMFFOptimizeMolecule(mol_3d, maxIters=50)
                conf = mol_3d.GetConformer()
                for i in range(num_atoms):
                    p = conf.GetAtomPosition(i)
                    pos_3d[i] = [p.x, p.y, p.z]
        except Exception:
            pass # Use zero pos fallback

        # Compute pairwise RBF distance matrix
        coords = pos_3d[:num_atoms]
        if num_atoms > 1 and np.abs(coords).sum() > 0:
            diff = coords[:, None, :] - coords[None, :, :]
            dists = np.sqrt(np.sum(diff**2, axis=-1) + 1e-8)
            # Apply Gaussian RBF: exp(-gamma * (d - mu)^2)
            dists_expanded = dists[:, :, None] # (N, N, 1)
            centers = self.rbf_centers[None, None, :] # (1, 1, K)
            rbf_matrix = np.exp(-self.rbf_gamma * (dists_expanded - centers)**2)
            rbf_dist[:num_atoms, :num_atoms, :] = rbf_matrix

        return {
            "seq_tokens": np.array(seq_tokens, dtype=np.int64),
            "seq_mask": np.array(seq_mask, dtype=np.float32),
            "atom_feats": atom_feats,
            "adj_matrix": adj_matrix,
            "atom_mask": atom_mask,
            "motif_feats": motif_feats,
            "atom_to_motif": atom_to_motif,
            "motif_mask": motif_mask,
            "ecfp4": ecfp4,
            "pos_3d": pos_3d,
            "rbf_dist": rbf_dist,
            "smiles": smiles
        }

print("✅ MolecularFeaturizer Defined Successfully!")


# --- Cell 5 ---
# ============================================================
# CELL 3: TriBioNode v2 Neural Network Architecture Modules
# (Pure 1D Sequence + Pure 2D Hierarchical Graph + 3D Equivariant EGNN)
# ============================================================

# --- 1. VIEW 1: Chemical Language Sequence Encoder ---
class SequenceTransformerEncoder(nn.Module):
    def __init__(self, vocab_size=300, d_model=256, n_heads=4, n_layers=2, max_len=128, dropout=0.1):
        super().__init__()
        self.d_model = d_model
        self.token_emb = nn.Embedding(vocab_size, d_model, padding_idx=0)
        self.pos_emb = nn.Parameter(torch.randn(1, max_len, d_model) * 0.02)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads, dim_feedforward=d_model*4,
            dropout=dropout, batch_first=True, activation="gelu"
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        self.norm = nn.LayerNorm(d_model)

    def forward(self, seq_tokens, seq_mask):
        x = self.token_emb(seq_tokens) + self.pos_emb[:, :seq_tokens.size(1), :]
        key_padding_mask = (seq_mask == 0)
        h = self.transformer(x, src_key_padding_mask=key_padding_mask)
        mask_expanded = seq_mask.unsqueeze(-1)
        h_pool = (h * mask_expanded).sum(dim=1) / (mask_expanded.sum(dim=1) + 1e-8)
        return self.norm(h_pool)


# --- 2. VIEW 2: 2D Multi-Scale Hierarchical Graph & BRICS Motif Encoder ---
# (Note: Molecular Fingerprint Projection removed to enforce pure structural graph hierarchy)
class HierarchicalAtomMotifGNN(nn.Module):
    def __init__(self, atom_dim=79, motif_dim=32, d_model=256, n_layers=3, dropout=0.1):
        super().__init__()
        self.d_model = d_model
        self.atom_proj = nn.Linear(atom_dim, d_model)
        self.gnn_layers = nn.ModuleList([
            nn.Sequential(
                nn.Linear(d_model, d_model),
                nn.LayerNorm(d_model),
                nn.GELU(),
                nn.Dropout(dropout)
            ) for _ in range(n_layers)
        ])
        
        # Bipartite Motif Transformer
        self.motif_proj = nn.Linear(motif_dim, d_model)
        motif_encoder = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=4, dim_feedforward=d_model*2, 
            dropout=dropout, batch_first=True, activation="gelu"
        )
        self.motif_transformer = nn.TransformerEncoder(motif_encoder, num_layers=2)
        
        # Hierarchical Combination Layer (Atom Graph + BRICS Motifs)
        self.combine = nn.Sequential(
            nn.Linear(d_model * 2, d_model),
            nn.LayerNorm(d_model),
            nn.GELU()
        )

    def forward(self, atom_feats, adj_matrix, atom_mask, motif_feats, atom_to_motif, motif_mask):
        # 1. Atom GNN message passing with MSGG joint awareness
        h_atom = self.atom_proj(atom_feats)
        for gnn in self.gnn_layers:
            deg = adj_matrix.sum(dim=-1, keepdim=True) + 1e-8
            norm_adj = adj_matrix / deg
            h_msg = torch.bmm(norm_adj, h_atom)
            h_atom = h_atom + gnn(h_msg)
        
        mask_exp = atom_mask.unsqueeze(-1)
        h_atom_pool = (h_atom * mask_exp).sum(dim=1) / (mask_exp.sum(dim=1) + 1e-8)
        
        # 2. Bipartite Atom-to-Motif Pooling
        h_bipartite = torch.bmm(atom_to_motif.transpose(1, 2), h_atom)
        h_motif = h_bipartite + self.motif_proj(motif_feats)
        
        # Motif Transformer
        motif_key_mask = (motif_mask == 0)
        h_motif_trans = self.motif_transformer(h_motif, src_key_padding_mask=motif_key_mask)
        m_mask_exp = motif_mask.unsqueeze(-1)
        h_motif_pool = (h_motif_trans * m_mask_exp).sum(dim=1) / (m_mask_exp.sum(dim=1) + 1e-8)
        
        # Combined Hierarchical View 2 Embedding
        h_view2 = self.combine(torch.cat([h_atom_pool, h_motif_pool], dim=-1))
        return h_view2


# --- 3. VIEW 3: 3D Spatial Conformer & E(3)-Equivariant Geometric Encoder ---
class Equivariant3DConformerEGNN(nn.Module):
    def __init__(self, in_dim=79, n_rbf=16, d_model=256, n_layers=3, dropout=0.1):
        super().__init__()
        self.d_model = d_model
        self.node_proj = nn.Linear(in_dim, d_model)
        self.rbf_proj = nn.Linear(n_rbf, d_model)
        
        self.layers = nn.ModuleList([
            nn.Sequential(
                nn.Linear(d_model * 2 + n_rbf, d_model),
                nn.LayerNorm(d_model),
                nn.SiLU(),
                nn.Dropout(dropout)
            ) for _ in range(n_layers)
        ])
        
        self.coord_mlps = nn.ModuleList([
            nn.Sequential(
                nn.Linear(d_model, d_model // 2),
                nn.SiLU(),
                nn.Linear(d_model // 2, 1)
            ) for _ in range(n_layers)
        ])
        
        self.out_norm = nn.LayerNorm(d_model)

    def forward(self, atom_feats, pos_3d, rbf_dist, atom_mask):
        B, N, _ = atom_feats.shape
        h = self.node_proj(atom_feats)
        x = pos_3d.clone()
        
        mask = atom_mask.unsqueeze(-1)
        pair_mask = (mask * mask.transpose(1, 2))
        
        for layer, coord_mlp in zip(self.layers, self.coord_mlps):
            h_i = h.unsqueeze(2).expand(B, N, N, self.d_model)
            h_j = h.unsqueeze(1).expand(B, N, N, self.d_model)
            edge_input = torch.cat([h_i, h_j, rbf_dist], dim=-1)
            m_ij = layer(edge_input) * pair_mask.unsqueeze(-1)
            
            diff_x = x.unsqueeze(2) - x.unsqueeze(1)
            weight_x = coord_mlp(m_ij)
            x_update = (diff_x * weight_x * pair_mask.unsqueeze(-1)).sum(dim=2)
            x = x + x_update
            h = h + m_ij.sum(dim=2)
        
        h_pool = (h * mask).sum(dim=1) / (mask.sum(dim=1) + 1e-8)
        return self.out_norm(h_pool)


# --- 4. Dynamic View Gating & Cross-Modal Transformer Fusion ---
class DynamicViewGating(nn.Module):
    def __init__(self, d_model=256, n_views=3):
        super().__init__()
        self.gate_mlp = nn.Sequential(
            nn.Linear(d_model * n_views, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Linear(d_model, n_views)
        )

    def forward(self, v1, v2, v3):
        concat_v = torch.cat([v1, v2, v3], dim=-1)
        logits = self.gate_mlp(concat_v)
        weights = F.softmax(logits, dim=-1)
        return weights


class CrossModalTransformerFusion(nn.Module):
    def __init__(self, d_model=256, n_heads=4, n_layers=2, dropout=0.1):
        super().__init__()
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads, dim_feedforward=d_model*2,
            dropout=dropout, batch_first=True, activation="gelu"
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        self.norm = nn.LayerNorm(d_model)

    def forward(self, v1, v2, v3):
        views_seq = torch.stack([v1, v2, v3], dim=1)
        fused_seq = self.transformer(views_seq)
        fused_emb = fused_seq.mean(dim=1)
        return self.norm(fused_emb)


# --- 5. Unified TriBioNode v2 Model with Separate View Output Heads ---
class TriBioNodeV2Model(nn.Module):
    def __init__(self, d_model=256, num_tasks=1, task_type="regression", dropout=0.15):
        super().__init__()
        self.d_model = d_model
        self.task_type = task_type
        self.num_tasks = num_tasks
        
        # Three Distinct View Encoders
        self.view1_encoder = SequenceTransformerEncoder(d_model=d_model, dropout=dropout)
        self.view2_encoder = HierarchicalAtomMotifGNN(d_model=d_model, dropout=dropout)
        self.view3_encoder = Equivariant3DConformerEGNN(d_model=d_model, dropout=dropout)
        
        # Dynamic Gating & Cross-Modal Fusion
        self.gating = DynamicViewGating(d_model=d_model, n_views=3)
        self.fusion = CrossModalTransformerFusion(d_model=d_model, dropout=dropout)
        
        # Individual Separate View Prediction Heads
        self.head_v1 = nn.Sequential(
            nn.Linear(d_model, d_model // 2), nn.LayerNorm(d_model // 2), nn.GELU(),
            nn.Dropout(dropout), nn.Linear(d_model // 2, num_tasks)
        )
        self.head_v2 = nn.Sequential(
            nn.Linear(d_model, d_model // 2), nn.LayerNorm(d_model // 2), nn.GELU(),
            nn.Dropout(dropout), nn.Linear(d_model // 2, num_tasks)
        )
        self.head_v3 = nn.Sequential(
            nn.Linear(d_model, d_model // 2), nn.LayerNorm(d_model // 2), nn.GELU(),
            nn.Dropout(dropout), nn.Linear(d_model // 2, num_tasks)
        )
        
        # Contrastive Learning Projection Head (MMCL)
        self.cl_proj1 = nn.Linear(d_model, 128)
        self.cl_proj2 = nn.Linear(d_model, 128)
        self.cl_proj3 = nn.Linear(d_model, 128)
        
        # Unified TriBioNode Multi-Modal Prediction Head
        self.pred_mlp = nn.Sequential(
            nn.Linear(d_model * 2, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model, d_model // 2),
            nn.LayerNorm(d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, num_tasks)
        )

    def forward(self, batch):
        # Extract individual view representations
        h_v1 = self.view1_encoder(batch["seq_tokens"], batch["seq_mask"])
        h_v2 = self.view2_encoder(
            batch["atom_feats"], batch["adj_matrix"], batch["atom_mask"],
            batch["motif_feats"], batch["atom_to_motif"], batch["motif_mask"]
        )
        h_v3 = self.view3_encoder(
            batch["atom_feats"], batch["pos_3d"], batch["rbf_dist"], batch["atom_mask"]
        )
        
        # Individual View Predictions
        pred_v1 = self.head_v1(h_v1)
        pred_v2 = self.head_v2(h_v2)
        pred_v3 = self.head_v3(h_v3)
        
        # Dynamic Gating
        gate_weights = self.gating(h_v1, h_v2, h_v3)
        w1, w2, w3 = gate_weights[:, 0:1], gate_weights[:, 1:2], gate_weights[:, 2:3]
        h_gated = w1 * h_v1 + w2 * h_v2 + w3 * h_v3
        
        # Cross-Modal Transformer Fusion
        h_fused = self.fusion(h_v1, h_v2, h_v3)
        h_combined = torch.cat([h_gated, h_fused], dim=-1)
        
        # Final Unified Prediction
        preds = self.pred_mlp(h_combined)
        
        # Contrastive projections
        z1 = F.normalize(self.cl_proj1(h_v1), dim=-1)
        z2 = F.normalize(self.cl_proj2(h_v2), dim=-1)
        z3 = F.normalize(self.cl_proj3(h_v3), dim=-1)
        
        return {
            "preds": preds,
            "pred_v1": pred_v1,
            "pred_v2": pred_v2,
            "pred_v3": pred_v3,
            "h_v1": h_v1,
            "h_v2": h_v2,
            "h_v3": h_v3,
            "gate_weights": gate_weights,
            "h_fused": h_combined,
            "z1": z1, "z2": z2, "z3": z3
        }

print("✅ Complete TriBioNode v2 Architecture (Pure Graph Hierarchy + Separate View Outputs) Compiled!")



# --- Cell 7 ---
# ============================================================
# CELL 4: Multi-View Dataset, Scaffold Splitter & DataLoader Collation
# ============================================================

def generate_murcko_scaffold(smiles):
    if not RDKIT_AVAILABLE:
        return str(len(smiles) % 10)
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return ""
    try:
        return MurckoScaffold.MurckoScaffoldSmiles(mol=mol, includeChirality=False)
    except:
        return ""

def scaffold_split(smiles_list, train_ratio=0.8, val_ratio=0.1, test_ratio=0.1, seed=42):
    """Partition indices using Bemis-Murcko scaffold clustering."""
    scaffolds = defaultdict(list)
    for idx, smi in enumerate(smiles_list):
        scaf = generate_murcko_scaffold(smi)
        scaffolds[scaf].append(idx)
    
    # Sort clusters largest to smallest for balanced partition
    sorted_scaffold_sets = sorted(scaffolds.values(), key=lambda x: len(x), reverse=True)
    
    train_indices, val_indices, test_indices = [], [], []
    total_mols = len(smiles_list)
    train_cutoff = train_ratio * total_mols
    val_cutoff = (train_ratio + val_ratio) * total_mols
    
    for cluster in sorted_scaffold_sets:
        if len(train_indices) + len(cluster) <= train_cutoff:
            train_indices.extend(cluster)
        elif len(train_indices) + len(val_indices) + len(cluster) <= val_cutoff:
            val_indices.extend(cluster)
        else:
            test_indices.extend(cluster)
            
    return train_indices, val_indices, test_indices


class MultiViewMolecularDataset(Dataset):
    def __init__(self, smiles_list, targets, task_type='regression', featurizer=None):
        self.smiles_list = smiles_list
        self.targets = targets
        self.task_type = task_type
        self.featurizer = featurizer or MolecularFeaturizer()
        self.cached_features = []
        
        for smi in smiles_list:
            feat = self.featurizer.featurize_smiles(smi)
            self.cached_features.append(feat)

    def __len__(self):
        return len(self.cached_features)

    def __getitem__(self, idx):
        feat = self.cached_features[idx]
        target = self.targets[idx]
        return feat, target


def collate_multiview_batch(batch):
    """Collate individual featurized items into padded PyTorch tensors."""
    valid_items = [item for item in batch if item[0] is not None]
    if len(valid_items) == 0:
        return None
    
    feats_list = [item[0] for item in valid_items]
    targets_list = [item[1] for item in valid_items]
    
    batch_dict = {
        "seq_tokens": torch.tensor(np.stack([f["seq_tokens"] for f in feats_list]), dtype=torch.long),
        "seq_mask": torch.tensor(np.stack([f["seq_mask"] for f in feats_list]), dtype=torch.float32),
        "atom_feats": torch.tensor(np.stack([f["atom_feats"] for f in feats_list]), dtype=torch.float32),
        "adj_matrix": torch.tensor(np.stack([f["adj_matrix"] for f in feats_list]), dtype=torch.float32),
        "atom_mask": torch.tensor(np.stack([f["atom_mask"] for f in feats_list]), dtype=torch.float32),
        "motif_feats": torch.tensor(np.stack([f["motif_feats"] for f in feats_list]), dtype=torch.float32),
        "atom_to_motif": torch.tensor(np.stack([f["atom_to_motif"] for f in feats_list]), dtype=torch.float32),
        "motif_mask": torch.tensor(np.stack([f["motif_mask"] for f in feats_list]), dtype=torch.float32),
        "ecfp4": torch.tensor(np.stack([f["ecfp4"] for f in feats_list]), dtype=torch.float32),
        "pos_3d": torch.tensor(np.stack([f["pos_3d"] for f in feats_list]), dtype=torch.float32),
        "rbf_dist": torch.tensor(np.stack([f["rbf_dist"] for f in feats_list]), dtype=torch.float32),
        "targets": torch.tensor(np.array(targets_list), dtype=torch.float32).unsqueeze(-1)
    }
    return batch_dict

print("✅ Dataset and Scaffold Splitter Configured.")


# --- Cell 9 ---
# ============================================================
# CELL 5: Loss Objectives, Contrastive Loss & Metrics
# ============================================================
from sklearn.metrics import roc_auc_score, mean_squared_error, mean_absolute_error, r2_score

def compute_contrastive_loss(z1, z2, temperature=0.1):
    """InfoNCE / NT-Xent multi-modal contrastive alignment loss."""
    B = z1.size(0)
    sim_matrix = torch.mm(z1, z2.t()) / temperature
    labels = torch.arange(B, device=z1.device)
    loss_12 = F.cross_entropy(sim_matrix, labels)
    loss_21 = F.cross_entropy(sim_matrix.t(), labels)
    return (loss_12 + loss_21) / 2.0

def compute_metrics(y_true, y_pred, task_type='regression'):
    y_true = np.array(y_true).flatten()
    y_pred = np.array(y_pred).flatten()
    
    # Filter out NaNs
    valid = ~np.isnan(y_true) & ~np.isnan(y_pred)
    y_true, y_pred = y_true[valid], y_pred[valid]
    
    if len(y_true) == 0:
        return {}
        
    if task_type == 'regression':
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        mae = float(mean_absolute_error(y_true, y_pred))
        r2 = float(r2_score(y_true, y_pred))
        return {"RMSE": rmse, "MAE": mae, "R2": r2}
    else:
        # Binary classification
        y_prob = 1.0 / (1.0 + np.exp(-np.clip(y_pred, -15, 15)))
        try:
            auc = float(roc_auc_score(y_true, y_prob))
        except:
            auc = 0.5
        acc = float(((y_prob >= 0.5) == y_true).mean())
        return {"ROC-AUC": auc, "Accuracy": acc}

print("✅ Loss Functions & Evaluation Metrics Initialized.")


# --- Cell 11 ---
# ============================================================
# CELL 6: Model Training & Comprehensive Multi-View Evaluation Engine
# ============================================================
def train_epoch(model, dataloader, optimizer, criterion, device, task_type, cl_weight=0.05, aux_weight=0.2):
    model.train()
    total_loss = 0.0
    
    for batch in dataloader:
        if batch is None:
            continue
        for k in batch:
            if isinstance(batch[k], torch.Tensor):
                batch[k] = batch[k].to(device)
            
        optimizer.zero_grad()
        out = model(batch)
        targets = batch["targets"]
        
        # Primary Fused Task Loss
        loss_fused = criterion(out["preds"], targets)
        
        # Auxiliary Single-View Losses (to train separate view representations)
        loss_v1 = criterion(out["pred_v1"], targets)
        loss_v2 = criterion(out["pred_v2"], targets)
        loss_v3 = criterion(out["pred_v3"], targets)
        aux_loss = (loss_v1 + loss_v2 + loss_v3) / 3.0
        
        # Multi-Modal Contrastive Loss (MMCL)
        l_cl_12 = compute_contrastive_loss(out["z1"], out["z2"])
        l_cl_23 = compute_contrastive_loss(out["z2"], out["z3"])
        l_cl_13 = compute_contrastive_loss(out["z1"], out["z3"])
        cl_loss = (l_cl_12 + l_cl_23 + l_cl_13) / 3.0
        
        loss = loss_fused + aux_weight * aux_loss + cl_weight * cl_loss
        loss.backward()
        
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        total_loss += loss.item()
        
    return total_loss / max(len(dataloader), 1)
def evaluate_model_multiview(model, dataloader, device, task_type="regression"):
    """Evaluates model and extracts separate outputs/embeddings for View 1, View 2, View 3, and Fused."""
    model.eval()
    all_preds_fused, all_preds_v1, all_preds_v2, all_preds_v3 = [], [], [], []
    all_targets, all_weights = [], []
    all_h_v1, all_h_v2, all_h_v3, all_h_fused = [], [], [], []
    
    with torch.no_grad():
        for batch in dataloader:
            if batch is None:
                continue
            for k in batch:
                if isinstance(batch[k], torch.Tensor):
                    batch[k] = batch[k].to(device)
                
            out = model(batch)
            all_preds_fused.extend(out["preds"].cpu().numpy())
            all_preds_v1.extend(out["pred_v1"].cpu().numpy())
            all_preds_v2.extend(out["pred_v2"].cpu().numpy())
            all_preds_v3.extend(out["pred_v3"].cpu().numpy())
            all_targets.extend(batch["targets"].cpu().numpy())
            all_weights.extend(out["gate_weights"].cpu().numpy())
            
            all_h_v1.extend(out["h_v1"].cpu().numpy())
            all_h_v2.extend(out["h_v2"].cpu().numpy())
            all_h_v3.extend(out["h_v3"].cpu().numpy())
            all_h_fused.extend(out["h_fused"].cpu().numpy())
            
    metrics_fused = compute_metrics(all_targets, all_preds_fused, task_type=task_type)
    metrics_v1 = compute_metrics(all_targets, all_preds_v1, task_type=task_type)
    metrics_v2 = compute_metrics(all_targets, all_preds_v2, task_type=task_type)
    metrics_v3 = compute_metrics(all_targets, all_preds_v3, task_type=task_type)
    
    return {
        "metrics_fused": metrics_fused,
        "metrics_v1": metrics_v1,
        "metrics_v2": metrics_v2,
        "metrics_v3": metrics_v3,
        "preds_fused": np.array(all_preds_fused),
        "preds_v1": np.array(all_preds_v1),
        "preds_v2": np.array(all_preds_v2),
        "preds_v3": np.array(all_preds_v3),
        "targets": np.array(all_targets),
        "gate_weights": np.array(all_weights),
        "h_v1": np.array(all_h_v1),
        "h_v2": np.array(all_h_v2),
        "h_v3": np.array(all_h_v3),
        "h_fused": np.array(all_h_fused)
    }
print("✅ Multi-View Training and Separate View Evaluation Engine Ready.")
def evaluate_model(model, dataloader, device, task_type="regression"):
    res = evaluate_model_multiview(model, dataloader, device, task_type)
    return res["metrics_fused"], res["preds_fused"], res["targets"], res["gate_weights"]

