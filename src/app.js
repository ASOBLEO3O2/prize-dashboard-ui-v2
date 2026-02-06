// src/app.js
// ======================================================
// フェーズ1（ウィジェット②：原価率分布）
// ✅ 目的：mode（台数/売上）を “state（本丸）” に保存して、再描画で戻らないようにする
// ✅ 入力：state.ui.costHistMode = "count" | "sales"
// ======================================================

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

/* ======================================================
   フェーズ1：UI好みの永続化（任意）
   - “壊れない” ために try/catch で守る
   - 使わないなら消してもOK（state保存だけでも要件は満たす）
====================================================== */
const LS_KEY_COST_HIST_MODE = "ps.costHistMode";

function loadCostHistMode_() {
  try {
    const v = localStorage.getItem(LS_KEY_COST_HIST_MODE);
    return (v === "sales" || v === "count") ? v : null;
  } catch (_) {
    return null;
  }
}

function saveCostHistMode_(mode) {
  try {
    localStorage.setItem(LS_KEY_COST_HIST_MODE, String(mode));
  } catch (_) {}
}

/* ======================================================
   初期state
   - ✅ ui.costHistMode を追加（本丸）
   - 既存のstate構造は維持（非破壊）
====================================================== */
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

  // ✅ フェーズ1：ウィジェット②（原価率分布）の入力（本丸）
  // - widget2CostHist.js は state.ui.costHistMode を見に行く
  // - charts.js 側が古い参照をしていても壊れないよう、後で actions で互換キーも立てる
  ui: {
    costHistMode: loadCostHistMode_() || "count", // "count" | "sales"
  },

  // 詳細（テーブル）の並び替え
  detailSortKey: "sales",
  detailSortDir: "desc",

  // errors
  loadError: null,
};

const store = createStore(initialState);
const root = document.getElementById("app");

// ✅ デバッグ用（任意）
// コンソールで window.getState() が使えるようにする（壊れない安全なやつ）
window.getState = () => store.get();
window.store = store; // Consoleから store.get()/set() を使うため（デバッグ専用）

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

  /* ======================================================
     フェーズ1：ウィジェット②（原価率分布）の mode を state に保存
     - widget2CostHist.js の change から呼ばれる想定
     - 保存後は store.subscribe(renderAll) が走るので、ここで追加の描画呼び出しは不要
     - 互換のために “costHistMode” をトップ階層にも立てる（既存charts側が参照していても壊れない）
  ====================================================== */
  onSetCostHistMode: (mode) => {
    const m = (mode === "sales") ? "sales" : "count";

    store.set((s) => ({
      ...s,
      // ✅ 本丸
      ui: { ...(s.ui || {}), costHistMode: m },

      // ✅ 互換（もし charts.js が state.costHistMode を見ていた場合でも動く）
      costHistMode: m,
    }));

    // 任意：好みとして永続化
    saveCostHistMode_(m);
  },

  // Drawer
  onOpenDrawer: () => store.set((s) => ({ ...s, drawerOpen: true })),
  onCloseDrawer: () => store.set((s) => ({ ...s, drawerOpen: false })),

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

  // ✅ kpiMid は widget②も含めて state/actions を受け取る
  renderMidKpi(mounts, state, actions);

  // ✅ charts は state.ui.costHistMode を見られる（互換で state.costHistMode も立ててる）
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
