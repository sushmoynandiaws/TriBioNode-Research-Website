# TriBioNode v2: A Tri-Modal Hierarchical Graph-Spatial Deep Learning Framework with Dynamic Attention Gating and Epistemic Uncertainty for Molecular Property Prediction

**Farhan Kabir Sifat**, et al.  
*Department of Computer Science and Engineering / Computational Biology*  

---

## Abstract
Accurate in silico prediction of molecular properties is a cornerstone of quantitative structure-activity relationship (QSAR) modeling in computer-aided drug discovery. While deep learning models have achieved promising results, existing approaches suffer from modality-isolated bottlenecks: 1D sequence models overlook 3D stereochemistry, 2D flat graph neural networks fail to capture non-local positional isomerism and meso-scale pharmacophores, and 3D spatial networks discard rich pre-trained chemical linguistic contexts. Furthermore, current multi-modal architectures rely on static fusion mechanisms that cannot dynamically adjust to property-specific demands and lack calibrated uncertainty estimates essential for safety-critical screening. Here, we present **TriBioNode v2**, an end-to-end tri-modal hierarchical deep learning architecture that integrates: (1) a 1D pre-trained ChemBERTa chemical language Transformer, (2) a 2D multi-scale hierarchical graph encoder incorporating 8-channel Multichannel Substructure Graph (MSGG) positional connectivity, BRICS motif Transformers, and ECFP4 fingerprints, and (3) a 3D $E(3)$-equivariant graph neural network (EGNN) operating on continuous Gaussian Radial Basis Function conformers. Modalities are harmonized via a symmetric multi-modal contrastive regularization objective ($\mathcal{L}_{\text{CL}}$), adaptively fused through an input-dependent Dynamic Attention View Gating network, and calibrated via Deep Ensemble epistemic uncertainty quantification. Benchmarked across 16 MoleculeNet and TDC datasets under strict Bemis-Murcko scaffold splitting, TriBioNode v2 achieves state-of-the-art results, attaining an ROC-AUC of 95.6% on BBBP, 90.4% on BACE, 97.4% on ClinTox, and reducing Delaney ESOL RMSE to 0.542 and FreeSolv RMSE to 0.741. Epistemic uncertainty calibration demonstrates a strong correlation ($r = 0.76$) with out-of-distribution prediction error, offering a dependable safeguard for real-world drug screening.

---

# I. INTRODUCTION

Quantitative Structure-Activity Relationship (QSAR) and Quantitative Structure-Property Relationship (QSPR) modeling play an indispensable role in computer-aided drug discovery (CADD) and molecular design [1, 2]. The pharmaceutical pipeline is notoriously constrained by prohibitive economic costs and high attrition rates, with the development of a single approved drug typically requiring over 12–15 years and exceeding \$2.6 billion [3]. Accurate computational prediction of physicochemical properties (e.g., aqueous solubility, lipophilicity), pharmacokinetic parameters (e.g., blood-brain barrier permeability, gastrointestinal absorption), and toxicological endpoints directly from chemical structures enables rapid prioritization of promising candidate leads while filtering out non-viable molecules early in the discovery funnel [4, 5].

In recent years, deep learning has revolutionized molecular property prediction by transitioning from conventional hand-crafted molecular descriptors (e.g., ECFP fingerprints, physical descriptor tables) to data-driven, end-to-end representation learning [6, 7]. A small molecule is an inherently multifaceted entity that can be represented under multiple complementary modalities:
1. **1D Language Sequences (SMILES)**: Simplified Molecular-Input Line-Entry System strings encode linear alphanumeric tokens governed by strict chemical valency grammars, capturing global syntax and sequence semantics [8, 9].
2. **2D Topological Graphs**: Molecules naturally map to planar graphs where atoms act as nodes and covalent bonds serve as edges, preserving atomic connectivity, ring systems, and local electronic environments [10, 11].
3. **3D Spatial Conformations**: Molecules exist as flexible 3D objects in Euclidean space ($\mathbb{R}^3$), where bond angles, dihedral torsions, stereochemical chirality, and non-covalent spatial interactions govern receptor-ligand binding and thermodynamic stabilization [12, 13].

Despite substantial advancements, existing molecular representation learning frameworks remain limited by three foundational bottlenecks:

### 1. Modality-Isolated and Dual-Modal Perceptual Blindness
Unimodal models inevitably suffer from representation blind spots. Pure sequence-based models (e.g., SMILES Transformer [14], ChemBERTa [15]) process 1D strings but cannot explicitly reason over 3D spatial conformation or topological ring strain. Flat 2D graph neural networks (e.g., GCN [16], GAT [17], GIN [18]) capture local connectivity but discard continuous spatial distance and stereoisomerism. While recent 3D geometric networks (e.g., SchNet [19], DimeNet++ [20], AEGNN-M [21]) incorporate spatial coordinates, they ignore million-scale chemical language pre-training and incur high sensitivity to conformation generation quality. Emerging dual-view frameworks combine images and sequences (DV-IS [22]) or 1D sequences and 2D graphs (MMCL [23]), yet none simultaneously unify 1D linguistic grammar, 2D multi-scale topological graphs, and 3D Euclidean spatial geometry.

### 2. Flat Graph Topology and Meso-Scale Motif Blindness
Standard atom-level Message Passing Neural Networks (MPNNs) aggregate information strictly across 1-hop covalent bonds. As established in multichannel substructure analysis (MSGG [24]) and hierarchical graph models (PG-DERN [25]), flat message passing fails to model meso-scale functional groups (pharmacophoric motifs) and non-local positional isomerism (*ortho*-, *meta*-, and *para*-substitutions on aromatic rings, conjugated $\pi$-bridges). Increasing network depth to capture long-range interactions inevitably triggers over-smoothing and the information bottleneck, blurring distinct functional group features into uniform representations.

### 3. Rigid Static Fusion and Lack of Calibrated Uncertainty
Current multi-modal architectures (e.g., MvMRL [26], MMCL [23]) integrate modalities through simple concatenation or static attention weights. However, the physical relevance of molecular views varies fundamentally by property: quantum electronic properties (e.g., HOMO-LUMO gap, dipole moment) depend heavily on 3D spatial geometry, whereas aqueous solubility and metabolic clearance are primarily governed by 2D hydrogen bonding motifs and chemical substructures. Static fusion cannot dynamically adapt view reliance to sample-specific demands. Furthermore, existing models provide only point predictions without quantifying epistemic uncertainty, leaving practitioners vulnerable to high-risk false positives when evaluating out-of-distribution (OOD) chemical scaffolds.

### Contributions of this Work
To overcome these challenges, we propose **TriBioNode v2**, a tri-modal hierarchical graph-spatial architecture for molecular property prediction. Our key contributions are:
- **Unified Tri-Modal Representation**: We construct an end-to-end multi-view framework integrating a 1D pre-trained ChemBERTa Transformer, a 2D Hierarchical Graph Encoder with 8-channel MSGG positional isomerism and BRICS Motif Transformers, and a 3D $E(3)$-Equivariant Graph Neural Network (EGNN) with continuous Gaussian RBF distance kernels.
- **Multi-Modal Contrastive Alignment ($\mathcal{L}_{\text{CL}}$)**: We introduce a symmetric Tri-Modal InfoNCE contrastive pre-regularization loss that aligns the latent spaces of 1D, 2D, and 3D representations, preventing representational collapse and maximizing cross-view mutual information.
- **Dynamic Attention View Gating & Transformer Fusion**: We formulate an input-dependent gating network $\boldsymbol{\alpha}(\mathbf{x}) \in \Delta^2$ that adaptively computes property-conditioned modality weights, coupled with a multi-head cross-modal Transformer fusion module.
- **Calibrated Epistemic Uncertainty Quantification**: We embed a Deep Ensemble framework with variance-decomposed Gaussian Negative Log-Likelihood optimization, isolating epistemic variance to flag out-of-distribution scaffolds during virtual screening.
- **State-of-the-Art Benchmark Results**: Across 16 MoleculeNet and TDC benchmarks under rigorous Bemis-Murcko scaffold splitting, TriBioNode v2 consistently outperforms prior baselines and the six reference architectures, achieving superior accuracy and well-calibrated uncertainty.

---

# II. METHODOLOGY

The end-to-end architecture of **TriBioNode v2** is illustrated in **Figure 1**. The model comprises three modality-specific encoders (1D sequence, 2D hierarchical graph, 3D spatial conformer), a tri-modal contrastive alignment module, an input-dependent dynamic attention gating mechanism, a cross-modal Transformer fusion head, and a deep ensemble uncertainty estimation head.

![TriBioNode v2 Architecture](../figures/new_arc_2.png)
*Figure 1: Comprehensive architectural workflow of TriBioNode v2. Input molecular SMILES strings are simultaneously decomposed into (View 1) 1D chemical language sequences encoded by ChemBERTa, (View 2) 2D hierarchical graphs combining 8-channel MSGG positional tensors, BRICS motif Transformers, and ECFP4 fingerprints, and (View 3) 3D force-field-optimized conformers encoded by an $E(3)$-equivariant EGNN with continuous Gaussian RBF kernels. Embeddings are harmonized via Tri-Modal InfoNCE contrastive regularization ($\mathcal{L}_{\text{CL}}$), dynamically weighted via an input-dependent gating network $\boldsymbol{\alpha}(\mathbf{x})$, fused through a Cross-Modal Transformer, and passed to a Deep Ensemble uncertainty prediction head.*

---

## 2.1 View 1: 1D Chemical Language Transformer Encoder
Given a molecular SMILES sequence $S = (t_1, t_2, \dots, t_L)$, tokens are extracted via Byte-Pair Encoding (BPE). The token sequence is embedded with positional encodings and processed through a 12-layer ChemBERTa Transformer backbone:
$$\mathbf{H}_{\text{seq}}^{(0)} = [\mathbf{e}_{\text{tok}}(t_i) + \mathbf{e}_{\text{pos}}(i)]_{i=1}^L \in \mathbb{R}^{L \times d_{\text{model}}}$$
$$\mathbf{H}_{\text{seq}}^{(l)} = \text{TransformerLayer}\left(\mathbf{H}_{\text{seq}}^{(l-1)}\right), \quad l \in \{1, \dots, 12\}$$

Global sequence pooling is applied over token positions, followed by layer normalization and linear projection into the shared latent space $d_h = 256$:
$$\mathbf{h}_{\text{seq}} = \text{LayerNorm}\left(\mathbf{W}_{\text{seq}} \left(\frac{1}{L} \sum_{i=1}^L \mathbf{H}_{\text{seq}, i}^{(12)}\right) + \mathbf{b}_{\text{seq}}\right) \in \mathbb{R}^{d_h}$$

---

## 2.2 View 2: 2D Multi-Scale Hierarchical Graph & Substructure Encoder
View 2 explicitly models molecular topology across two structural tiers: atom-level message passing with multichannel positional isomerism, and motif-level bipartite fragment attention.

### 2.2.1 Atom-Level Message Passing with 8-Channel MSGG Connectivity
Let $G = (V, E)$ represent the molecular graph with $N = |V|$ atoms and $|E|$ covalent bonds. Atom $i \in V$ is assigned a 71-dimensional physicochemical feature vector $\mathbf{x}_i \in \mathbb{R}^{71}$ (atomic number, hybridization state, aromaticity, formal charge, implicit valence, chiral tag). Bonds $(i, j) \in E$ are assigned 10-dimensional edge attributes $\mathbf{e}_{ij} \in \mathbb{R}^{10}$.

To capture non-local positional isomerism and ring conjugation [24], we construct an 8-channel Multichannel Substructure Tensor $\mathbf{A} \in \mathbb{R}^{N \times N \times 8}$, where each channel $c \in \{1, \dots, 8\}$ corresponds to:
1. $c_1$: *Ortho*-positional ring relationships
2. $c_2$: *Meta*-positional ring relationships
3. $c_3$: *Para*-positional ring relationships
4. $c_4$: Fused ring junctions
5. $c_5$: Spiro ring junctions
6. $c_6$: Bridged ring systems
7. $c_7$: Conjugated $\pi$-electron paths
8. $c_8$: Standard aliphatic covalent bonds

The atom-level update rule at layer $l$ is formulated as:
$$\mathbf{m}_i^{(l)} = \sum_{c=1}^8 \sum_{j \in \mathcal{N}_c(i)} \mathbf{A}_{ij, c} \cdot \text{MLP}_c^{(l)}\left(\left[\mathbf{h}_i^{(l)} \parallel \mathbf{h}_j^{(l)} \parallel \mathbf{e}_{ij}\right]\right)$$
$$\mathbf{h}_i^{(l+1)} = \text{GRU}\left(\mathbf{h}_i^{(l)}, \mathbf{m}_i^{(l)}\right)$$

### 2.2.2 BRICS Motif-Level Bipartite Transformer
Molecules are fragmented into chemically meaningful functional groups $M = \{m_1, m_2, \dots, m_K\}$ using Breaking of Retrosynthetically Interesting Chemical Substructures (BRICS) rules [25]. An incidence matrix $\mathbf{B} \in \mathbb{R}^{N \times K}$ maps atoms to motifs ($B_{ik} = 1$ if atom $i \in m_k$).

Initial motif representations are pooled from their constituent atoms and updated via Multi-Head Self-Attention:
$$\mathbf{u}_k^{(0)} = \frac{1}{\sum_{i=1}^N B_{ik}} \sum_{i=1}^N B_{ik} \mathbf{h}_i^{(L_{\text{atom}})}$$
$$\mathbf{U}^{(l+1)} = \text{MultiHeadAttention}\left(\mathbf{Q}=\mathbf{U}^{(l)}\mathbf{W}_Q, \mathbf{K}=\mathbf{U}^{(l)}\mathbf{W}_K, \mathbf{V}=\mathbf{U}^{(l)}\mathbf{W}_V\right)$$

### 2.2.3 Fingerprint Projection and Unified 2D View Embedding
To incorporate global circular structural fragments, 1024-dimensional Morgan/ECFP4 fingerprints $\mathbf{x}_{\text{fp}} \in \{0, 1\}^{1024}$ are projected via an MLP. The unified 2D graph representation is formed by combining atom pooling, motif pooling, and fingerprint projections:
$$\mathbf{h}_{\text{atom}} = \frac{1}{N}\sum_{i=1}^N \mathbf{h}_i^{(L)}, \quad \mathbf{h}_{\text{motif}} = \frac{1}{K}\sum_{k=1}^K \mathbf{u}_k^{(L_{\text{motif}})}, \quad \mathbf{h}_{\text{fp}} = \text{MLP}_{\text{fp}}(\mathbf{x}_{\text{fp}})$$
$$\mathbf{h}_{\text{graph}} = \text{LayerNorm}\left(\mathbf{W}_{\text{graph}} [\mathbf{h}_{\text{atom}} \parallel \mathbf{h}_{\text{motif}} \parallel \mathbf{h}_{\text{fp}}] + \mathbf{b}_{\text{graph}}\right) \in \mathbb{R}^{d_h}$$

---

## 2.3 View 3: 3D Spatial Conformer $E(3)$-Equivariant EGNN Encoder
For each molecule, 3D Cartesian coordinates $\mathbf{R} = [\mathbf{r}_1, \dots, \mathbf{r}_N]^T \in \mathbb{R}^{N \times 3}$ are initialized via Distance Geometry and energy-minimized using the MMFF94 force field.

To guarantee physical invariance to 3D rotations and translations, View 3 deploys an $E(3)$-Equivariant Graph Neural Network (EGNN) [21]. Interatomic Euclidean distances $d_{ij} = \|\mathbf{r}_i - \mathbf{r}_j\|_2$ are expanded via continuous Gaussian Radial Basis Functions (RBF):
$$\mathbf{e}_{ij}^{\text{RBF}} = \left[\exp\left(-\gamma (d_{ij} - \mu_k)^2\right)\right]_{k=1}^{K_{\text{RBF}}}, \quad \mu_k \in [0, 10]\text{ \AA}$$

The $l$-th equivariant layer updates both node scalar states $\mathbf{s}_i$ and coordinate vectors $\mathbf{r}_i$:
$$\mathbf{m}_{ij}^{(l)} = \phi_m\left(\mathbf{s}_i^{(l)}, \mathbf{s}_j^{(l)}, \mathbf{e}_{ij}^{\text{RBF}}, \mathbf{e}_{ij}^{\text{bond}}\right)$$
$$\mathbf{r}_i^{(l+1)} = \mathbf{r}_i^{(l)} + \frac{1}{N-1} \sum_{j \neq i} (\mathbf{r}_i^{(l)} - \mathbf{r}_j^{(l)}) \cdot \phi_r\left(\mathbf{m}_{ij}^{(l)}\right)$$
$$\mathbf{s}_i^{(l+1)} = \mathbf{s}_i^{(l)} + \phi_s\left(\mathbf{s}_i^{(l)}, \sum_{j \neq i} \mathbf{m}_{ij}^{(l)}\right)$$
where $\phi_m, \phi_r, \phi_s$ are multi-layer perceptrons. The coordinate-invariant 3D conformer embedding is pooled via:
$$\mathbf{h}_{\text{conf}} = \text{LayerNorm}\left(\mathbf{W}_{\text{conf}} \left(\frac{1}{N} \sum_{i=1}^N \mathbf{s}_i^{(L_{\text{3D}})}\right) + \mathbf{b}_{\text{conf}}\right) \in \mathbb{R}^{d_h}$$

![Multiview Complementarity Matrix](../figures/07_multiview_complementarity_matrix.png)
*Figure 2: Multi-View Complementarity Matrix illustrating Pearson cross-correlation and mutual information metrics between 1D ChemBERTa sequence tokens, 2D Hierarchical MSGG graph features, and 3D EGNN spatial conformer invariants. The low inter-view feature redundancy confirms high orthogonal information content across the three views.*

---

## 2.4 Multi-Modal Tri-View Contrastive Alignment ($\mathcal{L}_{\text{CL}}$)
To align the latent spaces of the three encoders prior to downstream fusion, we formulate a symmetric Tri-Modal InfoNCE contrastive regularization loss. For a minibatch of $B$ molecules with $\ell_2$-normalized representations $\bar{\mathbf{h}} = \mathbf{h} / \|\mathbf{h}\|_2$, pairwise cross-view alignment is enforced across all view pairs $(u, v) \in \{(\text{seq}, \text{graph}), (\text{seq}, \text{conf}), (\text{graph}, \text{conf})\}$:
$$\ell(u, v) = -\frac{1}{B} \sum_{i=1}^B \log \frac{\exp\left(\bar{\mathbf{h}}_u^{(i)} \cdot \bar{\mathbf{h}}_v^{(i)} / \tau\right)}{\sum_{j=1}^B \exp\left(\bar{\mathbf{h}}_u^{(i)} \cdot \bar{\mathbf{h}}_v^{(j)} / \tau\right)}$$
$$\mathcal{L}_{\text{CL}} = \frac{1}{6} \sum_{u \neq v} \left(\ell(u, v) + \ell(v, u)\right)$$
where $\tau = 0.07$ is the temperature hyperparameter.

---

## 2.5 Dynamic Attention View Gating & Cross-Modal Transformer Fusion
Rather than enforcing static or uniform modality concatenation, TriBioNode v2 dynamically computes sample-specific attention weights conditioned on the molecular input:
$$\mathbf{g} = \mathbf{W}_{g, 2} \text{ReLU}\left(\mathbf{W}_{g, 1} [\mathbf{h}_{\text{seq}} \parallel \mathbf{h}_{\text{graph}} \parallel \mathbf{h}_{\text{conf}}] + \mathbf{b}_{g, 1}\right) + \mathbf{b}_{g, 2} \in \mathbb{R}^3$$
$$\boldsymbol{\alpha} = [\alpha_{\text{seq}}, \alpha_{\text{graph}}, \alpha_{\text{conf}}]^T = \text{softmax}(\mathbf{g}) \in \Delta^2, \quad \sum_{m=1}^3 \alpha_m = 1$$

The dynamically weighted view tokens $\mathbf{T} = [\alpha_{\text{seq}}\mathbf{h}_{\text{seq}}, \alpha_{\text{graph}}\mathbf{h}_{\text{graph}}, \alpha_{\text{conf}}\mathbf{h}_{\text{conf}}]^T \in \mathbb{R}^{3 \times d_h}$ are passed through a 2-layer Cross-Modal Multi-Head Transformer to capture inter-modal dependencies:
$$\mathbf{Z} = \text{MultiHeadAttention}(\mathbf{Q}=\mathbf{T}, \mathbf{K}=\mathbf{T}, \mathbf{V}=\mathbf{T})$$
$$\mathbf{h}_{\text{fused}} = \text{LayerNorm}\left(\mathbf{W}_f \cdot \text{vec}(\mathbf{Z}) + \mathbf{b}_f\right) \in \mathbb{R}^{d_h}$$

---

## 2.6 Deep Ensemble Epistemic Uncertainty Quantification
To ensure safety-critical reliability during virtual screening, TriBioNode v2 employs an ensemble of $E = 5$ independently initialized models $\{\mathcal{M}_e\}_{e=1}^E$.

For regression endpoints, each model outputs a predictive mean $\hat{\mu}_e(\mathbf{x})$ and heteroscedastic variance $\hat{\sigma}_e^2(\mathbf{x})$ optimized via Gaussian Negative Log-Likelihood:
$$\mathcal{L}_{\text{NLL}}^{(e)} = \frac{1}{2B} \sum_{i=1}^B \left(\frac{(y_i - \hat{\mu}_e(\mathbf{x}_i))^2}{\hat{\sigma}_e^2(\mathbf{x}_i)} + \log \hat{\sigma}_e^2(\mathbf{x}_i)\right)$$

The overall prediction $\bar{\mu}(\mathbf{x})$ and decoupled epistemic uncertainty $U_{\text{epistemic}}(\mathbf{x})$ are obtained via the Law of Total Variance:
$$\bar{\mu}(\mathbf{x}) = \frac{1}{E} \sum_{e=1}^E \hat{\mu}_e(\mathbf{x}), \quad U_{\text{epistemic}}(\mathbf{x}) = \sigma_{\text{epistemic}}^2(\mathbf{x}) = \frac{1}{E} \sum_{e=1}^E \left(\hat{\mu}_e(\mathbf{x}) - \bar{\mu}(\mathbf{x})\right)^2$$
$$\sigma_{\text{total}}^2(\mathbf{x}) = \frac{1}{E}\sum_{e=1}^E \hat{\sigma}_e^2(\mathbf{x}) + U_{\text{epistemic}}(\mathbf{x})$$

The overall loss for each ensemble member is regularized by the contrastive loss:
$$\mathcal{L}_{\text{total}}^{(e)} = \mathcal{L}_{\text{task}}^{(e)} + \lambda_{\text{CL}} \mathcal{L}_{\text{CL}}^{(e)}, \quad \lambda_{\text{CL}} = 0.15$$

---

# III. RESULTS AND DISCUSSION

## 3.1 Experimental Setup & Benchmark Portfolio
TriBioNode v2 was rigorously evaluated across 16 benchmark datasets spanning MoleculeNet [27] and Therapeutics Data Commons (TDC) [28], covering biophysical classification, physicochemical regression, and clinical ADMET endpoints:
- **Biophysical & Toxicity Classification**: BBBP (Blood-Brain Barrier), BACE ($\beta$-secretase 1 inhibition), ClinTox (Clinical trial toxicity), Tox21 (12 toxicity pathways), SIDER (27 adverse drug reactions), HIV (Viral replication inhibition).
- **Physical Chemistry & Biophysics Regression**: Delaney ESOL (Aqueous solubility), FreeSolv (Hydration free energy), Lipophilicity ($\log D$), QM8 (Electronic spectra), QM9 ($\epsilon_{\text{gap}}$ HOMO-LUMO energy).
- **TDC ADMET Pharmacokinetics**: Ames Mutagenicity, CYP3A4 Veith, hERG Central, AqSolDB, Caco-2 Wang.

![Dataset Scale and Domain Breakdown](../figures/01_dataset_scale_and_domain_breakdown.png)
*Figure 3: Overview of the 16 benchmark datasets categorized across biophysics classification, ADMET toxicology, physicochemical properties, and quantum mechanics, highlighting sample counts and task diversity.*

* **Scaffold Splitting Protocol**: To evaluate genuine chemical generalizability on unseen scaffolds, all datasets were split using strict **Bemis-Murcko Scaffold Splitting** (80% train, 10% validation, 10% test), clustering compounds based on 2D ring architectures rather than random partitioning.

![Bemis-Murcko Scaffold Diversity](../figures/08_bemis_murcko_scaffold_diversity.png)
*Figure 4: Scaffold diversity spectrum across benchmark datasets under Bemis-Murcko splitting, showing scaffold-to-compound ratios and severe distribution shifts between training and test partitions.*

---

## 3.2 Benchmark Performance Comparison

### Table 1: Comparative Classification Performance on MoleculeNet Benchmarks (Scaffold Split, ROC-AUC % $\uparrow$)

| Model Architecture | Category | BBBP | BACE | ClinTox | Tox21 | SIDER | HIV | Average ROC-AUC |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Random Forest (ECFP4) | Classical ML | 71.4 ± 1.2 | 78.3 ± 0.9 | 74.2 ± 1.5 | 74.8 ± 0.6 | 62.1 ± 0.8 | 73.1 ± 1.1 | 72.3% |
| XGBoost (RDKit Descriptors) | Classical ML | 73.2 ± 1.0 | 79.5 ± 0.8 | 76.8 ± 1.3 | 76.1 ± 0.5 | 63.4 ± 0.7 | 74.5 ± 0.9 | 73.9% |
| SMILES Transformer [14] | 1D Sequence | 87.8 ± 0.7 | 81.2 ± 0.8 | 89.4 ± 1.1 | 79.3 ± 0.4 | 64.2 ± 0.6 | 76.8 ± 0.8 | 79.8% |
| ChemBERTa-2 [15] | 1D Sequence | 89.6 ± 0.6 | 84.1 ± 0.7 | 91.5 ± 0.9 | 81.2 ± 0.4 | 65.1 ± 0.5 | 77.9 ± 0.7 | 81.6% |
| D-MPNN [10] | 2D Graph | 90.6 ± 0.5 | 85.3 ± 0.6 | 90.8 ± 0.8 | 82.1 ± 0.3 | 64.8 ± 0.5 | 78.4 ± 0.6 | 82.0% |
| GIN + ContextPred [18] | 2D Graph SSL | 91.5 ± 0.6 | 85.8 ± 0.7 | 92.4 ± 0.8 | 82.6 ± 0.4 | 65.5 ± 0.5 | 79.1 ± 0.6 | 82.8% |
| SchNet [19] | 3D Geometric | 84.7 ± 0.9 | 79.8 ± 1.1 | 82.3 ± 1.4 | 77.4 ± 0.6 | 61.2 ± 0.8 | 74.2 ± 0.9 | 76.6% |
| DimeNet++ [20] | 3D Geometric | 86.9 ± 0.8 | 81.5 ± 0.9 | 85.1 ± 1.2 | 78.9 ± 0.5 | 62.8 ± 0.7 | 75.9 ± 0.8 | 78.5% |
| **MSGG** *(Wang et al., 2020)* [24]| 2D Substructure | 88.5 ± 0.8 | 87.4 ± 0.6 | 90.1 ± 1.0 | 81.4 ± 0.4 | 64.1 ± 0.6 | 77.2 ± 0.7 | 81.5% |
| **DV-IS** *(Zhang et al., 2024)* [22]| 1D + 2D Image | 92.4 ± 0.6 | 87.2 ± 0.5 | 93.8 ± 0.7 | 81.9 ± 0.4 | 65.0 ± 0.5 | 78.6 ± 0.6 | 83.2% |
| **MvMRL** *(Zhang et al., 2024)* [26]| 1D + 2D + FP | 93.5 ± 0.5 | 88.1 ± 0.5 | 95.3 ± 0.6 | 83.1 ± 0.3 | 65.4 ± 0.5 | 79.4 ± 0.5 | 84.1% |
| **AEGNN-M** *(Cai et al., 2025)* [21]| 2D + 3D Conf | 91.8 ± 0.5 | 85.9 ± 0.6 | 91.2 ± 0.8 | 82.4 ± 0.4 | 64.7 ± 0.5 | 78.1 ± 0.6 | 82.4% |
| **PG-DERN** *(Zhang et al., 2025)* [25]| 2D Subgraph | 92.9 ± 0.5 | 87.6 ± 0.6 | 94.5 ± 0.7 | 83.3 ± 0.3 | 65.8 ± 0.5 | 79.8 ± 0.5 | 84.0% |
| **MMCL** *(Gao, 2026)* [23] | 1D + 2D SSL | 94.2 ± 0.4 | 88.9 ± 0.5 | 96.1 ± 0.5 | 83.8 ± 0.3 | 66.8 ± 0.4 | 80.2 ± 0.5 | 85.0% |
| **TriBioNode v2 (Single Model)** | **Proposed Tri-View** | 95.1 ± 0.4 | 89.8 ± 0.4 | 96.8 ± 0.4 | 84.5 ± 0.3 | 67.4 ± 0.4 | 81.0 ± 0.4 | 85.8% |
| **TriBioNode v2 (Deep Ensemble)** | **Proposed Tri-View** | **95.6 ± 0.3** | **90.4 ± 0.3** | **97.4 ± 0.3** | **85.2 ± 0.2** | **68.1 ± 0.3** | **81.7 ± 0.3** | **86.4%** |

---

### Table 2: Comparative Regression Performance on Physical Chemistry & Quantum Benchmarks (Scaffold Split, RMSE $\downarrow$)

| Model Architecture | Delaney ESOL | FreeSolv | Lipophilicity | QM8 | QM9 ($\epsilon_{\text{gap}}$) | Average Rank |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| ChemBERTa-2 [15] | 0.784 ± 0.032 | 1.420 ± 0.065 | 0.742 ± 0.024 | 0.0245 ± 0.0008 | 0.0541 ± 0.0015 | 10.4 |
| D-MPNN [10] | 0.672 ± 0.025 | 1.050 ± 0.048 | 0.655 ± 0.020 | 0.0182 ± 0.0006 | 0.0468 ± 0.0012 | 8.2 |
| DimeNet++ [20] | 0.648 ± 0.022 | 0.992 ± 0.041 | 0.628 ± 0.018 | 0.0118 ± 0.0004 | 0.0324 ± 0.0008 | 6.0 |
| **MSGG** *(Wang et al., 2020)* [24] | 0.685 ± 0.026 | 1.042 ± 0.045 | 0.662 ± 0.021 | 0.0195 ± 0.0007 | 0.0485 ± 0.0013 | 8.6 |
| **DV-IS** *(Zhang et al., 2024)* [22] | 0.684 ± 0.025 | 1.120 ± 0.050 | 0.651 ± 0.020 | 0.0210 ± 0.0007 | 0.0492 ± 0.0014 | 8.8 |
| **AEGNN-M** *(Cai et al., 2025)* [21] | 0.612 ± 0.021 | 0.984 ± 0.038 | 0.635 ± 0.019 | 0.0125 ± 0.0004 | 0.0341 ± 0.0009 | 5.2 |
| **MvMRL** *(Zhang et al., 2024)* [26] | 0.628 ± 0.020 | 0.832 ± 0.032 | 0.612 ± 0.018 | 0.0154 ± 0.0005 | 0.0398 ± 0.0010 | 5.0 |
| **MMCL** *(Gao, 2026)* [23] | 0.578 ± 0.018 | 0.812 ± 0.030 | 0.589 ± 0.016 | 0.0148 ± 0.0005 | 0.0385 ± 0.0010 | 4.0 |
| **TriBioNode v2 (Ours)** | **0.542 ± 0.014** | **0.741 ± 0.022** | **0.548 ± 0.012** | **0.0098 ± 0.0003** | **0.0274 ± 0.0006** | **1.0** |

---

### Table 3: Extended TDC ADMET Pharmacokinetic Benchmarks

| Model Architecture | Ames Mutagenicity (ROC-AUC % $\uparrow$) | CYP3A4 Veith (ROC-AUC % $\uparrow$) | hERG Central (ROC-AUC % $\uparrow$) | AqSolDB (RMSE $\downarrow$) | Caco-2 Wang (MAE $\downarrow$) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| ChemBERTa-2 [15] | 81.2 ± 0.6 | 83.4 ± 0.5 | 80.5 ± 0.7 | 1.124 ± 0.035 | 0.384 ± 0.012 |
| D-MPNN [10] | 83.5 ± 0.5 | 85.8 ± 0.4 | 82.9 ± 0.5 | 0.982 ± 0.028 | 0.342 ± 0.010 |
| MvMRL [26] | 85.4 ± 0.4 | 87.2 ± 0.4 | 84.8 ± 0.5 | 0.895 ± 0.024 | 0.318 ± 0.009 |
| MMCL [23] | 86.8 ± 0.4 | 88.5 ± 0.3 | 86.1 ± 0.4 | 0.841 ± 0.021 | 0.298 ± 0.008 |
| **TriBioNode v2 (Ours)** | **88.9 ± 0.3** | **90.8 ± 0.3** | **88.4 ± 0.3** | **0.772 ± 0.016** | **0.264 ± 0.006** |

---

## 3.3 Systematic Architectural & Modality Ablation Study

To isolate the precise contribution of each architectural component, we conducted systematic ablation experiments across classification (BBBP, BACE) and regression (ESOL, FreeSolv) benchmarks.

![Systematic Architecture Ablation](../figures/11_systematic_architecture_ablation.png)
*Figure 5: Performance degradation across model variants in the systematic ablation study, demonstrating that tri-modal integration, dynamic attention gating, and contrastive regularization collectively drive peak performance.*

### Table 4: Multi-Factor Ablation Analysis of TriBioNode v2

| Config ID | Architecture Variant Tested | BBBP (ROC-AUC % $\uparrow$) | BACE (ROC-AUC % $\uparrow$) | ESOL (RMSE $\downarrow$) | FreeSolv (RMSE $\downarrow$) |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **A1** | View 1 Only (1D ChemBERTa Language) | 89.6 ± 0.6 | 84.1 ± 0.7 | 0.784 ± 0.032 | 1.420 ± 0.065 |
| **A2** | View 2 Only (2D Hierarchical Graph + MSGG) | 91.8 ± 0.5 | 86.9 ± 0.6 | 0.635 ± 0.022 | 0.962 ± 0.040 |
| **A3** | View 3 Only (3D $E(3)$-Equivariant EGNN) | 88.2 ± 0.7 | 82.5 ± 0.8 | 0.648 ± 0.025 | 0.995 ± 0.044 |
| **B1** | Dual-View: View 1 + View 2 (w/o 3D Conformer) | 93.8 ± 0.4 | 88.4 ± 0.5 | 0.598 ± 0.019 | 0.845 ± 0.031 |
| **B2** | Dual-View: View 2 + View 3 (w/o 1D Language) | 93.1 ± 0.5 | 87.8 ± 0.5 | 0.565 ± 0.017 | 0.792 ± 0.028 |
| **C1** | Tri-View w/o 8-Channel MSGG (Standard GIN only) | 94.1 ± 0.4 | 88.7 ± 0.4 | 0.572 ± 0.016 | 0.788 ± 0.026 |
| **C2** | Tri-View w/o BRICS Motif Transformer | 94.4 ± 0.4 | 89.0 ± 0.4 | 0.564 ± 0.015 | 0.775 ± 0.025 |
| **D1** | Tri-View w/o Contrastive Loss ($\lambda_{\text{CL}} = 0$) | 94.2 ± 0.4 | 88.8 ± 0.5 | 0.576 ± 0.017 | 0.795 ± 0.027 |
| **D2** | Tri-View w/ Static Fusion (w/o Dynamic Gating) | 94.5 ± 0.4 | 89.1 ± 0.4 | 0.568 ± 0.016 | 0.782 ± 0.025 |
| **FULL** | **TriBioNode v2 (Complete Architecture)** | **95.6 ± 0.3** | **90.4 ± 0.3** | **0.542 ± 0.014** | **0.741 ± 0.022** |

### Key Ablation Insights:
1. **The Indispensability of 3D Conformers for Physical Chemistry**: Removing View 3 (**B1**) causes FreeSolv RMSE to jump from 0.741 to 0.845 (+14.0% error) and Delaney ESOL RMSE from 0.542 to 0.598 (+10.3% error). Continuous 3D spatial geometry and solvent accessible surface envelopes are mandatory for thermodynamic hydration free energies.
2. **Impact of 8-Channel MSGG & BRICS Motifs**: Omitting MSGG positional isomerism (**C1**) degrades BBBP by -1.5% ROC-AUC and BACE by -1.7%, confirming that explicit *ortho/meta/para* and fused ring channels prevent message-passing over-smoothing.
3. **Synergy of Dynamic Gating & Contrastive Regularization**: Disabling dynamic gating (**D2**) or contrastive pre-regularization (**D1**) results in statistically significant drops across all benchmarks ($p < 0.01$), validating our hypothesis that cross-modal representations must be harmonized and dynamically weighted.

---

## 3.4 Dynamic Attention Gating Allocation Analysis

![Dynamic View Gating Allocation](../figures/09_dynamic_view_gating_allocation.png)
*Figure 6: Dynamic Attention View Gating distributions $\boldsymbol{\alpha} = [\alpha_{\text{seq}}, \alpha_{\text{graph}}, \alpha_{\text{conf}}]$ learned by TriBioNode v2 across distinct molecular property domains, showing adaptive allocation based on physical-chemical requirements.*

The learned gating coefficients $\boldsymbol{\alpha}(\mathbf{x})$ exhibit clear physical interpretability:
- **Quantum & Electronic Endpoints (QM8, QM9)**: View 3 (3D EGNN) dominates with an average gating allocation of **57.2%**, as electronic orbital energies and dipole moments depend strictly on 3D spatial geometry.
- **Thermodynamic Solubility (ESOL, FreeSolv, AqSolDB)**: View 2 (2D Graph + MSGG + Motifs) receives **52.3%** weight, reflecting the primary role of hydrogen bond donor/acceptor motifs and topological polar surface areas in aqueous solvation.
- **Membrane Permeability (BBBP, Caco-2)**: View 3 (**41.5%**) and View 2 (**36.4%**) share dominance, reflecting the co-dependence of membrane passive diffusion on both 3D molecular volume and 2D functional polarity.

---

## 3.5 Epistemic Uncertainty Calibration & Out-of-Distribution Reliability

![Parity Plot with Epistemic Uncertainty](../figures/10_parity_plot_with_epistemic_uncertainty.png)
*Figure 7: Parity plot of predicted vs. experimental Delaney ESOL aqueous solubility with sample points color-coded by calibrated epistemic uncertainty ($U_{\text{epistemic}}$). High-error outlier molecules reliably exhibit elevated epistemic uncertainty.*

### Table 5: Uncertainty Calibration Metrics across Scaffold-OOD Test Sets

| Metric Evaluated | In-Distribution (Random Split) | Scaffold-OOD (Bemis-Murcko Split) | Target Ideal |
| :--- | :---: | :---: | :---: |
| **Error-Uncertainty Pearson Correlation ($r$)** | **0.84 ± 0.02** | **0.76 ± 0.03** | 1.00 |
| **Prediction Interval Coverage (PICP 95%)** | **96.2%** | **95.4%** | 95.0% |
| **Mean Prediction Interval Width (MPIW)** | **1.12** | **1.48** | Minimal |
| **OOD Scaffold Detection AUROC** | — | **89.4%** | 100.0% |

As shown in **Figure 7** and **Table 5**, TriBioNode v2 achieves a high Pearson correlation ($r = 0.76$) between epistemic variance $U_{\text{epistemic}}(\mathbf{x})$ and absolute test error on unseen Bemis-Murcko scaffolds. At the 95% confidence level, the model achieves 95.4% empirical coverage (PICP), confirming that the deep ensemble head delivers well-calibrated, risk-aware predictions suitable for real-world screening.

---

## 3.6 Computational Efficiency & Inference Latency

### Table 6: Model Parameters, FLOPs, and Inference Throughput (Batch Size = 64, NVIDIA RTX 3090 GPU)

| Architecture | Total Parameters (M) | GFLOPs / Mol | Training Time (min/epoch) | Inference Latency (ms/mol) | GPU VRAM (GB) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| ChemBERTa-2 [15] | 44.2 M | 0.84 G | 1.4 min | 3.8 ms | 2.4 GB |
| D-MPNN [10] | 2.8 M | 0.12 G | 0.6 min | 1.1 ms | 1.1 GB |
| DimeNet++ [20] | 12.6 M | 4.80 G | 6.8 min | 18.4 ms | 6.2 GB |
| MvMRL [26] | 8.4 M | 0.95 G | 2.1 min | 4.6 ms | 2.8 GB |
| MMCL [23] | 48.6 M | 1.20 G | 3.2 min | 5.2 ms | 3.6 GB |
| **TriBioNode v2 (Ours)**| **52.4 M** | **1.85 G** | **3.8 min** | **6.4 ms** | **4.2 GB** |

With an inference throughput of **6.4 ms per molecule** (>150 molecules per second on a single GPU), TriBioNode v2 delivers state-of-the-art predictive power while remaining computationally tractable for million-compound virtual screening campaigns.

---

# IV. REFERENCES

[1] D. K. Agrafiotis et al., "Advances in cheminformatics," *Nature Reviews Drug Discovery*, vol. 6, no. 12, pp. 994–1007, 2007.  
[2] H. Chen et al., "The rise of deep learning in drug discovery," *Drug Discovery Today*, vol. 23, no. 6, pp. 1241–1250, 2018.  
[3] J. A. DiMasi et al., "Innovation in the pharmaceutical industry: New estimates of R&D costs," *Journal of Health Economics*, vol. 47, pp. 20–33, 2016.  
[4] K. Yang et al., "Analyzing learned molecular representations for property prediction," *Journal of Chemical Information and Modeling*, vol. 59, no. 8, pp. 3370–3388, 2019.  
[5] C. W. Coley et al., "Autonomous discovery in the chemical sciences," *Science*, vol. 365, no. 6451, eaax1566, 2019.  
[6] J. Gilmer et al., "Neural message passing for quantum chemistry," in *Proc. ICML*, 2017, pp. 1263–1272.  
[7] P. Duvenaud et al., "Convolutional networks on graphs for learning molecular fingerprints," in *Proc. NeurIPS*, 2015, pp. 2224–2232.  
[8] D. Weininger, "SMILES, a chemical language and information system. 1. Introduction to methodology and encoding rules," *J. Chem. Inf. Comput. Sci.*, vol. 28, no. 1, pp. 31–36, 1988.  
[9] S. Honda et al., "Smiles-transformer: Pre-trained molecular fingerprint for low data chemical learning," *arXiv preprint arXiv:1911.04738*, 2019.  
[10] K. Yang et al., "Analyzing learned molecular representations for property prediction," *J. Chem. Inf. Model.*, vol. 59, no. 8, pp. 3370–3388, 2019.  
[11] W. Hu et al., "Strategies for pre-training graph neural networks," in *Proc. ICLR*, 2020.  
[12] K. T. Schütt et al., "SchNet – A deep learning architecture for molecules and materials," *J. Chem. Phys.*, vol. 148, no. 24, 241722, 2018.  
[13] J. Klicpera et al., "Fast and uncertainty-aware directional message passing for non-equilibrium molecular dynamics," in *Proc. NeurIPS*, 2020.  
[14] S. Wang et al., "SMILES-BERT: Large scale pre-trained language model for molecular property prediction," in *Proc. ACM-BCB*, 2019, pp. 429–436.  
[15] S. Chithrananda et al., "ChemBERTa: Large-scale self-supervised pretraining for molecular property prediction," *arXiv preprint arXiv:2010.09885*, 2020.  
[16] T. N. Kipf and M. Welling, "Semi-supervised classification with graph convolutional networks," in *Proc. ICLR*, 2017.  
[17] P. Veličković et al., "Graph attention networks," in *Proc. ICLR*, 2018.  
[18] K. Xu et al., "How powerful are graph neural networks?," in *Proc. ICLR*, 2019.  
[19] K. T. Schütt et al., "SchNet: A continuous-filter convolutional neural network for modeling quantum interactions," in *Proc. NeurIPS*, 2017.  
[20] J. Gasteiger et al., "Directional message passing for molecular graphs," in *Proc. ICLR*, 2020.  
[21] L. Cai, Y. He, X. Fu, L. Zhuo, Q. Zou, and X. Yao, "AEGNN-M: A 3D graph-spatial co-representation model for molecular property prediction," *IEEE J. Biomed. Health Inform.*, vol. 29, no. 3, pp. 1726–1737, 2025.  
[22] X. Zhang, H. Xiang, X. Yang, J. Dong, X. Fu, X. Zeng, H. Chen, and K. Li, "Dual-view learning based on images and sequences for molecular property prediction," *IEEE J. Biomed. Health Inform.*, vol. 28, no. 3, pp. 1564–1574, 2024.  
[23] M. Gao and F. Zhu, "MMCL: A multi-modal contrastive learning framework for molecular property prediction," *IEEE Trans. Comput. Biol. Bioinform.*, vol. 23, no. 3, pp. 1051–1062, 2026.  
[24] S. Wang, Z. Li, S. Zhang, M. Jiang, X. Wang, and Z. Wei, "Molecular property prediction based on a multichannel substructure graph," *IEEE Access*, vol. 8, pp. 2968535, 2020.  
[25] L. Zhang, D. Niu, B. Zhang, Q. Zhang, and Z. Li, "Property-guided few-shot learning for molecular property prediction with dual-view encoder and relation graph learning network," *IEEE J. Biomed. Health Inform.*, vol. 29, no. 3, pp. 1747–1758, 2025.  
[26] R. Zhang, Y. Lin, Y. Wu, L. Deng, H. Zhang, M. Liao, and Y. Peng, "MvMRL: a multi-view molecular representation learning method for molecular property prediction," *Briefings in Bioinformatics*, vol. 25, no. 4, bbae298, 2024.  
[27] Z. Wu et al., "MoleculeNet: A benchmark for molecular machine learning," *Chem. Sci.*, vol. 9, no. 2, pp. 513–530, 2018.  
[28] K. Huang et al., "Therapeutics Data Commons: Machine learning datasets and tasks for drug discovery," in *Proc. NeurIPS Datasets and Benchmarks Track*, 2021.  
