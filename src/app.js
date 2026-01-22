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

const initialState = {
  // data
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

  // 中段の詳細（将来拡張用）
  midDetail: null, // { axis, parentKey, childLabel }

  // ✅ 中段KPI：軸別集計（③の土台）
  byAxis: {},

  // ✅ 中段KPI：表示モード
  midAxis: "ジャンル",
  midParentKey: null, // null=上層 / 値あり=下層

  // ✅ 中段KPI：並び替え
  midSortKey: "sales",
  midSortDir: "desc",

  // filters
  filters: {},

  // UI state
  focusGenre: null,
  openDetailGenre: null,
  drawerOpen: false,

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

  // ✅ 中段KPI：上層→下層 / 下層→上層
  onPickMidParent: (keyOrNull) => {
    store.set((s) => ({ ...s, midParentKey: keyOrNull }));
  },

  // 将来：中段から詳細を開く（今は未使用でもOK）
  onOpenMidDetail: (payloadOrNull) => {
    store.set((s) => ({ ...s, midDetail: payloadOrNull }));
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

  // 詳細（テーブル）並び替え
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

  // 詳細
  renderDetail(mounts.detailMount, state, actions);

  // ドロワー
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
  // ① 生データ取得
  const raw = await loadRawData();
  const rows = Array.isArray(raw?.rows) ? raw.rows : [];
  const summary = raw?.summary ?? null;
  const masterDict = raw?.masterDict ?? {};

  console.log("[CONNECT] rows:", rows.length);
  console.log("[CONNECT] master keys:", masterDict ? Object.keys(masterDict).length : 0);

  // ② codebook（無ければ空でOK：404は握りつぶす）
  let codebook = {};
  try {
    const res = await fetch("./data/master/codebook.json", { cache: "no-store" });
    if (res.ok) codebook = await res.json();
  } catch (e) {
    codebook = {};
  }

  // ③ 正規化（売上マスタ + 記号解析）
  const normalizedRows = rows.map((r) => {
    const key = String(r?.symbol_raw ?? r?.raw ?? "").trim();
    const m = key ? masterDict?.[key] : null;
    const decoded = key ? decodeSymbol(key, codebook) : {};

    return {
      ...r,
      ...(m || {}),
      ...decoded,

      // key系と数値系は r を正とする
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
    loadError: null,
  }));
}
