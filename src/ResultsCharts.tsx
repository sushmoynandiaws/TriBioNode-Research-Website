import { useState, useEffect } from "react";
import { absoluteError, asset, fmt, label, research } from "./research";
import type { MetricKey, ViewKey } from "./research";

type FigureCategory =
  | "All"
  | "Performance"
  | "Gating & Attention"
  | "Latent Topology"
  | "Ablations"
  | "Representations";

type FigureItem = {
  id: string;
  number: string;
  badge: string;
  title: string;
  category: FigureCategory;
  image: string;
  caption: string;
  takeaway: string;
};

const thesisFigures: FigureItem[] = [
  {
    id: "fig-12",
    number: "Figure 7",
    badge: "Empirical Benchmark",
    title: "Multi-Modal Comparative Performance Analysis",
    category: "Performance",
    image: "figures/12_multiview_comparative_performance.png",
    caption:
      "Comparative evaluation across ESOL, FreeSolv, and Lipophilicity benchmarks showing TriBioNode multi-modal fusion outperforming individual 1D, 2D, and 3D unimodal baselines.",
    takeaway:
      "Multi-view fusion reduces test RMSE and variance compared to any single modality.",
  },
  {
    id: "fig-10",
    number: "Figure 10",
    badge: "Uncertainty Estimation",
    title: "Parity Plot with Epistemic Uncertainty",
    category: "Performance",
    image: "figures/10_parity_plot_with_epistemic_uncertainty.png",
    caption:
      "Predicted versus experimental aqueous solubility across the evaluation set, complete with 95% epistemic confidence bounds and residual distributions.",
    takeaway:
      "Tight alignment around the identity diagonal with calibrated epistemic uncertainty.",
  },
  {
    id: "fig-09",
    number: "Figure 10a",
    badge: "Dynamic Attention",
    title: "Dynamic Attention View Gating Allocation",
    category: "Gating & Attention",
    image: "figures/09_dynamic_view_gating_allocation.png",
    caption:
      "Ternary routing simplex showing adaptive weighting distribution between 1D SMILES, 2D Graph motifs, and 3D Conformer spatial representations.",
    takeaway:
      "Adaptive gating routes molecular features dynamically rather than using static averaging.",
  },
  {
    id: "fig-14",
    number: "Figure 10b",
    badge: "Mechanistic Routing",
    title: "Mechanistic Analysis of Dynamic Gating",
    category: "Gating & Attention",
    image: "figures/14_dynamic_gating_mechanistic_analysis.png",
    caption:
      "Correlations between chemical complexity descriptors (rotatable bonds, aromatic rings, molecular flexibility) and learned representation weights.",
    takeaway:
      "High-flexibility conformers steer gating toward 3D features, while rigid conjugated molecules rely more on graph motifs.",
  },
  {
    id: "fig-13",
    number: "Figure 8",
    badge: "Latent Manifold",
    title: "Multi-View Latent Manifold Topology via t-SNE",
    category: "Latent Topology",
    image: "figures/13_multiview_latent_manifold_tsne.png",
    caption:
      "High-dimensional latent embedding clustering comparing individual view representations against the unified cross-modal fused manifold.",
    takeaway:
      "Fused latent space achieves superior clustering and separation of physicochemical property regimes.",
  },
  {
    id: "fig-15",
    number: "Figure 11",
    badge: "Synergy Matrix",
    title: "Cross-Modal Complementarity & Synergistic Correction",
    category: "Gating & Attention",
    image: "figures/15_cross_modal_complementarity_and_synergy.png",
    caption:
      "Empirical error correction analysis demonstrating how cross-modal attention compensates when individual unimodal encoders make divergent predictions.",
    takeaway:
      "Orthogonal error profiles between views enable the fused head to recover accurate targets.",
  },
  {
    id: "fig-11",
    number: "Figure 9",
    badge: "Ablation Study",
    title: "Systematic Architectural Ablation Study",
    category: "Ablations",
    image: "figures/11_systematic_architecture_ablation.png",
    caption:
      "Component-wise ablation isolating the empirical impact of BRICS motif pooling, RBF spatial encodings, and cross-attention gating layers.",
    takeaway:
      "Every architectural component provides statistically significant error reduction.",
  },
  {
    id: "fig-07",
    number: "Figure 6",
    badge: "Residual Matrix",
    title: "Multi-View Complementarity Matrix",
    category: "Performance",
    image: "figures/07_multiview_complementarity_matrix.png",
    caption:
      "Pairwise Pearson and Spearman correlation matrices of prediction residuals across Delaney ESOL test molecules.",
    takeaway:
      "Low inter-view residual correlation confirms that the three representation encoders capture complementary molecular information.",
  },
  {
    id: "fig-fusion",
    number: "Mechanism",
    badge: "Cross-Modal Fusion",
    title: "Dynamic Gating & Multi-View Synergy",
    category: "Representations",
    image: "figures/view_fusion_dynamic_gating_synergy.png",
    caption:
      "Architectural schematic of the parallel gating network and cross-modal attention fusion layer.",
    takeaway:
      "Jointly balances sequence tokens, molecular graph subgraphs, and spatial 3D distances.",
  },
];

const categories: FigureCategory[] = [
  "All",
  "Performance",
  "Gating & Attention",
  "Latent Topology",
  "Ablations",
  "Representations",
];

export default function ResultsCharts() {
  const [metric, setMetric] = useState<MetricKey>("RMSE");
  const [selected, setSelected] = useState<ViewKey>("fused");
  const [activeCategory, setActiveCategory] = useState<FigureCategory>("All");
  const [modalFigure, setModalFigure] = useState<FigureItem | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalFigure(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const view = research.views.find((v) => v.key === selected)!;
  const maxMetric =
    Math.max(...research.views.map((v) => v.metrics[metric])) * 1.12;
  const allValues = research.records.flatMap((r) => [
    r.target,
    ...Object.values(r.predictions),
  ]);
  const low = Math.floor(Math.min(...allValues));
  const high = Math.ceil(Math.max(...allValues));
  const x = (value: number) => 60 + ((value - low) / (high - low)) * 386;
  const y = (value: number) => 304 - ((value - low) / (high - low)) * 264;
  const ticks = Array.from(
    { length: 5 },
    (_, i) => low + ((high - low) * i) / 4,
  );
  const bins = [0, 0.25, 0.5, 1, 2, Infinity];
  const binLabels = ["< 0.25", "0.25–0.5", "0.5–1", "1–2", "≥ 2"];
  const errors = research.records.map((r) => absoluteError(r, selected));
  const counts = bins
    .slice(0, -1)
    .map(
      (edge, i) => errors.filter((e) => e >= edge && e < bins[i + 1]).length,
    );

  const filteredFigures =
    activeCategory === "All"
      ? thesisFigures
      : thesisFigures.filter((f) => f.category === activeCategory);

  return (
    <>
      <div className="results-top-grid">
        <article className="chart-card metric-chart">
          <div className="chart-heading">
            <div>
              <p className="mini-label">Prediction head comparison</p>
              <h3>The value of bringing views together</h3>
            </div>
            <label className="metric-select">
              Metric
              <select
                aria-label="Comparison metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value as MetricKey)}
              >
                <option value="RMSE">RMSE ↓</option>
                <option value="MAE">MAE ↓</option>
                <option value="R2">R² ↑</option>
              </select>
            </label>
          </div>
          <p className="chart-explanation">
            {metric === "R2"
              ? "R² describes variance explained; higher is better."
              : `${metric === "RMSE" ? "Root mean squared" : "Mean absolute"} error in log₁₀(mol/L); lower is better.`}
          </p>
          <div
            className="metric-bars"
            role="img"
            aria-label={research.views
              .map((v) => `${v.label} ${metric}: ${fmt(v.metrics[metric], 4)}`)
              .join("; ")}
          >
            {research.views.map((v) => (
              <div className="metric-bar-row" key={v.key}>
                <span>
                  <i style={{ background: v.color }} />
                  {v.label}
                  <small>{v.name}</small>
                </span>
                <div className="metric-bar-track">
                  <div
                    style={{
                      width: `${(v.metrics[metric] / maxMetric) * 100}%`,
                      background: v.color,
                    }}
                  />
                </div>
                <strong style={{ color: v.color }}>
                  {fmt(v.metrics[metric], 4)}
                </strong>
              </div>
            ))}
          </div>
          <p className="micro">
            View-specific heads share the fused model’s training. This is a
            within-model comparison.
          </p>
        </article>

        <article className="chart-card mean-gating">
          <p className="mini-label">Mean routing allocation</p>
          <h3>Where the gate puts its weight</h3>
          <div
            className="mean-gate-number"
            style={{ color: research.views[2].color }}
          >
            {fmt(research.meanGates[2] * 100, 2)}
            <span>%</span>
          </div>
          <p className="micro">
            of mean gating allocation goes to the geometry view in this saved
            test set.
          </p>
          <div
            className="gate-track"
            role="img"
            aria-label={research.views
              .slice(0, 3)
              .map(
                (v, i) =>
                  `${v.label} mean gate ${fmt(research.meanGates[i] * 100, 2)} percent`,
              )
              .join("; ")}
          >
            {research.views.slice(0, 3).map((v, i) => (
              <span
                key={v.key}
                style={{
                  width: `${research.meanGates[i] * 100}%`,
                  background: v.color,
                }}
              />
            ))}
          </div>
          <div className="mean-gate-legend">
            {research.views.slice(0, 3).map((v, i) => (
              <div key={v.key}>
                <i style={{ background: v.color }} />
                <span>
                  {v.label} · {v.name}
                </span>
                <strong>{fmt(research.meanGates[i] * 100, 2)}%</strong>
              </div>
            ))}
          </div>
          <p className="micro">
            Routing is not a causal attribution, and the fused head also uses a
            separate cross-modal pathway.
          </p>
        </article>
      </div>

      <div className="result-controls">
        <span className="mini-label">Explore a prediction head</span>
        <div
          role="group"
          aria-label="Result prediction view"
          className="view-switcher"
        >
          {research.views.map((v) => (
            <button
              key={v.key}
              aria-pressed={selected === v.key}
              onClick={() => setSelected(v.key)}
              style={{ "--view-color": v.color } as React.CSSProperties}
            >
              <i style={{ background: v.color }} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="results-bottom-grid">
        <article className="chart-card parity-card">
          <div className="chart-heading">
            <div>
              <p className="mini-label">Observed vs. predicted</p>
              <h3>{view.label}: the parity view</h3>
            </div>
            <span className="chart-metric" style={{ color: view.color }}>
              R² {fmt(view.metrics.R2, 3)}
            </span>
          </div>
          <svg
            className="parity-plot"
            viewBox="0 0 500 362"
            role="img"
            aria-label={`${view.label} predicted versus experimental log solubility for 113 molecules. The dashed identity line shows perfect agreement.`}
          >
            <text x="60" y="19" fill="var(--text-2)" fontSize="11">
              Predicted log₁₀(mol/L)
            </text>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1="60"
                  x2="446"
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--hairline)"
                />
                <line
                  x1={x(t)}
                  x2={x(t)}
                  y1="40"
                  y2="304"
                  stroke="var(--hairline)"
                />
                <text
                  x="48"
                  y={y(t) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--text-2)"
                >
                  {fmt(t, 1)}
                </text>
                <text
                  x={x(t)}
                  y="326"
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--text-2)"
                >
                  {fmt(t, 1)}
                </text>
              </g>
            ))}
            <line
              x1={x(low)}
              x2={x(high)}
              y1={y(low)}
              y2={y(high)}
              stroke="var(--text-2)"
              strokeWidth="1.4"
              strokeDasharray="5 5"
            />
            {research.records.map((r) => (
              <circle
                key={r.id}
                cx={x(r.target)}
                cy={y(r.predictions[selected])}
                r="4"
                fill={view.color}
                fillOpacity="0.65"
                stroke="var(--surface)"
                strokeWidth="0.7"
              >
                <title>
                  {label(r)}: observed {fmt(r.target)}, predicted{" "}
                  {fmt(r.predictions[selected])}, error{" "}
                  {fmt(absoluteError(r, selected))}
                </title>
              </circle>
            ))}
            <text
              x="255"
              y="354"
              textAnchor="middle"
              fill="var(--text-2)"
              fontSize="11"
            >
              Experimental log₁₀(mol/L)
            </text>
          </svg>
          <div className="plot-legend">
            <i style={{ background: view.color }} />
            {research.meta.sampleCount} test observations{" "}
            <span>┄ Perfect agreement (y = x)</span>
          </div>
        </article>

        <article className="chart-card error-card">
          <p className="mini-label">Absolute error distribution</p>
          <h3>How far do predictions miss?</h3>
          <p className="chart-explanation">
            {view.label} · Counts by absolute error in log₁₀(mol/L).
          </p>
          <div
            className="error-bars"
            role="img"
            aria-label={binLabels
              .map((name, i) => `Error ${name}: ${counts[i]} molecules`)
              .join("; ")}
          >
            {counts.map((count, i) => (
              <div key={binLabels[i]}>
                <span>{binLabels[i]}</span>
                <div>
                  <span
                    style={{
                      width: `${(count / research.meta.sampleCount) * 100}%`,
                      background: view.color,
                    }}
                  />
                </div>
                <strong>
                  {count}
                  <small> / {research.meta.sampleCount}</small>
                </strong>
              </div>
            ))}
          </div>
          <div className="error-summary">
            <span className="mini-label">Mean absolute error</span>
            <strong style={{ color: view.color }}>
              {fmt(view.metrics.MAE, 4)}
              <small>log₁₀(mol/L)</small>
            </strong>
          </div>
          <p className="micro">
            Bins include their lower bound and exclude the upper bound. No
            observations are discarded.
          </p>
        </article>
      </div>

      <div
        className="metric-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Performance comparison table; scroll horizontally to see all metrics"
      >
        <table className="metric-table">
          <caption>
            Measured ESOL performance · {research.meta.sampleCount} aligned test
            observations
          </caption>
          <thead>
            <tr>
              <th scope="col">Prediction head</th>
              <th scope="col">RMSE ↓</th>
              <th scope="col">MAE ↓</th>
              <th scope="col">R² ↑</th>
              <th scope="col">Mean gate</th>
            </tr>
          </thead>
          <tbody>
            {research.views.map((v, i) => (
              <tr
                key={v.key}
                className={v.key === "fused" ? "fused-table-row" : ""}
              >
                <th scope="row">
                  <i style={{ background: v.color }} />
                  {v.label}
                  <span>{v.description}</span>
                </th>
                <td>{fmt(v.metrics.RMSE, 4)}</td>
                <td>{fmt(v.metrics.MAE, 4)}</td>
                <td>{fmt(v.metrics.R2, 4)}</td>
                <td>
                  {i < 3 ? `${fmt(research.meanGates[i] * 100, 2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="observation-table">
        <summary>
          Inspect all {research.meta.sampleCount} underlying observations{" "}
          <span aria-hidden="true">＋</span>
        </summary>
        <div
          className="observation-scroll"
          tabIndex={0}
          role="region"
          aria-label="All saved observations; scroll to inspect rows"
        >
          <table>
            <caption>
              {view.label} — values in log₁₀(mol/L); source row order preserved
            </caption>
            <thead>
              <tr>
                <th scope="col">Molecule</th>
                <th scope="col">Observed</th>
                <th scope="col">Predicted</th>
                <th scope="col">Absolute error</th>
              </tr>
            </thead>
            <tbody>
              {research.records.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{label(r)}</th>
                  <td>{fmt(r.target, 4)}</td>
                  <td>{fmt(r.predictions[selected], 4)}</td>
                  <td>{fmt(absoluteError(r, selected), 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Real Thesis Research Figures Section */}
      <section
        className="thesis-figures-panel"
        aria-label="Empirical research figures from the thesis"
      >
        <div className="figures-header">
          <div>
            <div className="figures-header-badge">
              <span className="status-badge">
                <span />
                Real Manuscript Artifacts
              </span>
              <span className="figures-count-pill">
                {thesisFigures.length} empirical figures
              </span>
            </div>
            <h3>Thesis research figures & empirical evidence</h3>
            <p>
              Original high-resolution experimental plots generated from the
              research codebase and published in the TriBioNode evaluation
              manuscript.
            </p>
          </div>
          <div
            className="figure-category-chips"
            role="group"
            aria-label="Filter figures by topic"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`figure-chip ${activeCategory === cat ? "active" : ""}`}
                onClick={() => setActiveCategory(cat)}
                aria-pressed={activeCategory === cat}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div
          className="figures-grid"
          role="region"
          aria-label="Research figures gallery"
        >
          {filteredFigures.map((fig) => (
            <article
              key={fig.id}
              className="figure-card"
              tabIndex={0}
              role="button"
              aria-label={`${fig.number}: ${fig.title}. Click to view full resolution.`}
              onClick={() => setModalFigure(fig)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setModalFigure(fig);
                }
              }}
            >
              <div className="figure-card-media">
                <img
                  src={asset(fig.image)}
                  alt={`${fig.number}: ${fig.title}`}
                  loading="lazy"
                  width="720"
                  height="420"
                />
                <div className="figure-card-overlay">
                  <span className="inspect-pill">
                    <span aria-hidden="true">🔍</span> Inspect full resolution
                  </span>
                </div>
              </div>
              <div className="figure-card-body">
                <div className="figure-card-meta">
                  <span className="figure-badge">{fig.number}</span>
                  <span className="figure-tag">{fig.badge}</span>
                </div>
                <h4>{fig.title}</h4>
                <p className="figure-takeaway">
                  <strong>Key evidence:</strong> {fig.takeaway}
                </p>
                <p className="micro figure-caption">{fig.caption}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Lightbox Modal for High-Resolution Figure Inspection */}
      {modalFigure && (
        <div
          className="figure-modal-backdrop"
          onClick={() => setModalFigure(null)}
          role="dialog"
          aria-modal="true"
          aria-label={modalFigure.title}
        >
          <div
            className="figure-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="figure-modal-header">
              <div>
                <div className="figure-modal-meta">
                  <span className="figure-badge">{modalFigure.number}</span>
                  <span className="figure-tag">{modalFigure.badge}</span>
                </div>
                <h3>{modalFigure.title}</h3>
              </div>
              <button
                type="button"
                className="figure-modal-close"
                onClick={() => setModalFigure(null)}
                aria-label="Close high-resolution figure modal"
              >
                ✕
              </button>
            </div>
            <div className="figure-modal-image-wrap">
              <img src={asset(modalFigure.image)} alt={modalFigure.title} />
            </div>
            <div className="figure-modal-footer">
              <p className="figure-modal-caption">{modalFigure.caption}</p>
              <p className="figure-modal-takeaway">
                <strong>Empirical takeaway:</strong> {modalFigure.takeaway}
              </p>
              <div className="figure-modal-actions">
                <a
                  className="button compact secondary"
                  href={asset(modalFigure.image)}
                  download={modalFigure.image.split("/").pop()}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download full image ↓
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
