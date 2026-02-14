// src/ui/charts.js
import { clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";

/**
 * charts.js
 * - Widget2 (cost hist) や散布図など、Chart.js を使う描画を管理
 *
 * 今回の修正ポイント：
 * - canvas が差し替わったのに古い Chart インスタンスが残ると描画されない
 * - なので「canvas要素が変わったら destroy→作り直す」ガードを入れる
 */

const _chartCache = {
  w2_cost_hist: null, // { chart, canvas }
  // ほかも必要なら同様に増やす
};

function getChartCtor_() {
  return window.Chart || (typeof Chart !== "undefined" ? Chart : null);
}

function ensureChartFresh_(key, canvas, createFn) {
  const prev = _chartCache[key];

  // 既存 chart があるが、canvas が違うなら破棄して作り直す
  if (prev?.chart && prev?.canvas && prev.canvas !== canvas) {
    try { prev.chart.destroy(); } catch (_) {}
    _chartCache[key] = null;
  }

  // 同一canvasで既存 chart があるなら再利用（必要なら update）
  if (_chartCache[key]?.chart && _chartCache[key]?.canvas === canvas) {
    return _chartCache[key].chart;
  }

  const chart = createFn();
  _chartCache[key] = { chart, canvas };
  return chart;
}

export function renderCharts(state, actions) {
  const ChartCtor = getChartCtor_();
  if (!ChartCtor) return;

  // =========================
  // Widget2: cost hist
  // =========================
  const w2Canvas = document.getElementById("w2_cost_hist_canvas");
  if (w2Canvas) {
    ensureChartFresh_("w2_cost_hist", w2Canvas, () => {
      const ctx = w2Canvas.getContext("2d");

      // ここは既存の state 依存があるなら差し替えてOK
      const bins = (state?.vm?.costHist?.bins) || [0, 10, 20, 30, 40, 50];
      const counts = (state?.vm?.costHist?.counts) || [1, 2, 3, 2, 1];

      return new ChartCtor(ctx, {
        type: "bar",
        data: {
          labels: bins.map((b, i) => (i < bins.length - 1 ? `${bins[i]}–${bins[i + 1]}` : `${b}+`)),
          datasets: [{ data: counts }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
          },
          scales: {
            x: { ticks: { maxRotation: 0 } },
            y: { beginAtZero: true },
          },
        },
      });
    });
  }

  // =========================
  // ほかの chart があるならここに続ける
  // =========================
}
