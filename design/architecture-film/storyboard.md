# TriBioNode architecture film

44-second deterministic Three.js film, with separate landscape and portrait compositions.
Source: 02_Train_TriBioNode_MultiView_Architecture.ipynb, model forward pass, inspected 2026-10-27.

0–6s: saved ESOL 044 molecular conformer enters an optical input ring and branches into three representations.
6–18s: character tokens and Transformer; atom graph, motif pooling and motif Transformer; 3D conformer and fixed RBF distance features. Three embeddings emerge. Pairwise contrastive alignment appears as a training-only relationship.
18–29s: each embedding feeds BOTH dynamic view gating and cross-modal Transformer fusion. Saved per-example gating weights 2.72%, 1.10%, 96.18% illustrate the first branch.
29–36s: concatenate the two fused representations; prediction MLP 512 → 256 → 128 → 1 (default d_model=256).
36–44s: the saved example prediction -4.459 log10(mol/L), observed -4.380; clear saved-example label, no live inference claim.

Do not animate unsupported pretrained ChemBERTa, effective coordinate refinement, calibrated uncertainty, deep ensembles, or lipophilicity evaluation. Three view-specific auxiliary prediction heads and contrastive projection heads are trained alongside the fused model; the main film follows the fused inference path.
The supplied 3D conformer is for visualization and is not the original training geometry. Embedding bars, attention connections and processing pulses are conceptual visualizations, not recovered model tensors or timing measurements.

Premium export: render.html → Render premium master exports an Annex-B H.264 master at exactly 30 fps (1320 frames), landscape 3840×2160 or portrait 1440×2560. Mux with `ffmpeg -r 30 -i master.h264 -c:v copy -movflags +faststart film.mp4`. Only one chapter is visible at a time, and captions have reserved space. All moving objects stay inside one active chapter; chapter changes use a whole-frame fade while 3D surfaces remain opaque. Encoder groups have fixed, separate positions. No embeddings fly across another chapter or its captions. Blue, teal and amber consistently identify the three representations.
For web delivery, encode the master to H.264 with libx264, CRF 17, medium preset, yuv420p and faststart. Preserve the native dimensions and verify 1320 frames / 44 seconds. Compare SSIM against the source master before replacing site assets.

Spacing validation: use Check spacing in each orientation. It evaluates all 1320 frames, checking protected ink bounds for label/label and label/object collisions, clipping, mesh opacity, and chapter ownership. The premium exporter repeats the checks at every encoded frame and rejects an invalid composition. Token glyphs inside token tiles are intentional and excluded from protected captions.
