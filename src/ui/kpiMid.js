// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";
import { GENRES } from "../constants.js";

import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

/**
 * 役割：
 * - 中段カードを描画
 *   - ✅ ウィジェット①（売上/ブース 構成比）← ここに統一（旧ドーナツ2枚は廃止）
 *   - 原価率分布（canvas器）
 *   - 散布図（canvas器）
 * - 下段（midCardsMount）は既存仕様のまま（無罪）
 *
 * 注意：
 * - chart（ヒスト/散布）の描画更新は charts.js 側が担当。
 *   ここでは「カード枠＋canvasの器」までを用意する。
 */
export function renderMidKpi(mounts, state, actions) {
  // ========= ここが統一ポイント =========
  // 旧：売上ドーナツ + マシンドーナツ（2枚）
  // 新：ウィジェット①（1枚）に統合
  renderWidgetCard_(mounts.midSlotSalesDonut, state, actions);

  // 旧「マシン構成比」スロットは邪魔なので完全に消す（余白も残さない）
  if (mounts.midSlotMachineDonut) {
    clear(mounts.midSlotMachineDonut);
    mounts.midSlotMachineDonut.style.display = "none";
  }

  // ========= 既存：原価率分布 =========
  renderChartCard_(mounts.midSlotCostHist, {
    title: "原価率 分布",
    tools: el("div", { class: "chartTools" }, [
      el("select", { class: "select", id: "costHistMode" }, [
        el("option", { value: "count", text: "台数" }),
        el("option", { value: "sales", text: "売上" }),
      ])
    ]),
    canvasId: "costHistChart",
    onFocus: () => actions.onOpenFocus?.("costHist"),
  });

  // ========= 既存：散布図 =========
  renderChartCard_(mounts.midSlotScatter, {
    title: "売上 × 原価率（マトリクス）",
    tools: null,
    canvasId: "salesCostScatter",
    onFocus: () => actions.onOpenFocus?.("scatter"),
  });

  // ========= 下段（既存の一覧カード：無罪） =========
  renderLowerCards_(mounts.midCards, state, actions);
}

/* =========================
   上段：ウィジェット①カード（統一）
   ========================= */

function renderWidgetCard_(slotMount, state, actions) {
  if (!slotMount) return;
  clear(slotMount);

  // 旧と同じカード枠を使って見た目を統一（邪魔にならない）
  const card = el("div", { class: "card midPanel" });

  // ウィジェット側にヘッダー/セレクト/拡大ボタンを持たせるので、
  // ここは body だけ用意して丸ごと描画する
  const body = el("div", { class: "midPanelBody" });

  card.appendChild(body);
  slotMount.appendChild(card);

  // ✅ ここが「中段KPI＝ウィジェット①」
  // normal 内の「拡大」ボタンは widget 側が actions.onOpenFocus("shareDonut") を呼ぶ想定
  renderWidget1ShareDonut(body, state, actions, { mode: "normal" });
}

/* =========================
   上段：チャートカード（器）
   ========================= */

function renderChartCard_(slotMount, { title, tools, canvasId, onFocus }) {
  if (!slotMount) return;
  clear(slotMount);

  // もし前回 display:none にしたスロットがあっても、他カードは表示する
  slotMount.style.display = "";

  const card = el("div", { class: "card midPanel" });

  const headerRight = el("div", { style: "display:flex; align-items:center; gap:10px;" }, []);
  if (tools) headerRight.appendChild(tools);
  headerRight.appendChild(el("button", {
    class: "btn ghost midPanelBtn",
    text: "拡大",
    onClick: (e) => { e.preventDefault(); onFocus?.(); }
  }));

  const header = el("div", { class: "midPanelHeader" }, [
    el("div", { class: "midPanelTitleWrap" }, [
      el("div", { class: "midPanelTitle", text: title }),
      el("div", { class: "midPanelSub", text: "" }),
    ]),
    headerRight
  ]);

  const body = el("div", { class: "midPanelBody chartBody", onClick: () => onFocus?.() }, [
    el("canvas", { id: canvasId })
  ]);

  card.appendChild(header);
  card.appendChild(body);
  slotMount.appendChild(card);
}

/* =========================
   下段（無罪：そのまま）
   ========================= */

function renderLowerCards_(cardsMount, state, actions) {
  const axis = state.midAxis || "ジャンル";
  const parentKey = state.midParentKey || null;

  const view = buildMidView_(state, axis, parentKey);

  clear(cardsMount);

  const grid = el("div", { class: "midCards" });

  if (view.level === "child") {
    grid.appendChild(el("div", { class: "card genreCard", style: "padding:12px; cursor:default;" }, [
      el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:10px;" }, [
        el("div", { style: "font-weight:900;", text: `内訳：${view.parentLabel}` }),
        el("button", {
          class: "btn",
          text: "上層にもどる",
          onClick: (e) => {
            e.preventDefault();
            actions.onPickMidParent?.(null);
          }
        }),
      ])
    ]));
  }

  const sortKey = state.midSortKey || "sales";
  const sortDir = state.midSortDir || "desc";
  const items = sortItems_(view.items, sortKey, sortDir);

  for (const it of items) {
    const card = el("div", { class: "card genreCard" });

    card.addEventListener("click", () => {
      if (view.level === "parent" && it.hasChildren) actions.onPickMidParent?.(it.key);
    });

    card.appendChild(el("div", { class: "genreCardHeader" }, [
      el("div", { class: "genreName", text: it.label }),
      el("div", { class: "smallMeta", text: (view.level === "parent") ? "クリックで内訳" : "内訳" }),
    ]));

    card.appendChild(el("div", { class: "metricGrid" }, [
      metric("台数", `${it.machines ?? 0}台`),
      metric("売上", fmtYen(it.sales ?? 0)),
      metric("消化額", fmtYen(it.consume ?? 0)),
      metric("原価率", fmtPct(it.costRate ?? 0, 1)),
      metric("売上構成比", fmtPct(it.salesShare ?? 0, 1)),
      metric("マシン構成比", fmtPct(it.machineShare ?? 0, 1)),
      metric("平均売り上げ", fmtYen(it.avgSales ?? 0)),
    ]));

    grid.appendChild(card);
  }

  cardsMount.appendChild(grid);
}

/* =========================
   view builder（下段用：既存）
   ========================= */

function buildMidView_(state, axis, parentKey) {
  if (axis !== "ジャンル") {
    const items = (Array.isArray(state.byAxis?.[axis]) ? state.byAxis[axis] : []).map(x => ({
      key: x.key,
      label: x.label,
      machines: x.machines ?? 0,
      sales: x.sales ?? 0,
      consume: x.consume ?? 0,
      costRate: x.costRate ?? 0,
      color: null,
      hasChildren: false,
    }));
    return normalizeShares_(items, {
      level: "parent",
      parentLabel: axis,
    });
  }

  const genreTree = Array.isArray(state.byAxis?.["ジャンル"]) ? state.byAxis["ジャンル"] : [];

  const genreMetaByKey = new Map(GENRES.map(g => [String(g.key), g]));
  const genreMetaByLabel = new Map(GENRES.map(g => [String(g.label), g]));

  const metaOf = (node) => {
    return genreMetaByKey.get(String(node.key)) ||
      genreMetaByLabel.get(String(node.label)) ||
      null;
  };

  if (!parentKey) {
    const items = genreTree.map(p => {
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

    items.sort((a, b) => (b.sales - a.sales));

    return normalizeShares_(items, {
      level: "parent",
      parentLabel: null,
    });
  }

  const parentNode = genreTree.find(x => String(x.key) === String(parentKey)) || null;

  const parentMeta = parentNode ? metaOf(parentNode) : null;
  const parentLabel = parentMeta?.label || parentNode?.label || String(parentKey);

  const children = Array.isArray(parentNode?.children) ? parentNode.children : [];

  const items = children.map(ch => ({
    key: ch.key,
    label: ch.label,
    machines: ch.machines ?? 0,
    sales: ch.sales ?? 0,
    consume: ch.consume ?? 0,
    costRate: ch.costRate ?? 0,
    color: parentMeta?.color || null,
    hasChildren: false,
  }));

  return normalizeShares_(items, {
    level: "child",
    parentLabel,
  });
}

function normalizeShares_(items, meta) {
  const totalSales = items.reduce((a, x) => a + (Number(x.sales) || 0), 0);
  const totalMachines = items.reduce((a, x) => a + (Number(x.machines) || 0), 0);

  const out = items.map(x => {
    const machines = Number(x.machines) || 0;
    const sales = Number(x.sales) || 0;
    const avgSales = machines > 0 ? (sales / machines) : 0;

    return {
      ...x,
      salesShare: totalSales > 0 ? (sales / totalSales) : 0,
      machineShare: totalMachines > 0 ? (machines / totalMachines) : 0,
      avgSales,
    };
  });

  return { ...meta, items: out };
}

/* =========================
   helpers
   ========================= */

function metric(label, value) {
  return el("div", { class: "metric" }, [
    el("div", { class: "label", text: label }),
    el("div", { class: "value", text: value, style: "white-space:nowrap;" }),
  ]);
}

function sortItems_(items, key, dir) {
  const sign = (dir === "asc") ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = pick_(a, key);
    const bv = pick_(b, key);
    if (av === bv) return 0;
    return (av < bv ? -1 : 1) * sign;
  });
}

function pick_(x, key) {
  if (key === "sales") return Number(x.sales) || 0;
  if (key === "consume") return Number(x.consume) || 0;
  if (key === "costRate") return Number(x.costRate) || 0;
  if (key === "machines") return Number(x.machines) || 0;
  if (key === "avgSales") return Number(x.avgSales) || 0;
  return 0;
}
