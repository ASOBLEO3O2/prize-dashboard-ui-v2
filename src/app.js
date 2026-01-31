// src/app.js
import { createStore } from "./state/store.js";
import { mountLayout } from "./ui/layout.js";
import { renderTopKpi } from "./ui/kpiTop.js";
import { renderWidget1ShareDonut } from "./ui/widget1ShareDonut.js";
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

const initialState = {
  // data
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

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
    kind: null,      // "salesDonut" | "machineDonut" | "costHist" | "scatter"
    title: "",
    parentKey: null, // ドーナツ下層（拡大内のみ）
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

  // Drawer
  onOpenDrawer: () => store.set((s) => ({ ...s, drawerOpen: true })),
  onCloseDrawer: () => store.set((s) => ({ ...s, drawerOpen: false })),

  // ✅ フォーカス（上層レイヤー）
  onOpenFocus: (kind) => {
    const title =
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

  // 中段（4カード + 下段カード）
  renderMidKpi(mounts, state, actions);

  // チャート描画
  renderCharts(mounts, state);

  // フォーカス（上層レイヤー）
  renderFocusOverlay(mounts.focusOverlay, mounts.focusModal, state, actions);

  // 詳細
  renderDetail(mounts.detailMount, state, actions);

  // ドロワー
  renderDrawer(mounts.drawer, mounts.drawerOverlay, state, actions);

  renderWidget1ShareDonut(mounts.widget1, state, actions, { mode: "normal" });

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

  // ③ 正規化
  const normalizedRows = rows.map((r) => {
    const key = String(r?.symbol_raw ?? r?.raw ?? "").trim();
    const m = key ? masterDict?.[key] : null;
    const decoded = key ? decodeSymbol(key, codebook) : {};

    return {
      ...r,
      ...(m || {}),
      ...decoded,

      symbol_raw: r.symbol_raw,
      raw: r.raw,
      sales: r.sales,
      claw: r.claw,
      cost_rate: r.cost_rate,
    };
  });

  // ④ フィルタ
  const st = store.get();
  const filtered = applyFilters(normalizedRows, st.filters);

  // ⑤ 集計
  const vm = buildViewModel(filtered, summary);
  const axis = buildByAxis(filtered);

  // ⑥ state 更新
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
