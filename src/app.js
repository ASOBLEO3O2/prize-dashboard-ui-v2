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

const DEFAULT_MID_SLOTS = ["widget1", "widget2", "dummyA", "dummyB"];

const initialState = {
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

  widget1Axis: "景品ジャンル",
  filteredRows: [],
  byAxis: {},

  midAxis: "ジャンル",
  midParentKey: null,
  midSortKey: "sales",
  midSortDir: "desc",

  filters: {},

  focusGenre: null,
  openDetailGenre: null,
  drawerOpen: false,

  focus: {
    open: false,
    kind: null,
    title: "",
    parentKey: null,
  },

  detailSortKey: "sales",
  detailSortDir: "desc",

  midSlots: [...DEFAULT_MID_SLOTS],
  midSlotsDraft: [...DEFAULT_MID_SLOTS],

  loadError: null,
};

const store = createStore(initialState);
const root = document.getElementById("app");

window.getState = () => store.get();

// ===== actions =====
const actions = {
  onPickGenre: (genreOrNull) => {
    store.set((s) => ({ ...s, focusGenre: genreOrNull }));
  },

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
    store.set((s) => ({
      ...s,
      openDetailGenre: s.openDetailGenre === genre ? null : genre,
    }));
  },

  onSetDetailSort: (key, dir) => {
    store.set((s) => ({
      ...s,
      detailSortKey: key ?? s.detailSortKey,
      detailSortDir: dir ?? s.detailSortDir,
    }));
  },

  onSetWidget1Axis: (axisKey) => {
    store.set((s) => ({
      ...s,
      widget1Axis: axisKey || s.widget1Axis,
    }));
  },

  onOpenDrawer: () => store.set((s) => ({ ...s, drawerOpen: true })),

  onCloseDrawer: () => store.set((s) => ({ ...s, drawerOpen: false })),

  onSetMidSlotDraft: (index, value) => {
    store.set((s) => {
      const next = [...s.midSlotsDraft];
      next[index] = String(value || "").trim();
      return { ...s, midSlotsDraft: next };
    });
  },

  onCancelMidSlots: () => {
    store.set((s) => ({
      ...s,
      midSlotsDraft: [...s.midSlots],
    }));
  },

  onApplyMidSlots: () => {
    store.set((s) => ({
      ...s,
      midSlots: [...s.midSlotsDraft],
    }));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        actions.requestRender?.();
      });
    });
  },

  onOpenFocus: (kind) => {
    const title =
      kind === "shareDonut" ? "売上 / 台数 構成比" :
      kind === "salesDonut" ? "売上構成比" :
      kind === "machineDonut" ? "台数構成比" :
      kind === "costHist" ? "原価率 分布" :
      kind === "scatter" ? "売上 × 原価率（マトリクス）" :
      "詳細";

    store.set((s) => ({
      ...s,
      focus: { open: true, kind, title, parentKey: null },
    }));
  },

  onCloseFocus: () => {
    store.set((s) => ({
      ...s,
      focus: { open: false, kind: null, title: "", parentKey: null },
    }));
  },

  onSetFocusParentKey: (keyOrNull) => {
    store.set((s) => ({
      ...s,
      focus: { ...s.focus, parentKey: keyOrNull },
    }));
  },

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
  renderMidKpi(mounts, state, actions);

  // ✅ チャートはDOMが確定してから1回だけ呼ぶ（重複呼びを削除）
  requestAnimationFrame(() => {
    renderCharts(mounts, state);
  });

  renderFocusOverlay(mounts.focusOverlay, mounts.focusModal, state, actions);
  renderDetail(mounts.detailMount, state, actions);
  renderDrawer(mounts.drawer, mounts.drawerOverlay, state, actions);
}

renderAll(store.get());
store.subscribe(renderAll);

hydrateFromRaw().catch((e) => {
  console.error(e);
  store.set((s) => ({
    ...s,
    loadError: String(e?.message || e),
  }));
});

// ===== data hydrate =====
async function hydrateFromRaw() {
  const { rows, summary } = await loadRawData();

  // symbol decode（必要なら）
  const decoded = rows.map((r) => ({
    ...r,
    ...decodeSymbol(r.symbol_raw ?? r.symbol ?? "", summary?.codebook),
  }));

  const st = store.get();
  const filtered = applyFilters(decoded, st.filters);

  const vm = buildViewModel(filtered, summary);
  const axis = buildByAxis(filtered);

  store.set((s) => ({
    ...s,
    updatedDate: summary?.updatedDate ?? s.updatedDate,
    filteredRows: filtered,
    byAxis: axis,
    topKpi: vm.topKpi,
    byGenre: vm.byGenre,
    details: vm.details,
    loadError: null,
  }));
}
