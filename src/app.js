// src/app.js
import { createStore } from "./state/store.js";
import { mountLayout } from "./ui/layout.js";
import { renderTopKpi } from "./ui/kpiTop.js";
import { renderMidKpi } from "./ui/kpiMid.js";
import { renderDetail } from "./ui/detail.js";
import { renderDrawer } from "./ui/drawer.js";
import { buildByAxis } from "./logic/byAxis.js";

import { MOCK } from "./constants.js";
import { fmtDate } from "./utils/format.js";
import { decodeSymbol } from "./logic/decodeSymbol.js";

import { loadRawData } from "./data/load.js";
import { applyFilters } from "./logic/filter.js";
import { buildViewModel } from "./logic/aggregate.js";

import { renderCharts } from "./ui/charts.js";
import { renderFocusOverlay } from "./ui/focusOverlay.js";

/**
 * ✅ booth_id の「潰れ」を防ぐための方針
 * - どんな merge 順でも booth_id が上書きされないように、最後に確定して戻す
 * - 優先順：
 *   1) rows（r）の booth_id
 *   2) rows（r）の "ブースID"
 *   3) masterDict（m）の booth_id
 *   4) masterDict（m）の "ブースID"
 */
function pickBoothId_(r, m) {
  const cand = [
    r?.booth_id,
    r?.["ブースID"],
    m?.booth_id,
    m?.["ブースID"],
  ];
  for (const v of cand) {
    const s = (v == null) ? "" : String(v).trim();
    if (s) return s;
  }
  return ""; // upstream が壊れている場合のみ空
}

function safeStr_(v) {
  return (v == null) ? "" : String(v).trim();
}

const initialState = {
  // data
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

  // ✅ ウィジェット①：軸（実列名に寄せる）
  widget1Axis: "景品ジャンル",

  // チャート用（フィルタ後rows）
  filteredRows: [],

  // 中段KPI：軸別集計
  byAxis: {},

  // 下段（無罪：既存）
  midAxis: "ジャンル",
  midParentKey: null,
  midSortKey: "sales",
  midSortDir: "desc",

  // filters
  filters: {},

  // UI state
  focusGenre: null,
  openDetailGenre: null,
  drawerOpen: false,

  // ✅ フォーカス（上層レイヤー）
  focus: {
    open: false,
    kind: null,      // "shareDonut" | "costHist" | "scatter" | ...
    title: "",
    parentKey: null, // 拡大内のドリル用
  },

  // 詳細（テーブル）の並び替え
  detailSortKey: "sales",
  detailSortDir: "desc",

  // errors
  loadError: null,
};

const store = createStore(initialState);
const root = document.getElementById("app");

// ===== actions =====
const actions = {
  onPickGenre: (genreOrNull) => {
    store.set((s) => ({ ...s, focusGenre: genreOrNull }));
  },

  // 下段（無罪）
  onPickMidParent: (keyOrNull) => {
    store.set((s) => ({ ...s, midParentKey: keyOrNull }));
  },

  onOpenMidDetail: (payloadOrNull) => {
    store.set((s) => ({ ...s, midDetail: payloadOrNull }));
  },

  requestRender: () => {
    store.set((s) => ({ ...s }));
  },

  onToggleDetail: (genre) => {
    store.set((s) => {
      const next = (s.openDetailGenre === genre) ? null : genre;
      return { ...s, openDetailGenre: next };
    });
  },

  onSetDetailSort: (key, dir) => {
    store.set((s) => ({
      ...s,
      detailSortKey: key ?? s.detailSortKey,
      detailSortDir: dir ?? s.detailSortDir,
    }));
  },

  // ✅ ウィジェット①：軸を store に確定（state直書き禁止）
  onSetWidget1Axis: (axisKey) => {
    store.set((s) => ({
      ...s,
      widget1Axis: axisKey || s.widget1Axis || "景品ジャンル",
    }));
  },

  // Drawer
  onOpenDrawer: () => store.set((s) => ({ ...s, drawerOpen: true })),
  onCloseDrawer: () => store.set((s) => ({ ...s, drawerOpen: false })),

  // ✅ フォーカス（上層レイヤー）
  onOpenFocus: (kind) => {
    const title =
      (kind === "shareDonut") ? "売上 / ステーション 構成比" :
      (kind === "salesDonut") ? "売上構成比" :
      (kind === "machineDonut") ? "マシン構成比" :
      (kind === "costHist") ? "原価率 分布" :
      (kind === "scatter") ? "売上 × 原価率（マトリクス）" :
      "詳細";

    store.set((s) => ({
      ...s,
      focus: { open: true, kind, title, parentKey: null }
    }));
  },

  onCloseFocus: () => {
    store.set((s) => ({
      ...s,
      focus: { open: false, kind: null, title: "", parentKey: null }
    }));
  },

  onSetFocusParentKey: (keyOrNull) => {
    store.set((s) => ({
      ...s,
      focus: { ...s.focus, parentKey: keyOrNull }
    }));
  },

  // Refresh
  onRefresh: async () => {
    await hydrateFromRaw();
  },
};

// ===== mount =====
const mounts = mountLayout(root, {
  onOpenDrawer: actions.onOpenDrawer,
  onCloseDrawer: actions.onCloseDrawer,
  onRefresh: actions.onRefresh,
});

// ===== render loop =====
function renderAll(state) {
  mounts.updatedBadge.textContent = `更新日: ${fmtDate(state.updatedDate)}`;

  renderTopKpi(mounts.topKpi, state.topKpi);

  // 中段（ウィジェット① + ヒスト + 散布 + 下段）
  renderMidKpi(mounts, state, actions);

  // charts.js は「ヒスト/散布」の更新だけ担当
  renderCharts(mounts, state);

  // フォーカス（上層レイヤー）
  renderFocusOverlay(mounts.focusOverlay, mounts.focusModal, state, actions);

  // 詳細
  renderDetail(mounts.detailMount, state, actions);

  // ドロワー
  renderDrawer(mounts.drawer, mounts.drawerOverlay, state, actions);
}

renderAll(store.get());
store.subscribe(renderAll);

hydrateFromRaw().catch((e) => {
  console.error(e);
  store.set((s) => ({ ...s, loadError: String(e?.message || e) }));
});

async function hydrateFromRaw() {
  const raw = await loadRawData();
  const rows = Array.isArray(raw?.rows) ? raw.rows : [];
  const summary = raw?.summary ?? null;
  const masterDict = raw?.masterDict ?? {};

  // ② codebook
  let codebook = {};
  try {
    const res = await fetch("./data/master/codebook.json", { cache: "no-store" });
    if (res.ok) codebook = await res.json();
  } catch (e) {
    codebook = {};
  }

  // ③ 正規化（✅ booth_id を最後に確定して「潰れ」を防ぐ）
  const normalizedRows = rows.map((r) => {
    const key = safeStr_(r?.symbol_raw ?? r?.raw ?? "");
    const m = key ? (masterDict?.[key] ?? null) : null;
    const decoded = key ? decodeSymbol(key, codebook) : {};

    // ✅ ここで先に booth_id を確定（r と m だけを見る）
    const booth_id_fixed = pickBoothId_(r, m);

    // merge
    const out = {
      ...r,
      ...(m || {}),
      ...decoded,

      // 重要：入力側の raw 参照を保持
      symbol_raw: r?.symbol_raw,
      raw: r?.raw,

      // 数値系は rows を優先（decode/master が持っていても上書きしない）
      sales: r?.sales,
      claw: r?.claw,
      cost_rate: r?.cost_rate,
    };

    // ✅ 最後に booth_id を戻して「絶対に潰れない」ようにする
    if (booth_id_fixed) out.booth_id = booth_id_fixed;

    return out;
  });

  // ④ フィルタ
  const st = store.get();
  const filtered = applyFilters(normalizedRows, st.filters);

  // ⑤ 集計
  const vm = buildViewModel(filtered, summary);
  const axis = buildByAxis(filtered);

  // ⑥ state 更新（widget1Axis は維持）
  store.set((s) => ({
    ...s,
    updatedDate: vm.updatedDate || s.updatedDate,
    topKpi: vm.topKpi,
    byGenre: vm.byGenre,
    details: vm.details,
    byAxis: axis,
    filters: vm.filters ?? s.filters,
    filteredRows: filtered,
    loadError: null,
  }));
}
