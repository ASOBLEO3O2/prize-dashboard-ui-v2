// src/app.js
import { createStore } from "./state/store.js";
import { mountLayout } from "./ui/layout.js";
import { renderTopKpi } from "./ui/kpiTop.js";
import { renderMidKpi } from "./ui/kpiMid.js";
import { renderDetail } from "./ui/detail.js";
import { renderDrawer } from "./ui/drawer.js";

import { MOCK } from "./constants.js";
import { fmtDate } from "./utils/format.js";

import { loadRawData } from "./data/load.js";
import { applyFilters } from "./logic/filter.js";
import { buildViewModel } from "./logic/aggregate.js";

const initialState = {
  // data
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

  // filters (Step Cで本実装)
  filters: {},

  // UI state
  focusGenre: null,        // ドーナツクリックで強調（フィルタではない）
  openDetailGenre: null,   // カードクリックで下に詳細展開
  drawerOpen: false,

  // 詳細の並び替え（③）
  detailSortKey: "sales",  // "sales" | "consume" | "count" | "costRate"
  detailSortDir: "desc",   // "asc" | "desc"

  // errors
  loadError: null,
};

const store = createStore(initialState);
const root = document.getElementById("app");

// ===== actions =====
const actions = {
  // ドーナツ強調
  onPickGenre: (genreOrNull) => {
    store.set((s) => ({ ...s, focusGenre: genreOrNull }));
  },

  // 詳細の開閉
  onToggleDetail: (genre) => {
    store.set((s) => {
      const next = (s.openDetailGenre === genre) ? null : genre;
      return { ...s, openDetailGenre: next };
    });
  },

  // 詳細並び替え（③）
  onSetDetailSort: (key, dir) => {
    store.set((s) => ({
      ...s,
      detailSortKey: key ?? s.detailSortKey,
      detailSortDir: dir ?? s.detailSortDir,
    }));
  },

  // ドロワー
  onOpenDrawer: () => store.set((s) => ({ ...s, drawerOpen: true })),
  onCloseDrawer: () => store.set((s) => ({ ...s, drawerOpen: false })),

  // 更新（本データ再取得）
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

  // 中段（ドーナツ＋カード）
  renderMidKpi(mounts.donutsArea, mounts.midCards, state, actions);

  // 詳細（並び替えも state/actions に依存）
  renderDetail(mounts.detailMount, state, actions);

  renderDrawer(mounts.drawer, mounts.drawerOverlay, state, actions);
}

// 初回描画（まずはMOCKで表示）
renderAll(store.get());
store.subscribe(renderAll);

// 実データで上書き
hydrateFromRaw().catch((e) => {
  console.error(e);
  store.set((s) => ({ ...s, loadError: String(e?.message || e) }));
});

async function hydrateFromRaw() {
  const { rows, summary } = await loadRawData();

  // Step Cで filters を効かせる。今は器だけ通す
  const st = store.get();
  const filtered = applyFilters(rows, st.filters);

  const vm = buildViewModel(filtered, summary);

  store.set((s) => ({
    ...s,
    updatedDate: vm.updatedDate || s.updatedDate,
    topKpi: vm.topKpi,
    byGenre: vm.byGenre,
    details: vm.details,
    filters: vm.filters ?? s.filters,
    loadError: null,
    // focusGenre / openDetailGenre / detailSort は維持（ユーザー操作を壊さない）
  }));
}
