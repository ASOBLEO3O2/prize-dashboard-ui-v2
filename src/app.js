// src/app.js
// ======================================================
// プライズシート：アプリ入口（状態の本丸＝app/store）
// フェーズ1：ウィジェット②（原価率分布）の mode を state に保存し、再描画を確実に走らせる
// ======================================================

import { createStore } from "./state/store.js";

import { mountLayout } from "./ui/layout.js";
import { renderTopKpi } from "./ui/kpiTop.js";
import { renderMidKpi } from "./ui/kpiMid.js";
import { renderDetail } from "./ui/detail.js";
import { renderDrawer } from "./ui/drawer.js";

import { loadRawData } from "./data/load.js";
import { applyFilters } from "./logic/filters.js";
import { buildViewModel } from "./logic/viewModel.js";
import { buildByAxis } from "./logic/byAxis.js";

// charts.js 側に「再描画関数」がある場合だけ呼べるように optional で扱う
// 例：export function renderCharts(state) {...}
// 例：export function updateCharts(state) {...}
import * as Charts from "./charts.js";

// ------------------------------------------------------
// 永続化（必要最低限）
// - mode は UIの好みなので localStorage に置ける
// - ただし“無い環境”でも落ちないように try/catch
// ------------------------------------------------------
const LS_KEY_COST_HIST_MODE = "ps.costHistMode";

function loadUiPrefs_() {
  const ui = {};
  try {
    const v = localStorage.getItem(LS_KEY_COST_HIST_MODE);
    if (v === "count" || v === "sales") ui.costHistMode = v;
  } catch (_) {}
  return ui;
}

function saveCostHistMode_(mode) {
  try {
    localStorage.setItem(LS_KEY_COST_HIST_MODE, String(mode));
  } catch (_) {}
}

// ------------------------------------------------------
// 初期 state（本丸）
// ------------------------------------------------------
const initialState = {
  // 生データ
  rows: [],
  summary: null,

  // フィルタ後
  filtered: [],

  // UI / KPI 用
  vm: null,       // buildViewModel の結果
  byAxis: {},     // buildByAxis の結果

  // 中段下段（無罪）の状態
  midAxis: "ジャンル",
  midParentKey: null,
  midSortKey: "sales",
  midSortDir: "desc",

  // 上段（ウィジェット②）の入力を state に持たせる（ここがフェーズ1の本丸）
  ui: {
    // costHistMode: "count" | "sales"
    ...loadUiPrefs_(),
  },

  // フィルタ（例：投入法/ジャンル等）
  filters: {
    // 既存プロジェクトの filters の形に合わせてください
    // ここは「無理に確定させない」：applyFilters が期待するキーだけが効く
  },

  // 更新表示など
  updatedAt: null,
};

// store
const store = createStore(initialState);

// ------------------------------------------------------
// レイアウト mount
// - mounts を保持して、renderAll でまとめて再描画
// ------------------------------------------------------
const root = document.getElementById("app");
const mounts = mountLayout(root, createActions_());

// ------------------------------------------------------
// 起動：データ hydrate → 初回描画
// ------------------------------------------------------
hydrateFromRaw_().catch((e) => {
  console.error("[APP] hydrate failed:", e);
  // ここでUIにエラー表示を出したい場合は render で対応
  renderAll_();
});

// ======================================================
// actions（UI → appへの唯一の入口）
// ======================================================
function createActions_() {
  return {
    // 既存：更新ボタン
    onRefresh: async () => {
      await hydrateFromRaw_();
    },

    // 既存：ドロワー
    onOpenDrawer: () => {
      store.set({ drawerOpen: true });
      renderAll_();
    },
    onCloseDrawer: () => {
      store.set({ drawerOpen: false });
      renderAll_();
    },

    // 既存：中段下段の遷移
    onPickMidAxis: (axisKey) => {
      store.set({ midAxis: axisKey, midParentKey: null });
      renderAll_();
    },
    onPickMidParent: (parentKey) => {
      store.set({ midParentKey: parentKey });
      renderAll_();
    },
    onSetMidSort: (key, dir) => {
      store.set({ midSortKey: key, midSortDir: dir });
      renderAll_();
    },

    // 既存：拡大（focus）
    onOpenFocus: (kind) => {
      // focusOverlay 側の既存実装がある前提
      // kind: "costHist" | "scatter" | ...
      store.set({ focusKind: kind, focusOpen: true });
      renderAll_();
    },
    onCloseFocus: () => {
      store.set({ focusOpen: false });
      renderAll_();
    },

    // --------------------------------------------------
    // ★フェーズ1：ウィジェット②の入力（costHistMode）
    // --------------------------------------------------
    onSetCostHistMode: (mode) => {
      const m = (mode === "sales") ? "sales" : "count";

      const st = store.get();
      store.set({
        ui: {
          ...(st.ui || {}),
          costHistMode: m,
        },
      });

      // 好みなので永続化してもOK（壊れないようにtry/catch済み）
      saveCostHistMode_(m);

      // charts 再描画も含めて確実に更新
      renderAll_();
    },

    // 再描画要求（ウィジェット側から “安全に” 呼べる）
    requestRender: () => {
      renderAll_();
    },

    // フィルタ変更（例：投入法など）
    onSetFilter: (patch) => {
      const st = store.get();
      store.set({
        filters: {
          ...(st.filters || {}),
          ...(patch || {}),
        },
      });
      // フィルタ反映 → 再計算 → 描画
      recalcFromState_();
      renderAll_();
    },
  };
}

// ======================================================
// データ取得 → 集計 → state反映
// ======================================================
async function hydrateFromRaw_() {
  const { rows, summary } = await loadRawData();

  // rows / summary をまず保存
  store.set({
    rows: Array.isArray(rows) ? rows : [],
    summary: summary ?? null,
    updatedAt: Date.now(),
  });

  // フィルタ→集計→保存
  recalcFromState_();

  // 最後に描画
  renderAll_();
}

function recalcFromState_() {
  const st = store.get();

  // フィルタ適用
  const filtered = applyFilters(st.rows || [], st.filters || {});
  // KPI/一覧用のVM
  const vm = buildViewModel(filtered, st.summary);
  // 軸集計
  const byAxis = buildByAxis(filtered);

  store.set({
    filtered,
    vm,
    byAxis,
  });
}

// ======================================================
// 描画（UI + charts）
// - “DOMを作り直さない” ウィジェットは内部で最適化される想定
// ======================================================
function renderAll_() {
  const st = store.get();

  // 上段：トップKPI
  renderTopKpi(mounts, st, actionsProxy_());

  // 中段：KPI 2×2 + 下段（無罪）
  renderMidKpi(mounts, st, actionsProxy_());

  // 下段：詳細/一覧
  renderDetail(mounts, st, actionsProxy_());

  // ドロワー
  renderDrawer(mounts, st, actionsProxy_());

  // charts.js 側：存在する関数だけ呼ぶ（非破壊）
  // ここで state.ui.costHistMode を参照して描画している想定
  try {
    if (typeof Charts.renderCharts === "function") {
      Charts.renderCharts(st);
    } else if (typeof Charts.updateCharts === "function") {
      Charts.updateCharts(st);
    } else if (typeof Charts.render === "function") {
      Charts.render(st);
    }
  } catch (e) {
    console.warn("[APP] charts render failed:", e);
  }
}

// ======================================================
// actions をUIへ渡すラッパ（循環参照を避ける）
// ======================================================
function actionsProxy_() {
  // mountLayout に渡した actions と同じ参照を返したいが、
  // ここでは createActions_() を先に渡しているため、
  // 実体は上の createActions_ が返す actions を閉包で参照する。
  return actions;
}

// createActions_ が返した実体を保持
const actions = createActions_();

// ======================================================
// ここから先：必要なら store.subscribe で自動描画にもできるが、
// いまは「意図したタイミングで renderAll_()」を呼ぶ設計を維持。
// ======================================================
