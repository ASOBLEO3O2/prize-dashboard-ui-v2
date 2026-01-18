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
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

  filters: {},

  focusGenre: null,       // ドーナツクリックで強調（フィルタではない）
  openDetailGenre: null,  // カードクリックで下に展開
  drawerOpen: false,
  loadError: null,
};

const store = createStore(initialState);

const root = document.getElementById("app");

const actions = {
  onPickGenre: (genreOrNull) => {
    store.set(s => ({ ...s, focusGenre: genreOrNull }));
  },
  onToggleDetail: (genre) => {
    store.set(s => {
      const next = (s.openDetailGenre === genre) ? null : genre;
      return { ...s, openDetailGenre: next };
    });
  },
  onOpenDrawer: () => store.set(s => ({ ...s, drawerOpen: true })),
  onCloseDrawer: () => store.set(s => ({ ...s, drawerOpen: false })),

  onRefresh: async () => {
    // Step B: 本データを再ロード（将来はここにフィルタ再計算も入る）
    await hydrateFromRaw();
  }
};

const mounts = mountLayout(root, {
  onOpenDrawer: actions.onOpenDrawer,
  onCloseDrawer: actions.onCloseDrawer,
  onRefresh: actions.onRefresh,
});

function renderAll(state) {
  mounts.updatedBadge.textContent = `更新日: ${fmtDate(state.updatedDate)}`;
  renderTopKpi(mounts.topKpi, state.topKpi);
  renderMidKpi(mounts.donutsArea, mounts.midCards, state, actions);
  renderDetail(mounts.detailMount, state, actions);
  renderDrawer(mounts.drawer, mounts.drawerOverlay, state, actions);
}

// 初回描画（まずはMOCKで表示）
renderAll(store.get());
store.subscribe(renderAll);

// 実データで上書き
hydrateFromRaw().catch((e) => {
  console.error(e);
  store.set(s => ({ ...s, loadError: String(e?.message || e) }));
});

async function hydrateFromRaw() {
  const { rows, summary } = await loadRawData();

  // Step Cで filters を効かせる。今は器だけ通す
  const st = store.get();
  const filtered = applyFilters(rows, st.filters);

  const vm = buildViewModel(filtered, summary);

  store.set(s => ({
    ...s,
    updatedDate: vm.updatedDate || s.updatedDate,
    topKpi: vm.topKpi,
    byGenre: vm.byGenre,
    details: vm.details,
    filters: vm.filters ?? s.filters,
    // 状態は維持（フォーカス/詳細）
    loadError: null,
  }));
}
