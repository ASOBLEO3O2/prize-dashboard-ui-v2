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
import { applyFilters } from "./logic/filter.js"; // ✅ normRows前提
import { buildViewModel } from "./logic/aggregate.js"; // 既存のtopKpi等（必要なら後でnormRowsに寄せる）

import { normalizeRow } from "./data/normalizeRow.js";
import { renderFocusOverlay } from "./ui/focusOverlay.js";

const DEFAULT_MID_SLOTS = ["widget1", "widget2", "dummyA", "dummyB"];

const initialState = {
  updatedDate: MOCK.updatedDate,
  topKpi: structuredClone(MOCK.topKpi),
  byGenre: structuredClone(MOCK.byGenre),
  details: structuredClone(MOCK.details),

  widget1Axis: "景品ジャンル",

  // ✅ B案：正規化済み（全件）
  normRowsAll: [],

  // ✅ B案：正規化済み（フィルタ適用後＝表示対象）
  normRows: [],

  // ✅ 既存の階層集計（ウィジェット①のドリル等で使用）
  byAxis: {},

  midAxis: "ジャンル",
  midParentKey: null,
  midSortKey: "sales",
  midSortDir: "desc",

  // ✅ appフィルタ（上層→下層にも対応）
  filters: {
    machineNames: [],
    feeKeys: [],
    prizeGenreKey: "",
    subGenreKey: "",
    charaKey: "",
    charaSubKey: "",
    flags: { movie: null, reserve: null, wl: null },
  },

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

// ✅ デバッグ用
window.store = store;
window.getState = () => store.get();

// ===== actions =====
const actions = {
  // ===== app filters =====
  onSetMachineNames: (names) => {
    store.set((s) => ({
      ...s,
      filters: { ...(s.filters || {}), machineNames: Array.isArray(names) ? names : [] },
    }));
    actions.requestRender();
  },

  onSetFeeKeys: (keys) => {
    store.set((s) => ({
      ...s,
      filters: { ...(s.filters || {}), feeKeys: Array.isArray(keys) ? keys : [] },
    }));
    actions.requestRender();
  },

  onSetPrizeGenre: (keyOrEmpty) => {
    store.set((s) => ({
      ...s,
      filters: {
        ...(s.filters || {}),
        prizeGenreKey: String(keyOrEmpty || "").trim(),
        subGenreKey: "", // ★親変更で子をリセット
      },
    }));
    actions.requestRender();
  },

  onSetPrizeSubGenre: (subKeyOrEmpty) => {
    store.set((s) => ({
      ...s,
      filters: { ...(s.filters || {}), subGenreKey: String(subKeyOrEmpty || "").trim() },
    }));
    actions.requestRender();
  },

  onSetChara: (keyOrEmpty) => {
    store.set((s) => ({
      ...s,
      filters: {
        ...(s.filters || {}),
        charaKey: String(keyOrEmpty || "").trim(),
        charaSubKey: "", // ★親変更で子をリセット
      },
    }));
    actions.requestRender();
  },

  onSetCharaSub: (subKeyOrEmpty) => {
    store.set((s) => ({
      ...s,
      filters: { ...(s.filters || {}), charaSubKey: String(subKeyOrEmpty || "").trim() },
    }));
    actions.requestRender();
  },

  onSetFlags: (nextFlags) => {
    store.set((s) => ({
      ...s,
      filters: {
        ...(s.filters || {}),
        flags: {
          ...(s.filters?.flags || { movie: null, reserve: null, wl: null }),
          ...(nextFlags || {}),
        },
      },
    }));
    actions.requestRender();
  },

  onClearFilters: () => {
    store.set((s) => ({
      ...s,
      filters: {
        machineNames: [],
        feeKeys: [],
        prizeGenreKey: "",
        subGenreKey: "",
        charaKey: "",
        charaSubKey: "",
        flags: { movie: null, reserve: null, wl: null },
      },
    }));
    actions.requestRender();
  },

  // ===== existing =====
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
      focus: { ...s.focus, parentKey: null }, // 軸変更でドリル戻し
    }));
  },

  onOpenDrawer: () => {
    store.set((s) => ({ ...s, drawerOpen: true }));
    actions.requestRender();
  },

  onCloseDrawer: () => {
    store.set((s) => ({ ...s, drawerOpen: false }));
    actions.requestRender();
  },

  onSetMidSlotDraft: (index, value) => {
    store.set((s) => {
      const next = [...s.midSlotsDraft];
      next[index] = String(value || "").trim();
      return { ...s, midSlotsDraft: next };
    });
    actions.requestRender();
  },

  onCancelMidSlots: () => {
    store.set((s) => ({
      ...s,
      midSlotsDraft: [...s.midSlots],
    }));
    actions.requestRender();
  },

  onApplyMidSlots: () => {
    store.set((s) => {
      const fixed = [...s.midSlotsDraft];
      return {
        ...s,
        midSlots: fixed,
        midSlotsDraft: fixed,
        drawerOpen: false,
      };
    });
    actions.requestRender();
  },

  onOpenFocus: (kind) => {
    const title =
      kind === "shareDonut"
        ? "売上 / 台数 構成比"
        : kind === "salesDonut"
        ? "売上構成比"
        : kind === "machineDonut"
        ? "台数構成比"
        : kind === "costHist"
        ? "原価率 分布"
        : kind === "scatter"
        ? "売上 × 原価率（マトリクス）"
        : "詳細";

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

  renderFocusOverlay(mounts.focusOverlay, mounts.focusModal, state, actions);
  renderDetail(mounts.detailMount, state, actions);
  renderDrawer(mounts.drawer, mounts.drawerOverlay, state, actions);
}

renderAll(store.get());
store.subscribe(renderAll);

// 初回ロード
hydrateFromRaw().catch((e) => {
  console.error(e);
  store.set((s) => ({
    ...s,
    loadError: String(e?.message || e),
  }));
});

// ===== data hydrate =====
async function hydrateFromRaw() {
  const raw = await loadRawData();
  const rows = Array.isArray(raw?.rows) ? raw.rows : [];
  const summary = raw?.summary ?? null;
  const masterDict = raw?.masterDict ?? {};

  // codebook（decodeSymbol 用）
  let codebook = {};
  try {
    const res = await fetch("./data/master/codebook.json", { cache: "no-store" });
    if (res.ok) codebook = await res.json();
  } catch (e) {
    codebook = {};
  }

  // enrich（master合流 + decode）
  const enriched = rows.map((r) => {
    const key = String(r?.symbol_raw ?? r?.raw ?? "").trim();
    const m = key ? masterDict?.[key] : null;
    const decoded = key ? decodeSymbol(key, codebook) : {};

    return {
      ...r,
      ...(m || {}),
      ...decoded,

      // raw側の値は明示的に保持
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

  // ✅ B案：正規化は入口で1回（全件）
  const normRowsAll = enriched.map(normalizeRow);

  // ✅ appフィルタ：正規化済みだけを対象にする
  const st = store.get();
  const normRows = applyFilters(normRowsAll, st.filters);

  // ✅ byAxis は “表示対象” に合わせる（フィルタ反映）
  const axis = buildByAxis(normRows);

  // 既存topKpi等（必要なら後でnormRowsに寄せる）
  const vm = buildViewModel(enriched, summary);

  store.set((s) => ({
    ...s,
    updatedDate: vm.updatedDate || s.updatedDate,
    topKpi: vm.topKpi,
    byGenre: vm.byGenre,
    details: vm.details,
    byAxis: axis,
    normRowsAll,
    normRows,
    loadError: null,
  }));
}
