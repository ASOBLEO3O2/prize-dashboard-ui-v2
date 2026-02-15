// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget②：原価率 分布（ヒスト）
 *
 * 方針A（責務分離）：
 * - 拡大前（mid）：このファイルが「器」+「Chart生成/更新」まで担当（＝初期描画が出る）
 *   └ app.js / charts.js から呼ばない（枠に干渉させない）
 *
 * - 拡大後（focus）：このファイルが「Chart生成 + 棒クリックでカード表示」まで担当
 *   └ カード並び替え（ブースID自然順 / 売上 / 原価率）もここで完結
 *   └ レイアウトは常に左右2カラム固定（縦長でもカードが見える）
 */

// ===== bins（あなたの自然区切り）=====
export const W2_COST_BINS = [
  { label: "0–10%",  min: 0.0,  max: 0.10, incMin: true,  incMax: true },
  { label: "11–25%", min: 0.10, max: 0.25, incMin: false, incMax: true },
  { label: "26–32%", min: 0.25, max: 0.32, incMin: false, incMax: true },
  { label: "33–40%", min: 0.32, max: 0.40, incMin: false, incMax: false },
  { label: "40%〜",   min: 0.40, max: Infinity, incMin: true,  incMax: true },
];

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

function computeHistogram_(rows, mode) {
  const arr = W2_COST_BINS.map(() => 0);

  for (const r of rows) {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    const sales = toNum(r?.sales ?? r?.総売上) ?? 0;
    if (rate == null) continue;

    const idx = W2_COST_BINS.findIndex((b) => inBin_(rate, b));
    if (idx < 0) continue;

    arr[idx] += mode === "sales" ? sales : 1;
  }
  return arr;
}

function rowsInBin_(rows, idx) {
  const b = W2_COST_BINS[idx];
  if (!b) return [];
  return rows.filter((r) => {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    return rate != null && inBin_(rate, b);
  });
}

function pickPrizeName_(r) {
  if (!r) return "";

  const direct =
    r.prize_name ??
    r.prizeName ??
    r.prize ??
    r.item_name ??
    r.itemName ??
    r.name ??
    r.title ??
    r.景品名 ??
    r["景品名"] ??
    r.景品 ??
    r["景品"] ??
    "";

  const s1 = String(direct || "").trim();
  if (s1) return s1;

  // 取りこぼし救済（キー揺れ）
  const norm = (k) =>
    String(k || "")
      .trim()
      .toLowerCase()
      .replace(/[ \t\r\n\u3000]/g, "")
      .replace(/[・_\-]/g, "");

  const want = new Set(["景品名", "景品", "prizename", "prize", "itemname", "item", "name", "title"]);
  for (const [k, v] of Object.entries(r)) {
    if (!want.has(norm(k))) continue;
    const sv = String(v || "").trim();
    if (sv) return sv;
  }
  return "";
}

function pickBoothId_(r) {
  return (
    r?.booth_id ??
    r?.["ブースID"] ??
    r?.boothId ??
    r?.machine_key ??
    r?.machine_ref ??
    ""
  );
}

function pickMachineName_(r) {
  return (
    r?.machine_name ??
    r?.machine_ref ??
    r?.対応マシン名 ??
    r?.["対応マシン名"] ??
    ""
  );
}

// ✅ ブースID自然順（数字を数値として比較）
const BOOTH_COLLATOR = new Intl.Collator("ja-JP", { numeric: true, sensitivity: "base" });

/* =============================================================================
 * mid（拡大前）：tools + canvas + Chart生成/更新（← 初期描画なし対策の本丸）
 * ============================================================================= */

let midCostHistChart = null;
let midCostHistCanvas = null;

function canvasReady_(cv) {
  if (!cv) return false;
  const r = cv.getBoundingClientRect?.();
  if (!r) return false;
  // 高さが無いとChart.jsが作れないケースがある
  return r.height >= 80 && r.width >= 40;
}

function destroyMidChart_() {
  if (midCostHistChart && typeof midCostHistChart.destroy === "function") {
    try { midCostHistChart.destroy(); } catch (e) {}
  }
  midCostHistChart = null;
  midCostHistCanvas = null;
}

function ensureMidChart_(canvas) {
  const Chart = window.Chart;
  if (!Chart) return false;
  if (!canvasReady_(canvas)) return false;

  // canvas が差し替わったら破棄して作り直す
  if (midCostHistCanvas && midCostHistCanvas !== canvas) {
    destroyMidChart_();
  }

  if (!midCostHistChart) {
    const ctx = canvas.getContext?.("2d");
    if (!ctx) return false;

    midCostHistChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: W2_COST_BINS.map((b) => b.label),
        datasets: [{ label: "台数", data: W2_COST_BINS.map(() => 0) }],
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
    });

    midCostHistCanvas = canvas;
    requestAnimationFrame(() => midCostHistChart?.resize?.());
  }

  return true;
}

function updateMidChart_(rows, mode) {
  if (!midCostHistChart) return;
  const hist = computeHistogram_(rows, mode);

  midCostHistChart.data.datasets[0].data = hist;
  midCostHistChart.data.datasets[0].label = (mode === "sales") ? "売上" : "台数";
  midCostHistChart.update();
}

export function buildWidget2CostHistTools(actions, opts = {}) {
  const id = String(opts.modeSelectId || "costHistMode").trim() || "costHistMode";

  const sel = el("select", { class: "select", id }, [
    el("option", { value: "count", text: "台数" }),
    el("option", { value: "sales", text: "売上" }),
  ]);

  // mode変更時：ウィジェット自身が再描画（kpiMid->renderWidget2CostHistが再実行される）
  if (!sel.__bound) {
    sel.addEventListener("change", () => actions?.requestRender?.());
    sel.__bound = true;
  }

  return el("div", { class: "chartTools" }, [sel]);
}

export function renderWidget2CostHist(body, state, actions) {
  if (!body) return;

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

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

  // 初期描画なし対策：サイズが付くまで数フレームだけ待って作る
  if (!ensureMidChart_(canvas)) {
    const tries = (body.__w2_tryCount || 0);
    if (tries < 30) {
      body.__w2_tryCount = tries + 1;
      requestAnimationFrame(() => renderWidget2CostHist(body, state, actions));
    }
    return;
  }

  // 生成できたら更新
  updateMidChart_(rows, mode);
}

/* =============================================================================
 * focus（拡大後）：Chart + 棒クリックでカード + 並び替え + 左右固定
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
  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  clear(mount);

  if (!Chart) {
    mount.appendChild(el("div", { class: "focusPlaceholder", text: "Chart.js が未ロードです" }));
    return;
  }

  // --- 上部ツール ---
  // ※ modeSel は「棒の集計（台数/売上）」であり、カード並び替えとは別
  const modeSel = el("select", { class: "select", id: "w2FocusMode" }, [
    el("option", { value: "count", text: "台数（棒の集計）" }),
    el("option", { value: "sales", text: "売上（棒の集計）" }),
  ]);

  // ✅ カード並び替え
  const sortKeySel = el("select", { class: "select", id: "w2CardSortKey" }, [
    el("option", { value: "booth", text: "カード：ブースID（自然順）" }),
    el("option", { value: "sales", text: "カード：売上" }),
    el("option", { value: "rate", text: "カード：原価率" }),
  ]);

  const sortDirSel = el("select", { class: "select", id: "w2CardSortDir" }, [
    el("option", { value: "asc", text: "昇順" }),
    el("option", { value: "desc", text: "降順" }),
  ]);

  // 初期：ブースID自然順（昇順）
  sortKeySel.value = "booth";
  sortDirSel.value = "asc";

  const hint = el("div", { class: "focusHint", text: "棒クリックでカード表示（並び替えは右）" });

  const nav = el("div", { class: "focusNav" }, [
    el("div", { class: "focusCrumb", text: "原価率 分布（拡大）" }),
    el("div", { style: "display:flex; gap:10px; align-items:center; flex-wrap:wrap;" }, [
      modeSel, sortKeySel, sortDirSel, hint,
    ]),
  ]);

  const panel = el("div", { class: "focusPanel" }, [
    el("div", { class: "focusPanelTop" }, [
      el("div", { class: "focusPanelTitle", text: "原価率 分布" }),
      el("div", { class: "focusPanelNote", text: "※台数/売上＝棒の集計。カード並び替えは別セレクト。" }),
    ]),
    nav,
  ]);

  // --- 左：チャート ---
  const chartWrap = el("div", { class: "focusDonutWrap" });
  const canvas = el("canvas", { id: "w2FocusCostHistChart" });
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  chartWrap.appendChild(canvas);

  // --- 右：カード一覧 ---
  const listTitle = el("div", { class: "focusCrumb", text: "選択中：—" });
  const list = el("div", { class: "focusLegend" });
  list.style.overflow = "auto";

  // ✅ 常に左右2カラム固定（縦長でもカードが見える）
  const grid = el(
    "div",
    {
      class: "focusDonutGrid",
      style: [
        "display:grid",
        "grid-template-columns:minmax(0, 1.15fr) minmax(0, 0.85fr)",
        "gap:14px",
        "align-items:stretch",
        "min-width:0",
        "height:calc(100vh - 220px)",
        "min-height:420px",
      ].join(";"),
    },
    [
      el("div", { style: "min-width:0; min-height:0; display:flex;" }, [
        (() => {
          chartWrap.style.height = "100%";
          chartWrap.style.minHeight = "0";
          chartWrap.style.overflow = "hidden";
          return chartWrap;
        })(),
      ]),
      el("div", { style: "min-width:0; min-height:0; display:flex; flex-direction:column; gap:10px;" }, [
        listTitle,
        (() => {
          list.style.flex = "1";
          list.style.minHeight = "0";
          return list;
        })(),
      ]),
    ]
  );

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
        const ra = toNum(a?.cost_rate ?? a?.原価率);
        const rb = toNum(b?.cost_rate ?? b?.原価率);
        const na = ra == null ? (dir === "asc" ? Infinity : -Infinity) : ra;
        const nb = rb == null ? (dir === "asc" ? Infinity : -Infinity) : rb;
        return (na - nb) * sign;
      }

      // sales
      const sa = toNum(a?.sales ?? a?.総売上);
      const sb = toNum(b?.sales ?? b?.総売上);
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
      list.appendChild(el("div", { class: "focusPlaceholder", text: "該当アイテムがありません" }));
      return;
    }

    const MAX = 120;
    const shown = picked.slice(0, MAX);

    shown.forEach((r) => {
      const prize = pickPrizeName_(r) || "（景品名なし）";
      const booth = String(pickBoothId_(r) || "（ブースIDなし）");
      const machine = String(pickMachineName_(r) || "");
      const sales = toNum(r?.sales ?? r?.総売上) ?? 0;
      const rate = toNum(r?.cost_rate ?? r?.原価率);

      // ✅ 「ブースIDが2行」対策：machine が booth と同じなら表示しない
      const showMachine = machine && machine.trim() && machine.trim() !== booth.trim();

      list.appendChild(
        el("div", { class: "focusLegendItem", style: "display:block; text-align:left;" }, [
          el("div", { style: "font-weight:900; margin-bottom:4px;", text: prize }),
          el("div", { style: "opacity:.95; margin-bottom:4px;", text: booth }),
          showMachine
            ? el("div", { style: "opacity:.85; margin-bottom:4px;", text: machine })
            : el("div", { style: "display:none;" }),
          el("div", { style: "display:flex; gap:12px; flex-wrap:wrap; opacity:.95;" }, [
            el("span", { text: `売上: ${fmtYen(sales)}円` }),
            el("span", { text: `原価率: ${rate == null ? "—" : fmtPct01(rate)}` }),
          ]),
        ])
      );
    });

    if (picked.length > MAX) {
      list.appendChild(
        el("div", { class: "focusHint", text: `※表示は上位${MAX}件まで（全${picked.length}件）` })
      );
    }
  }

  function applyChart() {
    const mode = modeSel.value || "count";
    const hist = computeHistogram_(rows, mode);

    // 既存破棄
    destroyWidget2CostHistFocus();

    const ctx = canvas.getContext("2d");
    focusCostHistChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: W2_COST_BINS.map((b) => b.label),
        datasets: [{ label: mode === "sales" ? "売上" : "台数", data: hist }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true },
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

    // 初期状態
    listTitle.textContent = "選択中：—";
    clear(list);
    list.appendChild(el("div", { class: "focusHint", text: "棒をクリックすると一覧が出ます" }));
    lastBinIndex = null;

    // レイアウト確定後に resize
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
