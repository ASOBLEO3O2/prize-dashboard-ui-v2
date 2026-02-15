// src/ui/focusOverlay.js
console.log("FOCUS_OVERLAY_BUILD 2026-02-15 w2-router");

import { el, clear } from "../utils/dom.js";
import { renderDonut } from "../charts/donut.js?v=20260131";
import { GENRES } from "../constants.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

// ✅ Widget2（拡大後）は widget2CostHist に責務を移す（方針A）
import {
  renderWidget2CostHistFocus,
  destroyWidget2CostHistFocus,
} from "./widget2CostHist.js";

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

  const all = getChart ? null : listInstances();

  canvases.forEach((cv) => {
    try {
      const ch = getChart ? getChart(cv) : all.find((x) => x?.canvas === cv);
      if (ch && typeof ch.destroy === "function") ch.destroy();
    } catch (e) {}
  });
}

export function renderFocusOverlay(overlayEl, modalEl, state, actions) {
  const focus = state?.focus || { open: false };
  if (!overlayEl || !modalEl) return;

  // close
  if (!focus.open) {
    overlayEl.classList.remove("open");

    // ✅ 先に “ウィジェット固有の破棄” を呼ぶ（ここ重要）
    destroyWidget2CostHistFocus?.();

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

  // ✅ widget2 expanded（中身は widget2CostHist.js に委譲）
  if (focus.kind === "costHist") {
    renderWidget2CostHistFocus(body, state, actions);
    return;
  }

  body.appendChild(el("div", { class: "focusPlaceholder", text: "（拡大表示：準備中）" }));
}

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

  const donutWrap = el("div", { class: "focusDonutWrap" }, []);
  const host = el("div", { class: "focusDonutHost" });
  donutWrap.appendChild(host);

  const onPick = (k) => {
    if (!parentKey) actions.onSetFocusParentKey?.(k);
  };

  renderDonut(host, { title, values, pickedKey: null, onPick });

  const legend = el("div", { class: "focusLegend" }, []);
  values.forEach((seg) => {
    legend.appendChild(
      el("button", { class: "focusLegendItem", onClick: () => onPick(seg.key) }, [
        el("span", { class: "legendSwatch", style: `background:${seg.color || "#6dd3fb"}` }),
        el("span", { text: seg.label }),
      ])
    );
  });

  panel.appendChild(el("div", { class: "focusDonutGrid" }, [donutWrap, legend]));
  mount.appendChild(panel);
}

/* ===== view builders ===== */

function buildGenreTopView_(state) {
  const genreTree = Array.isArray(state.byAxis?.["ジャンル"]) ? state.byAxis["ジャンル"] : [];

  const genreMetaByKey = new Map(GENRES.map((g) => [String(g.key), g]));
  const genreMetaByLabel = new Map(GENRES.map((g) => [String(g.label), g]));

  const metaOf = (node) => genreMetaByKey.get(String(node.key)) || genreMetaByLabel.get(String(node.label)) || null;

  const items = genreTree.map((p) => {
    const meta = metaOf(p);
    return {
      key: p.key,
      label: meta?.label || p.label || p.key,
      machines: p.machines ?? 0,
      sales: p.sales ?? 0,
      consume: p.consume ?? 0,
      costRate: p.costRate ?? 0,
      color: meta?.color || null,
      hasChildren: Array.isArray(p.children) && p.children.length > 0,
    };
  });

  items.sort((a, b) => b.sales - a.sales);
  return normalizeShares_(items, { parentLabel: null });
}

function buildGenreChildView_(state, parentKey) {
  const genreTree = Array.isArray(state.byAxis?.["ジャンル"]) ? state.byAxis["ジャンル"] : [];
  const parentNode = genreTree.find((x) => String(x.key) === String(parentKey)) || null;

  const parentLabel = parentNode?.label || String(parentKey);
  const children = Array.isArray(parentNode?.children) ? parentNode.children : [];

  const items = children.map((ch) => ({
    key: ch.key,
    label: ch.label,
    machines: ch.machines ?? 0,
    sales: ch.sales ?? 0,
    consume: ch.consume ?? 0,
    costRate: ch.costRate ?? 0,
    color: null,
    hasChildren: false,
  }));

  return normalizeShares_(items, { parentLabel });
}

function normalizeShares_(items, meta) {
  const totalSales = items.reduce((a, x) => a + (Number(x.sales) || 0), 0);
  const totalMachines = items.reduce((a, x) => a + (Number(x.machines) || 0), 0);

  const out = items.map((x) => {
    const machines = Number(x.machines) || 0;
    const sales = Number(x.sales) || 0;
    return {
      ...x,
      salesShare: totalSales > 0 ? sales / totalSales : 0,
      machineShare: totalMachines > 0 ? machines / totalMachines : 0,
    };
  });

  return { ...meta, items: out };
}
