// src/ui/focusOverlay.js
console.log("FOCUS_OVERLAY_BUILD 2026-02-15 w3-router");

import { el, clear } from "../utils/dom.js";
import { renderDonut } from "../charts/donut.js?v=20260131";
import { GENRES } from "../constants.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

// ✅ Widget2（拡大後）
import {
  renderWidget2CostHistFocus,
  destroyWidget2CostHistFocus,
} from "./widget2CostHist.js";

// ✅ Widget3（拡大後）
import {
  renderWidget3ScatterFocus,
  destroyWidget3ScatterFocus,
} from "./widget3Scatter.js";

/**
 * modalEl 配下の Chart.js を破棄（DOM clear だけでは Chart が残るため）
 * - Chart.getChart(canvas) が使える場合はそれを優先
 * - だめなら Chart.instances から拾う（互換）
 */
function destroyChartsUnder_(rootEl) {
  const Chart = window.Chart;
  if (!Chart || !rootEl) return;

  const canvases = rootEl.querySelectorAll?.("canvas");
  if (!canvases || canvases.length === 0) return;

  const getChart = typeof Chart.getChart === "function" ? (c) => Chart.getChart(c) : null;

  const listInstances = () => {
    const inst = Chart.instances;
    if (!inst) return [];
    if (Array.isArray(inst)) return inst.filter(Boolean);
    if (inst instanceof Map) return Array.from(inst.values()).filter(Boolean);
    if (typeof inst === "object") return Object.values(inst).filter(Boolean);
    return [];
  };

  for (const c of canvases) {
    let chart = null;
    if (getChart) chart = getChart(c);
    if (!chart) {
      const all = listInstances();
      chart = all.find((x) => x?.canvas === c) || null;
    }
    if (chart?.destroy) {
      try { chart.destroy(); } catch (e) {}
    }
  }
}

export function renderFocusOverlay(overlayEl, modalEl, state, actions) {
  const focus = state?.focus || { open: false };
  if (!overlayEl || !modalEl) return;

  // close
  if (!focus.open) {
    overlayEl.classList.remove("open");

    // ✅ 先に “ウィジェット固有の破棄”
    destroyWidget2CostHistFocus?.();
    destroyWidget3ScatterFocus?.();

    // ✅ その後、modal配下のChartも一掃
    destroyChartsUnder_(modalEl);

    clear(modalEl);
    document.body.style.overflow = "";

    overlayEl.onclick = null;
    return;
  }

  // open
  overlayEl.classList.add("open");

  // open時も掃除（残骸保険）
  destroyWidget2CostHistFocus?.();
  destroyWidget3ScatterFocus?.();
  destroyChartsUnder_(modalEl);
  clear(modalEl);

  document.body.style.overflow = "hidden";

  overlayEl.onclick = (e) => {
    if (e.target === overlayEl) actions.onCloseFocus?.();
  };

  const header = el("div", { class: "focusHeader" }, [
    el("button", {
      class: "btn ghost",
      text: "← 戻る",
      onClick: () => actions.onCloseFocus?.(),
    }),
    el("div", { class: "focusTitle", text: focus.title || "詳細" }),
    el("button", { class: "btn ghost", text: "×", onClick: () => actions.onCloseFocus?.() }),
  ]);

  const body = el("div", { class: "focusBody" });
  modalEl.appendChild(header);
  modalEl.appendChild(body);

  // ✅ widget1 expanded
  if (focus.kind === "shareDonut") {
    renderWidget1ShareDonut(body, state, actions, { mode: "expanded" });
    return;
  }

  // ✅ existing donuts
  if (focus.kind === "salesDonut" || focus.kind === "machineDonut") {
    renderDonutFocus_(body, state, focus, actions);
    return;
  }

  // ✅ widget2 expanded
  if (focus.kind === "costHist") {
    renderWidget2CostHistFocus(body, state, actions);
    return;
  }

  // ✅ widget3 expanded
  if (focus.kind === "scatter") {
    renderWidget3ScatterFocus(body, state, actions);
    return;
  }

  body.appendChild(el("div", { class: "focusPlaceholder", text: "（拡大表示：準備中）" }));
}

/* ====== 以下：既存ドーナツ拡大（そのまま） ====== */

function renderDonutFocus_(mount, state, focus, actions) {
  const top = buildGenreTopView_(state);
  const parentKey = focus.parentKey || null;

  const view = parentKey ? buildGenreChildView_(state, parentKey) : top;

  const title = focus.kind === "salesDonut" ? "売上構成比" : "マシン構成比";
  const note = parentKey ? `内訳：${view.parentLabel}` : "ジャンル別（%）";

  const values = view.items.map((x) => ({
    key: x.key,
    label: x.label,
    value: focus.kind === "salesDonut" ? x.salesShare : x.machineShare,
    color: x.color || null,
  }));

  const nav = el("div", { class: "focusNav" }, []);
  if (parentKey) {
    nav.appendChild(el("div", { class: "focusCrumb", text: `内訳：${view.parentLabel}` }));
    nav.appendChild(
      el("button", {
        class: "btn",
        text: "上層に戻る",
        onClick: () => actions.onSetFocusParentKey?.(null),
      })
    );
  } else {
    nav.appendChild(el("div", { class: "focusCrumb", text: "ジャンル（上層）" }));
    nav.appendChild(el("div", { class: "focusHint", text: "セグメントをタップで内訳へ" }));
  }

  const panel = el("div", { class: "focusPanel" }, [
    el("div", { class: "focusPanelTop" }, [
      el("div", { class: "focusPanelTitle", text: title }),
      el("div", { class: "focusPanelNote", text: note }),
    ]),
    nav,
  ]);

  const grid = el("div", { class: "focusDonutGrid" }, [
    el("div", { class: "focusDonutWrap" }, [
      el("div", { class: "focusDonutCanvasWrap" }, [
        el("canvas", { id: "focusDonut" }),
      ]),
    ]),
    el("div", { class: "focusLegend" }, []),
  ]);

  panel.appendChild(grid);
  mount.appendChild(panel);

  const canvas = grid.querySelector("#focusDonut");
  const legend = grid.querySelector(".focusLegend");

  renderDonut(canvas, legend, values, {
    mode: "expanded",
    onClick: (seg) => {
      if (!seg) return;
      if (parentKey) return;
      actions.onSetFocusParentKey?.(seg.key);
    },
  });
}

function buildGenreTopView_(state) {
  const vm = state?.vm || {};
  const byGenre = vm.byGenre || [];
  const totalSales = vm.totalSales || 0;
  const totalMachines = vm.totalMachines || 0;

  const items = byGenre.map((g) => {
    const sales = g.sales || 0;
    const machines = g.machines || 0;
    return {
      key: g.key,
      label: g.label,
      color: g.color || null,
      salesShare: totalSales ? sales / totalSales : 0,
      machineShare: totalMachines ? machines / totalMachines : 0,
    };
  });

  return { items, parentLabel: null };
}

function buildGenreChildView_(state, parentKey) {
  const axis = state?.axis || {};
  const child = axis.children?.[parentKey] || [];
  const parentLabel = GENRES?.[parentKey] || parentKey;

  const totalSales = child.reduce((a, x) => a + (x.sales || 0), 0);
  const totalMachines = child.reduce((a, x) => a + (x.machines || 0), 0);

  const items = child.map((x) => ({
    key: x.key,
    label: x.label,
    color: x.color || null,
    salesShare: totalSales ? (x.sales || 0) / totalSales : 0,
    machineShare: totalMachines ? (x.machines || 0) / totalMachines : 0,
  }));

  return { items, parentLabel };
}
