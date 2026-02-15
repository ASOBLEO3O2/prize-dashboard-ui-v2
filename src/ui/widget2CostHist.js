// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";
import { renderChart } from "./charts.js";

/**
 * Widget②：原価率 分布（ヒスト）
 * ✅ 中身（仕様・集計・ビン）はここに閉じる
 * ✅ charts.js は「描画ホスト」なので中身に干渉しない
 *
 * 注意：
 * - 拡大前と拡大後で DOM id が衝突しないように、id/key を外から渡せる
 */

const DEFAULTS = {
  chartKey: "w2-costHist",        // ChartHost上のID
  canvasId: "costHistChart",      // canvasのDOM id（必須ではないがCSS等に残ってる場合のため）
  modeSelectId: "costHistMode",   // selectのDOM id（既存互換）
  title: null,                    // ここでは使わないが将来用
};

// あなたの自然レンジ
const COST_BINS = [
  { label: "0–10%"  },
  { label: "11–25%" },
  { label: "26–32%" },
  { label: "33–40%" },
  { label: "40%〜"  },
];

function pickCostBinIndex(rate01) {
  const r = Number(rate01);
  if (!Number.isFinite(r) || r < 0) return -1;

  if (r <= 0.10) return 0;
  if (r <= 0.25) return 1;
  if (r <= 0.32) return 2;
  if (r <  0.40) return 3; // 40未満のみ
  return 4;                // 40以上
}

function toNum(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim().replace(/,/g, "");
    if (!s) return null;
    if (s.endsWith("%")) {
      const n = Number(s.slice(0, -1));
      return Number.isFinite(n) ? n / 100 : null;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// tools（mode select）も id を外から渡せる
export function buildWidget2CostHistTools(actions, opts = {}) {
  const o = { ...DEFAULTS, ...opts };

  const sel = el("select", { class: "select", id: o.modeSelectId }, [
    el("option", { value: "count", text: "台数" }),
    el("option", { value: "sales", text: "売上" }),
  ]);

  if (!sel.__bound) {
    sel.addEventListener("change", () => actions?.requestRender?.());
    sel.__bound = true;
  }

  return el("div", { class: "chartTools" }, [sel]);
}

function computeHistogram(rows, mode) {
  const arr = COST_BINS.map(() => 0);

  for (const r of rows) {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    const sales = toNum(r?.sales ?? r?.総売上) ?? 0;
    if (rate == null) continue;

    const idx = pickCostBinIndex(rate);
    if (idx < 0) continue;

    arr[idx] += mode === "sales" ? sales : 1;
  }
  return arr;
}

function buildConfig(hist, mode) {
  return {
    type: "bar",
    data: {
      labels: COST_BINS.map((b) => b.label),
      datasets: [
        {
          label: mode === "sales" ? "売上" : "台数",
          data: hist,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true },
      },
    },
  };
}

/**
 * renderWidget2CostHist(body, state, actions, opts?)
 * - optsで拡大前/拡大後のid衝突を回避
 */
export function renderWidget2CostHist(body, state, actions, opts = {}) {
  if (!body) return;

  const o = { ...DEFAULTS, ...opts };

  // canvas存在を正とする（__builtに依存しない）
  let canvas = body.querySelector("canvas");
  if (!canvas) {
    clear(body);
    body.classList.add("chartBody");
    canvas = el("canvas", { id: o.canvasId });
    body.appendChild(canvas);

    // bodyクリックで拡大（select等は除外）
    body.addEventListener("click", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "select" || tag === "option" || tag === "button") return;
      actions?.onOpenFocus?.("costHist");
    });
  } else {
    // idが違う呼び出しに切り替わった場合の保険
    if (o.canvasId && canvas.id !== o.canvasId) canvas.id = o.canvasId;
  }

  const modeSelect = document.getElementById(o.modeSelectId);
  const mode = modeSelect?.value || "count";
  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  const hist = computeHistogram(rows, mode);
  const config = buildConfig(hist, mode);

  // ✅ charts.js は中身を知らず、id+canvas+configで描くだけ
  renderChart(o.chartKey, canvas, config);
}
