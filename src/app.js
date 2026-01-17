import { createStore } from "./state/store.js";
import { mountLayout } from "./ui/layout.js";
import { renderTopKpi } from "./ui/kpiTop.js";
import { renderMidKpi } from "./ui/kpiMid.js";
import { renderDetail } from "./ui/detail.js";
import { renderDrawer } from "./ui/drawer.js";
import { MOCK } from "./constants.js";
import { fmtDate } from "./utils/format.js";

const initialState = {
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

  focusGenre: null,       // ドーナツクリックで強調（フィルタではない）
  openDetailGenre: null,  // カードクリックで下に展開
  drawerOpen: false,
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
  onRefresh: () => {
    // Step A: モックなので見た目だけ「更新」挙動
    // 今後ここをデータロードに差し替える
    store.set(s => ({ ...s, updatedDate: s.updatedDate }));
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

// 初回描画
renderAll(store.get());

// 以後、状態変化で再描画
store.subscribe(renderAll);
