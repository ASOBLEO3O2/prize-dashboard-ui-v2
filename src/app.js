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

import { loadRawData } from "./data/load.js";
import { applyFilters } from "./logic/filter.js";
import { buildViewModel } from "./logic/aggregate.js";

const initialState = {
  // data
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

  // ✅ 中段KPI：軸別集計（③の土台）
  byAxis: {},

  // ✅ 中段KPI：表示モード
  midAxis: "ジャンル",     // 後でドロワーで切替。今はジャンル固定でもOK
  midParentKey: null,      // null=上層（ジャンル）/ 値あり=下層（内訳）

  // ✅ 中段KPI：並び替え
  midSortKey: "sales",     // "sales" | "consume" | "costRate" | "machines" | "avgSales"
  midSortDir: "desc",      // "asc" | "desc"

  // filters (Step Cで本実装)
  filters: {},

  // UI state
  focusGenre: null,        // 旧：ドーナツクリックで強調（残してOK）
  openDetailGenre: null,   // ジャンルカードクリックで下に詳細展開（テーブル）
  drawerOpen: false,

  // 詳細（テーブル）の並び替え（③）
  detailSortKey: "sales",  // "sales" | "consume" | "count" | "costRate"
  detailSortDir: "desc",   // "asc" | "desc"

  // errors
  loadError: null,
};

const store = createStore(initialState);
const root = document.getElementById("app");

// ===== actions =====
const actions = {
  // 旧：ドーナツ強調（残してOK / 今回の「消えるUI」では不要なら後で削除）
  onPickGenre: (genreOrNull) => {
    store.set((s) => ({ ...s, focusGenre: genreOrNull }));
  },

  // ✅ 中段KPI：上層→下層 / 下層→上層
  onPickMidParent: (keyOrNull) => {
    store.set((s) => ({ ...s, midParentKey: keyOrNull }));
  },

  // ✅ 再描画（stateを変えないと再描画されない場合の逃げ）
  requestRender: () => {
    store.set((s) => ({ ...s }));
  },

  // 詳細（テーブル）の開閉
  onToggleDetail: (genre) => {
    store.set((s) => {
      const next = (s.openDetailGenre === genre) ? null : genre;
      return { ...s, openDetailGenre: next };
    });
  },

  // 詳細（テーブル）並び替え（③）
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
  const axis = buildByAxis(filtered);

  store.set((s) => ({
    ...s,
    updatedDate: vm.updatedDate || s.updatedDate,
    topKpi: vm.topKpi,
    byGenre: vm.byGenre,
    details: vm.details,
    byAxis: axis,
    filters: vm.filters ?? s.filters,
    loadError: null,
    // midAxis / midParentKey / 並び替え / 詳細ソート などユーザー操作は維持
  }));
}
