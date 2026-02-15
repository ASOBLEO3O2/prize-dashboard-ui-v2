// src/ui/focusOverlay.js
console.log("FOCUS_OVERLAY_BUILD 2026-01-31 r3");

import { el, clear } from "../utils/dom.js";
import { renderDonut } from "../charts/donut.js?v=20260131";
import { GENRES } from "../constants.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

/**
 * modalEl 配下の Chart.js を破棄（DOM clear だけでは Chart が残るため）
 * - Chart.getChart(canvas) が使える場合はそれを優先
 * - だめなら Chart.instances から拾う（互換）
 */
function destroyChartsUnder_(rootEl) {
  const Chart = window.Chart;
  if (!Chart || !rootEl) return;

  const canvases = rootEl.querySelectorAll?.("canvas");
  if (!canvases || canvases.length === 0) return;

  // v3/v4: Chart.getChart
  const getChart =
    typeof Chart.getChart === "function" ? (c) => Chart.getChart(c) : null;

  // fallback: Chart.instances（配列/Map/オブジェクト）
  const listInstances = () => {
    const inst = Chart.instances;
    if (!inst) return [];
    if (Array.isArray(inst)) return inst.filter(Boolean);
    if (inst instanceof Map) return Array.from(inst.values()).filter(Boolean);
    if (typeof inst === "object") return Object.values(inst).filter(Boolean);
    return [];
  };

  const all = getChart ? null : listInstances();

  canvases.forEach((cv) => {
    try {
      const ch = getChart ? getChart(cv) : all.find((x) => x?.canvas === cv);
      if (ch && typeof ch.destroy === "function") ch.destroy();
    } catch (e) {
      // 無視
    }
  });
}

// ===== Widget2（costHist）拡大：別ID・別Chart + 棒クリックでカード =====
let focusCostHistChart = null;

/**
 * ✅ 拡大前（Widget②）と同じ「自然レンジ」に揃える
 * ① 0–10%（<=10）
 * ② 11–25%（>10 && <=25）
 * ③ 26–32%（>25 && <=32）
 * ④ 33–40%（>32 && <40）
 * ⑤ 40%〜（>=40）
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
  if (r < 0.40) return 3; // 40未満
  return 4; // 40以上
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

function computeCostHistogram(rows, mode) {
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

function rowsInBin_(rows, binIndex) {
  return rows.filter((r) => {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    return rate != null && inBin_(rate, binIndex);
  });
}

function pickPrizeName_(r) {
  return (
    r?.prize_name ??
    r?.prize ??
    r?.景品名 ??
    r?.["景品名"] ??
    r?.景品 ??
    r?.["景品"] ??
    ""
  );
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

function renderCostHistFocus_(mount, state, actions) {
  const Chart = window.Chart;
  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  if (!Chart) {
    mount.appendChild(
      el("div", { class: "focusPlaceholder", text: "Chart.js が未ロードです" })
    );
    return;
  }

  // UI：上＝チャート、下＝アイテム
  const topBar = el("div", { class: "focusNav" }, []);
  const modeSel = el("select", { class: "select", id: "focusCostHistMode" }, [
    el("option", { value: "count", text: "台数" }),
    el("option", { value: "sales", text: "売上" }),
  ]);

  const hint = el("div", {
    class: "focusHint",
    text: "棒をクリックすると該当アイテムを表示します",
  });

  topBar.appendChild(el("div", { class: "focusCrumb", text: "原価率 分布（拡大）" }));
  topBar.appendChild(
    el("div", { style: "display:flex; gap:10px; align-items:center;" }, [
      modeSel,
      hint,
    ])
  );

  const panel = el("div", { class: "focusPanel" }, [
    el("div", { class: "focusPanelTop" }, [
      el("div", { class: "focusPanelTitle", text: "原価率 分布" }),
      el("div", { class: "focusPanelNote", text: "棒クリックでアイテム一覧" }),
    ]),
    topBar,
  ]);

  const chartWrap = el("div", { class: "focusDonutWrap" }); // 既存の大きい描画領域クラスを流用
  chartWrap.style.height = "360px"; // 念のため高さ確保（Chart.js 初期化安定）
  chartWrap.style.minHeight = "360px";

  const canvas = el("canvas", { id: "focusCostHistChart" });
  chartWrap.appendChild(canvas);

  const listTitle = el("div", { class: "focusCrumb", text: "選択中：—" });
  const list = el("div", { class: "focusLegend" }); // 既存のスクロール領域っぽい見た目を流用

  const listWrap = el("div", { class: "focusDonutGrid" }, [
    el("div", { style: "min-width:0;" }, [chartWrap]),
    el("div", { style: "min-width:0; display:flex; flex-direction:column; gap:10px;" }, [
      listTitle,
      list,
    ]),
  ]);

  panel.appendChild(listWrap);
  mount.appendChild(panel);

  // chart を作る（毎回 open 時に destroy 済みの前提）
  const ctx = canvas.getContext("2d");
  focusCostHistChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: COST_BINS.map((b) => b.label),
      datasets: [{ label: "台数", data: COST_BINS.map(() => 0) }],
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
          evt,
          "nearest",
          { intersect: true },
          true
        );
        if (!pts || pts.length === 0) return;

        const idx = pts[0].index;
        const bin = COST_BINS[idx];
        if (!bin) return;

        const picked = rowsInBin_(rows, idx);

        // ソート：売上降順
        picked.sort((a, b) => {
          const sa = toNum(a?.sales ?? a?.総売上) ?? 0;
          const sb = toNum(b?.sales ?? b?.総売上) ?? 0;
          return sb - sa;
        });

        // タイトル更新
        listTitle.textContent = `選択中：${bin.label}（${picked.length}件）`;

        // リスト描画
        clear(list);
        if (picked.length === 0) {
          list.appendChild(
            el("div", { class: "focusPlaceholder", text: "該当アイテムがありません" })
          );
          return;
        }

        // 上限（重すぎ防止）
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
          list.appendChild(
            el("div", {
              class: "focusHint",
              text: `※表示は上位${MAX}件まで（全${picked.length}件）`,
            })
          );
        }
      },
    },
  });

  // 初回データ反映
  const apply = () => {
    if (!focusCostHistChart) return;
    const mode = modeSel.value || "count";
    const hist = computeCostHistogram(rows, mode);

    focusCostHistChart.data.datasets[0].data = hist;
    focusCostHistChart.data.datasets[0].label = mode === "sales" ? "売上" : "台数";
    focusCostHistChart.update();

    // 初期表示は未選択状態
    listTitle.textContent = "選択中：—";
    clear(list);
    list.appendChild(el("div", { class: "focusHint", text: "棒をクリックすると一覧が出ます" }));
  };

  modeSel.addEventListener("change", apply);
  requestAnimationFrame(() => focusCostHistChart?.resize());
  apply();
}

export function renderFocusOverlay(overlayEl, modalEl, state, actions) {
  const focus = state?.focus || { open: false };
  if (!overlayEl || !modalEl) return;

  // close
  if (!focus.open) {
    overlayEl.classList.remove("open");

    // ✅ ここが重要：DOMを消す前に Chart を必ず破棄する
    destroyChartsUnder_(modalEl);
    focusCostHistChart = null;

    clear(modalEl);
    document.body.style.overflow = "";

    // 念のためクリックハンドラも解除（積み上がり防止）
    overlayEl.onclick = null;
    return;
  }

  // open
  overlayEl.classList.add("open");

  // open時に一旦掃除（前回の残骸がある場合の保険）
  destroyChartsUnder_(modalEl);
  focusCostHistChart = null;
  clear(modalEl);

  document.body.style.overflow = "hidden";

  overlayEl.onclick = (e) => {
    if (e.target === overlayEl) actions.onCloseFocus?.();
  };

  const header = el("div", { class: "focusHeader" }, [
    el("button", {
      class: "btn ghost",
      text: "← 戻る",
      onClick: () => actions.onCloseFocus?.(),
    }),
    el("div", { class: "focusTitle", text: focus.title || "詳細" }),
    el("button", {
      class: "btn ghost",
      text: "×",
      onClick: () => actions.onCloseFocus?.(),
    }),
  ]);

  const body = el("div", { class: "focusBody" });
  modalEl.appendChild(header);
  modalEl.appendChild(body);

  // ✅ widget1 expanded
  if (focus.kind === "shareDonut") {
    renderWidget1ShareDonut(body, state, actions, { mode: "expanded" });
    return;
  }

  // ✅ existing donuts
  if (focus.kind === "salesDonut" || focus.kind === "machineDonut") {
    renderDonutFocus_(body, state, focus, actions);
    return;
  }

  // ✅ costHist expanded（拡大後だけカード表示）
  if (focus.kind === "costHist") {
    renderCostHistFocus_(body, state, actions);
    return;
  }

  body.appendChild(el("div", { class: "focusPlaceholder", text: "（拡大表示：準備中）" }));
}

function renderDonutFocus_(mount, state, focus, actions) {
  const top = buildGenreTopView_(state);
  const parentKey = focus.parentKey || null;

  const view = parentKey ? buildGenreChildView_(state, parentKey) : top;

  const title = focus.kind === "salesDonut" ? "売上構成比" : "マシン構成比";
  const note = parentKey ? `内訳：${view.parentLabel}` : "ジャンル別（%）";

  const values = view.items.map((x) => ({
    key: x.key,
    label: x.label,
    value: focus.kind === "salesDonut" ? x.salesShare : x.machineShare,
    color: x.color || null,
  }));

  const nav = el("div", { class: "focusNav" }, []);
  if (parentKey) {
    nav.appendChild(el("div", { class: "focusCrumb", text: `内訳：${view.parentLabel}` }));
    nav.appendChild(
      el("button", {
        class: "btn",
        text: "上層に戻る",
        onClick: () => actions.onSetFocusParentKey?.(null),
      })
    );
  } else {
    nav.appendChild(el("div", { class: "focusCrumb", text: "ジャンル（上層）" }));
    nav.appendChild(el("div", { class: "focusHint", text: "セグメントをタップで内訳へ" }));
  }

  const panel = el("div", { class: "focusPanel" }, [
    el("div", { class: "focusPanelTop" }, [
      el("div", { class: "focusPanelTitle", text: title }),
      el("div", { class: "focusPanelNote", text: note }),
    ]),
    nav,
  ]);

  const donutWrap = el("div", { class: "focusDonutWrap" }, []);
  const host = el("div", { class: "focusDonutHost" });
  donutWrap.appendChild(host);

  const onPick = (k) => {
    if (!parentKey) actions.onSetFocusParentKey?.(k);
  };

  renderDonut(host, { title, values, pickedKey: null, onPick });

  const legend = el("div", { class: "focusLegend" }, []);
  values.forEach((seg) => {
    legend.appendChild(
      el("button", { class: "focusLegendItem", onClick: () => onPick(seg.key) }, [
        el("span", { class: "legendSwatch", style: `background:${seg.color || "#6dd3fb"}` }),
        el("span", { text: seg.label }),
      ])
    );
  });

  panel.appendChild(el("div", { class: "focusDonutGrid" }, [donutWrap, legend]));
  mount.appendChild(panel);
}

/* ===== view builders ===== */

function buildGenreTopView_(state) {
  const genreTree = Array.isArray(state.byAxis?.["ジャンル"]) ? state.byAxis["ジャンル"] : [];

  const genreMetaByKey = new Map(GENRES.map((g) => [String(g.key), g]));
  const genreMetaByLabel = new Map(GENRES.map((g) => [String(g.label), g]));

  const metaOf = (node) => {
    return genreMetaByKey.get(String(node.key)) || genreMetaByLabel.get(String(node.label)) || null;
  };

  const items = genreTree.map((p) => {
    const meta = metaOf(p);
    return {
      key: p.key,
      label: meta?.label || p.label || p.key,
      machines: p.machines ?? 0,
      sales: p.sales ?? 0,
      consume: p.consume ?? 0,
      costRate: p.costRate ?? 0,
      color: meta?.color || null,
      hasChildren: Array.isArray(p.children) && p.children.length > 0,
    };
  });

  items.sort((a, b) => b.sales - a.sales);
  return normalizeShares_(items, { parentLabel: null });
}

function buildGenreChildView_(state, parentKey) {
  const genreTree = Array.isArray(state.byAxis?.["ジャンル"]) ? state.byAxis["ジャンル"] : [];
  const parentNode = genreTree.find((x) => String(x.key) === String(parentKey)) || null;

  const parentLabel = parentNode?.label || String(parentKey);
  const children = Array.isArray(parentNode?.children) ? parentNode.children : [];

  const items = children.map((ch) => ({
    key: ch.key,
    label: ch.label,
    machines: ch.machines ?? 0,
    sales: ch.sales ?? 0,
    consume: ch.consume ?? 0,
    costRate: ch.costRate ?? 0,
    color: null,
    hasChildren: false,
  }));

  return normalizeShares_(items, { parentLabel });
}

function normalizeShares_(items, meta) {
  const totalSales = items.reduce((a, x) => a + (Number(x.sales) || 0), 0);
  const totalMachines = items.reduce((a, x) => a + (Number(x.machines) || 0), 0);

  const out = items.map((x) => {
    const machines = Number(x.machines) || 0;
    const sales = Number(x.sales) || 0;
    return {
      ...x,
      salesShare: totalSales > 0 ? sales / totalSales : 0,
      machineShare: totalMachines > 0 ? machines / totalMachines : 0,
    };
  });

  return { ...meta, items: out };
}
