// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";
import { renderChart } from "./charts.js";

/**
 * Widget②：原価率 分布（ヒスト）
 * ✅ 中身（仕様・集計・ビン・クリック→カード）はここに閉じる
 * ✅ focusOverlay は枠だけにする
 */

const COST_BINS = [
  { label: "0–10%" },
  { label: "11–25%" },
  { label: "26–32%" },
  { label: "33–40%" },
  { label: "40%〜" },
];

function pickCostBinIndex_(rate01) {
  const r = Number(rate01);
  if (!Number.isFinite(r) || r < 0) return -1;

  if (r <= 0.10) return 0;
  if (r <= 0.25) return 1;
  if (r <= 0.32) return 2;
  if (r < 0.40) return 3;
  return 4;
}

function inBin_(rate01, idx) {
  const r = Number(rate01);
  if (!Number.isFinite(r) || r < 0) return false;

  if (idx === 0) return r <= 0.10;
  if (idx === 1) return r > 0.10 && r <= 0.25;
  if (idx === 2) return r > 0.25 && r <= 0.32;
  if (idx === 3) return r > 0.32 && r < 0.40;
  if (idx === 4) return r >= 0.40;
  return false;
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

function fmtYen(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("ja-JP").format(Math.round(n));
}
function fmtPct01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function computeHistogram_(rows, mode) {
  const arr = COST_BINS.map(() => 0);

  for (const r of rows) {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    const sales = toNum(r?.sales ?? r?.総売上) ?? 0;
    if (rate == null) continue;

    const idx = pickCostBinIndex_(rate);
    if (idx < 0) continue;

    arr[idx] += mode === "sales" ? sales : 1;
  }
  return arr;
}

function rowsInBin_(rows, idx) {
  return rows.filter((r) => {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    return rate != null && inBin_(rate, idx);
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

  const norm = (k) =>
    String(k || "")
      .trim()
      .toLowerCase()
      .replace(/[ \t\r\n\u3000]/g, "")
      .replace(/[・_\-]/g, "");

  const want = new Set([
    "景品名",
    "景品",
    "prizename",
    "prize",
    "itemname",
    "item",
    "name",
    "title",
  ]);

  for (const [k, v] of Object.entries(r)) {
    const nk = norm(k);
    if (!want.has(nk)) continue;
    const sv = String(v || "").trim();
    if (sv) return sv;
  }
  return "";
}

function pickMachineName_(r) {
  return (
    r?.machine_name ??
    r?.machine_ref ??
    r?.対応マシン名 ??
    r?.["対応マシン名"] ??
    r?.booth_id ??
    r?.["ブースID"] ??
    ""
  );
}

function buildBarConfig_(hist, mode) {
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
 * tools生成：selectは「呼び出し側が指定したID」を使える
 */
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

/**
 * 通常（mid）：ヒストだけ描く
 */
export function renderWidget2CostHist(body, state, actions, opts = {}) {
  if (!body) return;

  const chartKey = String(opts.chartKey || "w2-costHist").trim() || "w2-costHist";
  const canvasId = String(opts.canvasId || "costHistChart").trim() || "costHistChart";
  const modeSelectId = String(opts.modeSelectId || "costHistMode").trim() || "costHistMode";

  let canvas = body.querySelector("canvas");
  if (!canvas) {
    clear(body);
    body.classList.add("chartBody");
    canvas = el("canvas", { id: canvasId });
    body.appendChild(canvas);

    // bodyクリックで拡大（select操作等は除外）
    body.addEventListener("click", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "select" || tag === "option" || tag === "button") return;
      actions?.onOpenFocus?.("costHist");
    });
  } else {
    if (canvasId && canvas.id !== canvasId) canvas.id = canvasId;
  }

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];
  const modeSel = document.getElementById(modeSelectId);
  const mode = modeSel?.value || "count";

  const hist = computeHistogram_(rows, mode);
  const config = buildBarConfig_(hist, mode);
  renderChart(chartKey, canvas, config);
}

/**
 * 拡大（focus）：棒クリックでカード一覧を出す（ここに集約）
 * - focusOverlay はこれを呼ぶだけ
 */
export function renderWidget2CostHistFocus(mount, state, actions) {
  if (!mount) return;

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  // UI：左＝チャート、右＝カード一覧
  clear(mount);

  const topBar = el("div", { class: "focusNav" }, []);
  const modeSel = el("select", { class: "select", id: "w2FocusCostHistMode" }, [
    el("option", { value: "count", text: "台数" }),
    el("option", { value: "sales", text: "売上" }),
  ]);

  const hint = el("div", { class: "focusHint", text: "棒をクリックすると該当アイテムを表示します" });

  topBar.appendChild(el("div", { class: "focusCrumb", text: "原価率 分布（拡大）" }));
  topBar.appendChild(el("div", { style: "display:flex; gap:10px; align-items:center;" }, [modeSel, hint]));

  const panel = el("div", { class: "focusPanel" }, [
    el("div", { class: "focusPanelTop" }, [
      el("div", { class: "focusPanelTitle", text: "原価率 分布" }),
      el("div", { class: "focusPanelNote", text: "棒クリックでアイテム一覧" }),
    ]),
    topBar,
  ]);

  const chartWrap = el("div", { class: "focusDonutWrap" });
  chartWrap.style.height = "360px";
  chartWrap.style.minHeight = "360px";

  const canvas = el("canvas", { id: "w2FocusCostHistChart" });
  chartWrap.appendChild(canvas);

  const listTitle = el("div", { class: "focusCrumb", text: "選択中：—" });
  const list = el("div", { class: "focusLegend" });

  // ✅ 確実にスクロールさせる（CSS依存を断つ）
  list.style.overflow = "auto";
  list.style.maxHeight = "360px";
  list.style.minHeight = "360px";

  const grid = el("div", { class: "focusDonutGrid" }, [
    el("div", { style: "min-width:0;" }, [chartWrap]),
    el("div", { style: "min-width:0; display:flex; flex-direction:column; gap:10px;" }, [
      listTitle,
      list,
    ]),
  ]);

  panel.appendChild(grid);
  mount.appendChild(panel);

  const renderList = (idx) => {
    const bin = COST_BINS[idx];
    if (!bin) return;

    const picked = rowsInBin_(rows, idx);

    picked.sort((a, b) => {
      const sa = toNum(a?.sales ?? a?.総売上) ?? 0;
      const sb = toNum(b?.sales ?? b?.総売上) ?? 0;
      return sb - sa;
    });

    listTitle.textContent = `選択中：${bin.label}（${picked.length}件）`;

    clear(list);
    if (picked.length === 0) {
      list.appendChild(el("div", { class: "focusPlaceholder", text: "該当アイテムがありません" }));
      return;
    }

    const MAX = 80;
    const shown = picked.slice(0, MAX);

    shown.forEach((r) => {
      const prize = pickPrizeName_(r) || "（景品名なし）";
      const machine = pickMachineName_(r) || "（マシン名なし）";
      const sales = toNum(r?.sales ?? r?.総売上) ?? 0;
      const rate = toNum(r?.cost_rate ?? r?.原価率);

      list.appendChild(
        el("div", { class: "focusLegendItem", style: "display:block; text-align:left;" }, [
          el("div", { style: "font-weight:900; margin-bottom:4px;", text: prize }),
          el("div", { style: "opacity:.9; margin-bottom:4px;", text: machine }),
          el("div", { style: "display:flex; gap:12px; flex-wrap:wrap; opacity:.95;" }, [
            el("span", { text: `売上: ${fmtYen(sales)}円` }),
            el("span", { text: `原価率: ${rate == null ? "—" : fmtPct01(rate)}` }),
          ]),
        ])
      );
    });

    if (picked.length > MAX) {
      list.appendChild(el("div", { class: "focusHint", text: `※表示は上位${MAX}件まで（全${picked.length}件）` }));
    }
  };

  const buildConfigForFocus = () => {
    const mode = modeSel.value || "count";
    const hist = computeHistogram_(rows, mode);

    // onClickだけfocus用に足す（中身はここ）
    const config = buildBarConfig_(hist, mode);
    config.options = {
      ...(config.options || {}),
      onClick: (evt) => {
        const Chart = window.Chart;
        if (!Chart) return;

        // ChartHost上のインスタンス参照はできないので、
        // Chart.jsのgetChartでcanvasから取得する（v3/v4対応）
        const ch =
          typeof Chart.getChart === "function" ? Chart.getChart(canvas) : null;
        if (!ch) return;

        const pts = ch.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true);
        if (!pts || pts.length === 0) return;

        const idx = pts[0].index;
        renderList(idx);
      },
    };

    return config;
  };

  // 初期描画
  const apply = () => {
    const config = buildConfigForFocus();
    renderChart("w2-costHist-focus", canvas, config);
    requestAnimationFrame(() => {
      // ChartHost側でresizeしてるが、focusは大きいので保険
      const Chart = window.Chart;
      const ch = typeof Chart?.getChart === "function" ? Chart.getChart(canvas) : null;
      ch?.resize?.();
    });

    // 未選択
    listTitle.textContent = "選択中：—";
    clear(list);
    list.appendChild(el("div", { class: "focusHint", text: "棒をクリックすると一覧が出ます" }));
  };

  modeSel.addEventListener("change", apply);
  apply();
}
