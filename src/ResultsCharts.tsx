import { useState, useEffect, useRef } from "react";
import { absoluteError, asset, fmt, label, research } from "./research";
import type { MetricKey, ViewKey } from "./research";
import Icon from "./Icon";

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
};

const thesisFigures: FigureItem[] = [
  {
    "id": "fig-12",
    "number": "Source figure 1",
    "badge": "Performance",
    "title": "Benchmark comparison",
    "category": "Performance",
    "image": "figures/12_multiview_comparative_performance.png",
    "caption": "Source ESOL diagnostics: parity, error density, error-tolerance curves and residual structure."
  },
  {
    "id": "fig-10",
    "number": "Source figure 2",
    "badge": "Performance",
    "title": "Parity and uncertainty",
    "category": "Performance",
    "image": "figures/10_parity_plot_with_epistemic_uncertainty.png",
    "caption": "Source parity and uncertainty plot. Interval calibration has not been verified."
  },
  {
    "id": "fig-09",
    "number": "Source figure 3",
    "badge": "Gating & Attention",
    "title": "View allocation",
    "category": "Gating & Attention",
    "image": "figures/09_dynamic_view_gating_allocation.png",
    "caption": "Source visualization of allocation across sequence, structure and geometry views."
  },
  {
    "id": "fig-14",
    "number": "Source figure 4",
    "badge": "Gating & Attention",
    "title": "Molecular descriptors and routing",
    "category": "Gating & Attention",
    "image": "figures/14_dynamic_gating_mechanistic_analysis.png",
    "caption": "Source plot relating molecular descriptors to representation weights."
  },
  {
    "id": "fig-13",
    "number": "Source figure 5",
    "badge": "Latent Topology",
    "title": "Embedding projections",
    "category": "Latent Topology",
    "image": "figures/13_multiview_latent_manifold_tsne.png",
    "caption": "Source projection of molecular embeddings; clustering quality is not established."
  },
  {
    "id": "fig-15",
    "number": "Source figure 6",
    "badge": "Gating & Attention",
    "title": "Cross-view complementarity",
    "category": "Gating & Attention",
    "image": "figures/15_cross_modal_complementarity_and_synergy.png",
    "caption": "Source illustration of prediction differences and cross-view complementarity."
  },
  {
    "id": "fig-11",
    "number": "Source figure 7",
    "badge": "Ablations",
    "title": "Component ablations",
    "category": "Ablations",
    "image": "figures/11_systematic_architecture_ablation.png",
    "caption": "Proposed component ablations; statistical significance has not been established."
  },
  {
    "id": "fig-07",
    "number": "Source figure 8",
    "badge": "Performance",
    "title": "Residual correlations",
    "category": "Performance",
    "image": "figures/07_multiview_complementarity_matrix.png",
    "caption": "Source correlation matrices for molecular prediction residuals."
  },
  {
    "id": "fig-fusion",
    "number": "Source figure 9",
    "badge": "Representations",
    "title": "Gating and fusion schematic",
    "category": "Representations",
    "image": "figures/view_fusion_dynamic_gating_synergy.png",
    "caption": "Source schematic of view gating and cross-modal fusion."
  }
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

  const dialogRef = useRef<HTMLDialogElement>(null);
  const figureTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!modalFigure || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const trigger = figureTrigger.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.figure-modal-close')?.focus();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, [modalFigure]);

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
              <h3>Prediction head performance</h3>
            </div>
            <label className="metric-select">
              Metric
              <select
                aria-label="Comparison metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value as MetricKey)}
              >
                <option value="RMSE">RMSE</option>
                <option value="MAE">MAE</option>
                <option value="R2">R²</option>
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
          <h3>Mean view allocation</h3>
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
              <h3>{view.label}: observed vs. predicted</h3>
            </div>
            <span className="chart-metric" style={{ color: view.color }}>
              R² {fmt(view.metrics.R2, 3)}
            </span>
          </div>
          <div className="parity-chart-scroll" role="region" tabIndex={0} aria-label="Observed versus predicted chart; scroll horizontally to inspect"><svg
            className="parity-plot"
            viewBox="0 0 500 362"
            role="img"
            aria-label={`${view.label} predicted versus experimental log solubility for 113 molecules. The dashed identity line shows perfect agreement.`}
          >
            <text x="60" y="19" fill="var(--text-2)" fontSize="13">
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
                  fontSize="13"
                  fill="var(--text-2)"
                >
                  {fmt(t, 1)}
                </text>
                <text
                  x={x(t)}
                  y="326"
                  textAnchor="middle"
                  fontSize="13"
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
              fontSize="13"
            >
              Experimental log₁₀(mol/L)
            </text>
          </svg></div><p className="chart-scroll-hint">Scroll horizontally to inspect the chart.</p>
          <div className="plot-legend">
            <i style={{ background: view.color }} />
            {research.meta.sampleCount} test observations{" "}
            <span>Identity line (y = x)</span>
          </div>
        </article>

        <article className="chart-card error-card">
          <p className="mini-label">Absolute error distribution</p>
          <h3>Absolute prediction error</h3>
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
              <th scope="col">RMSE</th>
              <th scope="col">MAE</th>
              <th scope="col">R²</th>
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
          <Icon name="plus" />
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


      <section
        className="thesis-figures-panel"
        aria-label="Source manuscript figures"
      >
        <div className="figures-header">
          <div>
            <h3>Source manuscript figures</h3>
            <p>Original manuscript graphics for context. Additional benchmark, uncertainty and ablation claims are not validated by the saved ESOL evaluation above.</p>
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
              aria-label={`${fig.number}: ${fig.title}. Open full-resolution figure.`}
              onClick={event => { figureTrigger.current = event.currentTarget; setModalFigure(fig); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  figureTrigger.current = e.currentTarget;
                  setModalFigure(fig);
                }
              }}
            >
              <div className="figure-card-media">
                <img
                  src={asset(fig.image)}
                  alt={`${fig.number}: ${fig.title}`}
                  loading="lazy"
                  decoding="async"
                  width="720"
                  height="420"
                />
              </div>
              <div className="figure-card-body">
                <div className="figure-card-meta">
                  <span className="figure-badge">{fig.number}</span>
                  <span className="figure-tag">{fig.badge}</span><Icon name="expand" />
                </div>
                <h4>{fig.title}</h4>
                <p className="micro figure-caption">{fig.caption}</p>
              </div>
            </article>
          ))}
        </div>
      </section>


      {modalFigure && (
        <dialog
          ref={dialogRef}
          className="figure-modal-backdrop"
          onCancel={() => setModalFigure(null)}
          onClick={event => { if(event.target === event.currentTarget) setModalFigure(null) }}
          onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')];
            const current = controls.indexOf(document.activeElement as HTMLElement);
            const target = controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length];
            if (target) { event.preventDefault(); target.focus(); }
          }}
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
              <div className="figure-modal-actions"><a className="figure-modal-download" aria-label="Download image" title="Download image" href={asset(modalFigure.image)} download={modalFigure.image.split('/').pop()}><Icon name="download" /></a><button
                type="button"
                className="figure-modal-close"
                onClick={() => setModalFigure(null)}
                aria-label="Close high-resolution figure modal"
              >
                <Icon name="close" />
              </button></div>
            </div>
            <div className="figure-modal-image-wrap">
              <img src={asset(modalFigure.image)} alt={modalFigure.title} />
            </div>
            <div className="figure-modal-footer">
              <p className="figure-modal-caption">{modalFigure.caption}</p>
              <p className="micro">Source-manuscript figure; not independently validated.</p>

            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
