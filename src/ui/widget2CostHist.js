// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget②：原価率 分布（ヒスト）
 * - B案：state.normRows（正規化済み）だけを見る
 *   - 原価率: r.costRate01（0..1）
 *   - 売上:   r.sales
 *   - 景品名: r.prizeName
 *   - ブース: r.boothId
 *   - マシン: r.machineName
 */

// ===== bins（あなたの自然区切り）=====
export const W2_COST_BINS = [
  { label: "0–10%",  min: 0.0,  max: 0.10, incMin: true,  incMax: true },
  { label: "11–25%", min: 0.10, max: 0.25, incMin: false, incMax: true },
  { label: "26–32%", min: 0.25, max: 0.32, incMin: false, incMax: true },
  { label: "33–40%", min: 0.32, max: 0.40, incMin: false, incMax: false },
  { label: "40%〜",   min: 0.40, max: Infinity, incMin: true,  incMax: true },
];

function toNumOr0(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function toNumOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtYen(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("ja-JP").format(Math.round(n));
}
function fmtPct01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function inBin_(rate01, b) {
  if (!b) return false;
  const r = Number(rate01);
  if (!Number.isFinite(r) || r < 0) return false;

  const geMin = b.incMin ? r >= b.min : r > b.min;
  const ltMax = (b.max === Infinity) ? true : (b.incMax ? r <= b.max : r < b.max);
  return geMin && ltMax;
}

function computeHistogram_(normRows, mode) {
  const arr = W2_COST_BINS.map(() => 0);

  for (const r of normRows || []) {
    const rate = toNumOrNull(r?.costRate01);
    if (rate == null) continue;

    const idx = W2_COST_BINS.findIndex((b) => inBin_(rate, b));
    if (idx < 0) continue;

    if (mode === "sales") {
      arr[idx] += toNumOr0(r?.sales);
    } else {
      arr[idx] += 1;
    }
  }

  return arr;
}

function rowsInBin_(normRows, idx) {
  const b = W2_COST_BINS[idx];
  if (!b) return [];
  return (normRows || []).filter((r) => {
    const rate = toNumOrNull(r?.costRate01);
    return rate != null && inBin_(rate, b);
  });
}

function pickPrizeName_(r) {
  const s = String(r?.prizeName ?? "").trim();
  return s;
}

function pickBoothId_(r) {
  return String(r?.boothId ?? "").trim();
}

function pickMachineName_(r) {
  return String(r?.machineName ?? "").trim();
}

// ✅ ブースID自然順（数字を数値として比較）
const BOOTH_COLLATOR = new Intl.Collator("ja-JP", { numeric: true, sensitivity: "base" });

/* =============================================================================
 * mid（拡大前）：tools + canvas + Chart生成/更新
 * ============================================================================= */

let midCostHistChart = null;
let midCostHistCanvas = null;

function canvasReady_(cv) {
  if (!cv) return false;
  const r = cv.getBoundingClientRect?.();
  if (!r) return false;
  return r.height >= 80 && r.width >= 40;
}

function destroyMidChart_() {
  if (midCostHistChart && typeof midCostHistChart.destroy === "function") {
    try { midCostHistChart.destroy(); } catch (e) {}
  }
  midCostHistChart = null;
  midCostHistCanvas = null;
}

function getThemeColors_() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const text = (cs.getPropertyValue("--text") || "#e5e7eb").trim();
  const muted = (cs.getPropertyValue("--muted") || "#94a3b8").trim();
  return { text, muted };
}

function ensureMidChart_(canvas) {
  const Chart = window.Chart;
  if (!Chart) return false;
  if (!canvasReady_(canvas)) return false;

  if (midCostHistCanvas && midCostHistCanvas !== canvas) destroyMidChart_();

  if (!midCostHistChart) {
    const ctx = canvas.getContext?.("2d");
    if (!ctx) return false;

    const { muted } = getThemeColors_();

    midCostHistChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: W2_COST_BINS.map((b) => b.label),
        datasets: [{
          label: "台数",
          data: W2_COST_BINS.map(() => 0),
          borderRadius: 10,
          borderSkipped: false,
          categoryPercentage: 0.88,
          barPercentage: 0.86,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        layout: { padding: { top: 6, right: 10, bottom: 4, left: 6 } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: muted, font: { size: 11, weight: "600" } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148,163,184,.16)" },
            ticks: { color: muted, font: { size: 11, weight: "600" } },
          },
        },
      },
    });

    midCostHistCanvas = canvas;
    requestAnimationFrame(() => midCostHistChart?.resize?.());
  }
  return true;
}

function updateMidChart_(normRows, mode) {
  if (!midCostHistChart) return;
  const hist = computeHistogram_(normRows, mode);

  midCostHistChart.data.datasets[0].data = hist;
  midCostHistChart.data.datasets[0].label = (mode === "sales") ? "売上" : "台数";
  midCostHistChart.options.scales.y.ticks.callback =
    (mode === "sales") ? ((v) => `${fmtYen(v)}円`) : undefined;

  midCostHistChart.update();
}

export function buildWidget2CostHistTools(actions, opts = {}) {
  const id = String(opts.modeSelectId || "costHistMode").trim() || "costHistMode";

  const sel = el("select", { class: "select", id }, [
    el("option", { value: "count", text: "台数" }),
    el("option", { value: "sales", text: "売上" }),
  ]);

  if (!sel.__bound) {
    sel.addEventListener("change", () => actions?.requestRender?.());
    sel.__bound = true;
  }

  return el("div", { class: "chartTools" }, [sel]);
}

export function renderWidget2CostHist(body, state, actions) {
  if (!body) return;

  // ✅ B案：normRows に統一
  const rows = Array.isArray(state?.normRows) ? state.normRows : [];

  if (!body.__w2_built) {
    clear(body);
    body.classList.add("chartBody");

    const cv = el("canvas", { id: "costHistChart" });
    cv.style.width = "100%";
    cv.style.height = "100%";
    cv.style.display = "block";
    body.appendChild(cv);

    body.addEventListener("click", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "select" || tag === "option" || tag === "button") return;
      actions?.onOpenFocus?.("costHist");
    });

    body.__w2_built = true;
  }

  const canvas = body.querySelector?.("#costHistChart");
  const modeSel = document.getElementById("costHistMode");
  const mode = modeSel?.value || "count";

  if (!ensureMidChart_(canvas)) {
    const tries = (body.__w2_tryCount || 0);
    if (tries < 30) {
      body.__w2_tryCount = tries + 1;
      requestAnimationFrame(() => renderWidget2CostHist(body, state, actions));
    }
    return;
  }

  updateMidChart_(rows, mode);
}

/* =============================================================================
 * focus（拡大後）
 * ============================================================================= */

let focusCostHistChart = null;

export function destroyWidget2CostHistFocus() {
  if (focusCostHistChart && typeof focusCostHistChart.destroy === "function") {
    try { focusCostHistChart.destroy(); } catch (e) {}
  }
  focusCostHistChart = null;
}

export function renderWidget2CostHistFocus(mount, state, actions) {
  if (!mount) return;

  const Chart = window.Chart;

  // ✅ B案：normRows に統一
  const rows = Array.isArray(state?.normRows) ? state.normRows : [];

  clear(mount);

  if (!Chart) {
    mount.appendChild(el("div", { class: "focusPlaceholder", text: "Chart.js が未ロードです" }));
    return;
  }

  const { muted } = getThemeColors_();

  // --- 上部ツール ---
  const modeSel = el("select", { class: "select", id: "w2FocusMode" }, [
    el("option", { value: "count", text: "台数（棒の集計）" }),
    el("option", { value: "sales", text: "売上（棒の集計）" }),
  ]);

  const sortKeySel = el("select", { class: "select", id: "w2CardSortKey" }, [
    el("option", { value: "booth", text: "カード：ブースID（自然順）" }),
    el("option", { value: "sales", text: "カード：売上" }),
    el("option", { value: "rate", text: "カード：原価率" }),
  ]);

  const sortDirSel = el("select", { class: "select", id: "w2CardSortDir" }, [
    el("option", { value: "asc", text: "昇順" }),
    el("option", { value: "desc", text: "降順" }),
  ]);

  sortKeySel.value = "booth";
  sortDirSel.value = "asc";

  const hint = el("div", { class: "w2HintPill", text: "棒クリックでカード表示" });

  const nav = el("div", { class: "focusNav" }, [
    el("div", { class: "focusCrumb", text: "原価率 分布（拡大）" }),
    el("div", { class: "w2ToolsRow" }, [modeSel, sortKeySel, sortDirSel, hint]),
  ]);

  const panel = el("div", { class: "focusPanel w2Focus" }, [
    el("div", { class: "focusPanelTop" }, [
      el("div", { class: "focusPanelTitle", text: "原価率 分布" }),
      el("div", { class: "focusPanelNote", text: "※台数/売上＝棒の集計。カード並び替えは別セレクト。" }),
    ]),
    nav,
  ]);

  // --- 左：チャート ---
  const chartWrap = el("div", { class: "w2ChartWrap" });
  const canvas = el("canvas", { id: "w2FocusCostHistChart" });
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  chartWrap.appendChild(canvas);

  // --- 右：カード一覧 ---
  const listTitle = el("div", { class: "w2ListTitle", text: "選択中：—" });
  const list = el("div", { class: "w2List" });

  const grid = el("div", { class: "focusDonutGrid w2Grid" }, [
    el("div", { class: "w2Left" }, [chartWrap]),
    el("div", { class: "w2Right" }, [listTitle, list]),
  ]);

  panel.appendChild(grid);
  mount.appendChild(panel);

  // --- sorting ---
  let lastBinIndex = null;

  function sortPicked_(arr) {
    const key = sortKeySel.value || "booth";
    const dir = sortDirSel.value || "asc";
    const sign = dir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      if (key === "booth") {
        const aa = String(pickBoothId_(a) || "");
        const bb = String(pickBoothId_(b) || "");
        return BOOTH_COLLATOR.compare(aa, bb) * sign;
      }

      if (key === "rate") {
        const ra = toNumOrNull(a?.costRate01);
        const rb = toNumOrNull(b?.costRate01);
        const na = ra == null ? (dir === "asc" ? Infinity : -Infinity) : ra;
        const nb = rb == null ? (dir === "asc" ? Infinity : -Infinity) : rb;
        return (na - nb) * sign;
      }

      const sa = toNumOrNull(a?.sales);
      const sb = toNumOrNull(b?.sales);
      const na = sa == null ? (dir === "asc" ? Infinity : -Infinity) : sa;
      const nb = sb == null ? (dir === "asc" ? Infinity : -Infinity) : sb;
      return (na - nb) * sign;
    });
  }

  function renderList(idx) {
    lastBinIndex = idx;

    const bin = W2_COST_BINS[idx];
    if (!bin) return;

    const picked = rowsInBin_(rows, idx);
    sortPicked_(picked);

    listTitle.textContent = `選択中：${bin.label}（${picked.length}件）`;

    clear(list);
    if (picked.length === 0) {
      list.appendChild(el("div", { class: "w2Empty", text: "該当アイテムがありません" }));
      return;
    }

    const MAX = 120;
    const shown = picked.slice(0, MAX);

    shown.forEach((r) => {
      const prize = pickPrizeName_(r) || "（景品名なし）";
      const booth = String(pickBoothId_(r) || "（ブースIDなし）");
      const machine = String(pickMachineName_(r) || "");
      const sales = toNumOr0(r?.sales);
      const rate = toNumOrNull(r?.costRate01);

      const showMachine = machine && machine.trim() && machine.trim() !== booth.trim();

      list.appendChild(
        el("div", { class: "w2Card" }, [
          el("div", { class: "w2CardTitle", text: prize }),
          el("div", { class: "w2CardSub", text: booth }),
          showMachine
            ? el("div", { class: "w2CardSub2", text: machine })
            : el("div", { class: "w2CardSub2 is-hidden", text: "" }),
          el("div", { class: "w2CardMetrics" }, [
            el("span", { class: "w2Chip", text: `売上: ${fmtYen(sales)}円` }),
            el("span", { class: "w2Chip", text: `原価率: ${rate == null ? "—" : fmtPct01(rate)}` }),
          ]),
        ])
      );
    });

    if (picked.length > MAX) {
      list.appendChild(el("div", { class: "w2Hint", text: `※表示は上位${MAX}件まで（全${picked.length}件）` }));
    }
  }

  function applyChart() {
    const mode = modeSel.value || "count";
    const hist = computeHistogram_(rows, mode);

    destroyWidget2CostHistFocus();

    const ctx = canvas.getContext("2d");
    focusCostHistChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: W2_COST_BINS.map((b) => b.label),
        datasets: [{
          label: mode === "sales" ? "売上" : "台数",
          data: hist,
          borderRadius: 12,
          borderSkipped: false,
          categoryPercentage: 0.86,
          barPercentage: 0.84,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        layout: { padding: { top: 10, right: 14, bottom: 10, left: 10 } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: muted, font: { size: 12, weight: "700" } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148,163,184,.16)" },
            ticks: {
              color: muted,
              font: { size: 12, weight: "700" },
              callback: mode === "sales" ? ((v) => `${fmtYen(v)}円`) : undefined,
            },
          },
        },
        onClick: (evt) => {
          if (!focusCostHistChart) return;
          const pts = focusCostHistChart.getElementsAtEventForMode(
            evt, "nearest", { intersect: true }, true
          );
          if (!pts || pts.length === 0) return;
          renderList(pts[0].index);
        },
      },
    });

    listTitle.textContent = "選択中：—";
    clear(list);
    list.appendChild(el("div", { class: "w2Hint", text: "棒をクリックすると一覧が出ます" }));
    lastBinIndex = null;

    requestAnimationFrame(() => focusCostHistChart?.resize?.());
  }

  function refreshListIfAny() {
    if (lastBinIndex == null) return;
    renderList(lastBinIndex);
  }

  modeSel.addEventListener("change", applyChart);
  sortKeySel.addEventListener("change", refreshListIfAny);
  sortDirSel.addEventListener("change", refreshListIfAny);

  applyChart();
}
