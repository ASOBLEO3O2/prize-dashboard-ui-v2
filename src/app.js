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
  // data
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

  // ✅ ウィジェット①：軸
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
    kind: null,
    title: "",
    parentKey: null,
  },

  // 詳細（テーブル）の並び替え
  detailSortKey: "sales",
  detailSortDir: "desc",

  // ✅ 中段4枠：割当（確定値）＆ 作業中（draft）
  midSlots: [...DEFAULT_MID_SLOTS],
  midSlotsDraft: [...DEFAULT_MID_SLOTS],

  // errors
  loadError: null,
};

const store = createStore(initialState);
const root = document.getElementById("app");

// ✅ デバッグ用（任意）
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
    // これ自体はOK（renderループ内で呼ばれない限り無限ループしない）
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

  // ✅ ウィジェット①：軸
  onSetWidget1Axis: (axisKey) => {
    store.set((s) => ({
      ...s,
      widget1Axis: axisKey || s.widget1Axis || "景品ジャンル",
    }));
  },

  // Drawer
  onOpenDrawer: () => store.set((s) => ({ ...s, drawerOpen: true })),
  onCloseDrawer: () => store.set((s) => ({ ...s, drawerOpen: false })),

  // ✅ 中段スロット：draft操作
  onSetMidSlotDraft: (index, value) => {
    store.set((s) => {
      const next = Array.isArray(s.midSlotsDraft) ? [...s.midSlotsDraft] : [...DEFAULT_MID_SLOTS];
      next[index] = String(value || "").trim();
      return { ...s, midSlotsDraft: next };
    });
  },

  // ✅ 中段スロット：取消（draftを確定値に戻す）
  onCancelMidSlots: () => {
    store.set((s) => ({
      ...s,
      midSlotsDraft: Array.isArray(s.midSlots) ? [...s.midSlots] : [...DEFAULT_MID_SLOTS],
    }));
  },

  // ✅ 中段スロット：決定（＋ Chart.js の “旧サイズ描画” を止める）
  onApplyMidSlots: () => {
    store.set((s) => ({
      ...s,
      midSlots: Array.isArray(s.midSlotsDraft) ? [...s.midSlotsDraft] : [...DEFAULT_MID_SLOTS],
    }));

    // ★スロット切替直後はDOMサイズが確定してないので、2フレーム遅らせて再描画させる
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        actions.requestRender?.(); // renderCharts() が走り、charts.js 側の resize も効く
      });
    });
  },

  // ✅ フォーカス
  onOpenFocus: (kind) => {
    const title =
      (kind === "shareDonut") ? "売上 / 台数 構成比" :
      (kind === "salesDonut") ? "売上構成比" :
      (kind === "machineDonut") ? "台数構成比" :
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

  renderMidKpi(mounts, state, actions);

  renderCharts(mounts, state);

  renderFocusOverlay(mounts.focusOverlay, mounts.focusModal, state, actions);

  renderDetail(mounts.detailMount, state, actions);

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

  // codebook
  let codebook = {};
  try {
    const res = await fetch("./data/master/codebook.json", { cache: "no-store" });
    if (res.ok) codebook = await res.json();
  } catch (e) {
    codebook = {};
  }

  // ✅ 正規化：rawの booth_id を絶対に守る
  const normalizedRows = rows.map((r) => {
    const key = String(r?.symbol_raw ?? r?.raw ?? "").trim();
    const m = key ? masterDict?.[key] : null;
    const decoded = key ? decodeSymbol(key, codebook) : {};

    return {
      ...r,
      ...(m || {}),
      ...decoded,

      // ✅ 最後に raw を再代入して “上書き防止”
      booth_id: r?.booth_id,
      machine_name: r?.machine_name,
      machine_key: r?.machine_key,
      label_id: r?.label_id,

      symbol_raw: r?.symbol_raw,
      raw: r?.raw,
      sales: r?.sales,
      claw: r?.claw,
      cost_rate: r?.cost_rate,
    };
  });

  // フィルタ
  const st = store.get();
  const filtered = applyFilters(normalizedRows, st.filters);

  // 集計
  const vm = buildViewModel(filtered, summary);
  const axis = buildByAxis(filtered);

  // state 更新
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
