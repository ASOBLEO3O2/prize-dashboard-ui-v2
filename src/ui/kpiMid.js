// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";
import { GENRES } from "../constants.js";

import { renderMidSlot } from "./renderMidSlot.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

/**
 * 役割：
 * - 中段カード（4枠）を描画
 * - ドロワーの割当（state.midSlots / midSlotsDraft）に従って描き分け
 * - スロットの「器」は同一typeの間は再生成しない（renderMidSlot）
 * - 下段（midCardsMount）は既存仕様のまま
 *
 * 想定 slotType:
 *  - "widget1"
 *  - "widget2"（原価率分布：canvas器）
 *  - "scatter"（売上×原価率：canvas器）
 *  - "dummyA" "dummyB" "dummyC" "dummyD"
 */
export function renderMidKpi(mounts, state, actions) {
  const slotMounts = [
    mounts.midSlotSalesDonut,
    mounts.midSlotMachineDonut,
    mounts.midSlotCostHist,
    mounts.midSlotScatter,
  ];

  const fallback = ["widget1", "widget2", "dummyA", "dummyB"];
  const slotsFixed = norm4_(state.midSlots, fallback);

  // ✅ ドロワーを開いてる間は draft を即プレビュー
  const slotsDraft = norm4_(state.midSlotsDraft, slotsFixed);
  const slots = state.drawerOpen ? slotsDraft : slotsFixed;

  for (let i = 0; i < 4; i++) {
    const mount = slotMounts[i];
    const type = slots[i] || "dummyA";
    if (!mount) continue;
    renderMidSlotByType_(mount, type, state, actions, i);
  }

  // ===== 下段（既存のまま）=====
  renderLowerCards_(mounts.midCards, state, actions);
}

function norm4_(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}

function renderMidSlotByType_(mount, type, state, actions, idx) {
  switch (type) {
    case "widget1": {
      // widget1 は自前でヘッダーを持つので外側ヘッダー不要
      renderMidSlot(mount, {
        slotKey: type,
        noHeader: true,
        renderBody: (body) => {
          renderWidget1ShareDonut(body, state, actions, { mode: "normal" });
        },
      });
      return;
    }

    case "widget2": {
      // 原価率分布（ヒスト）＝ canvas器だけ保証（Chart.js実体は charts.js）
      const tools = el("select", { class: "select", id: "costHistMode" }, [
        el("option", { value: "count", text: "台数" }),
        el("option", { value: "sales", text: "売上" }),
      ]);

      renderMidSlot(mount, {
        slotKey: type,
        title: "原価率 分布",
        tools,
        onFocus: () => actions.onOpenFocus?.("costHist"),
        renderBody: (body) => {
          // chart用のCSSを当てる
          body.classList.add("chartBody");

          if (!body.__costCanvas) {
            clear(body);
            const c = el("canvas", { id: "costHistChart" });
            body.appendChild(c);
            body.__costCanvas = c;
          }
        },
      });
      return;
    }

    case "scatter": {
      renderMidSlot(mount, {
        slotKey: type,
        title: "売上 × 原価率",
        onFocus: () => actions.onOpenFocus?.("scatter"),
        renderBody: (body) => {
          body.classList.add("chartBody");

          if (!body.__scatterCanvas) {
            clear(body);
            const c = el("canvas", { id: "salesCostScatter" });
            body.appendChild(c);
            body.__scatterCanvas = c;
          }
        },
      });
      return;
    }

    case "dummyA":
    case "dummyB":
    case "dummyC":
    case "dummyD":
    default: {
      renderMidSlot(mount, {
        slotKey: type,
        title: dummyTitle_(type, idx),
        onFocus: () => actions?.onOpenFocus?.({ slotIndex: idx, slotType: type }),
        renderBody: (body) => {
          clear(body);
          body.appendChild(el("div", { class: "placeholder", text: `${type} placeholder` }));
        },
      });
      return;
    }
  }
}

function dummyTitle_(type, idx) {
  const map = {
    dummyA: "ダミー①",
    dummyB: "ダミー②",
    dummyC: "ダミー③",
    dummyD: "ダミー④",
  };
  return map[type] || `ダミー(${idx + 1})`;
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
    grid.appendChild(
      el(
        "div",
        { class: "card genreCard", style: "padding:12px; cursor:default;" },
        [
          el(
            "div",
            { style: "display:flex; align-items:center; justify-content:space-between; gap:10px;" },
            [
              el("div", { style: "font-weight:900;", text: `内訳：${view.parentLabel}` }),
              el("button", {
                class: "btn",
                text: "上層にもどる",
                onClick: (e) => {
                  e.preventDefault();
                  actions.onPickMidParent?.(null);
                },
              }),
            ]
          ),
        ]
      )
    );
  }

  const sortKey = state.midSortKey || "sales";
  const sortDir = state.midSortDir || "desc";
  const items = sortItems_(view.items, sortKey, sortDir);

  for (const it of items) {
    const card = el("div", { class: "card genreCard" });

    card.addEventListener("click", () => {
      if (view.level === "parent" && it.hasChildren) {
        actions.onPickMidParent?.(it.key);
      }
    });

    card.appendChild(
      el("div", { class: "genreCardHeader" }, [
        el("div", { class: "genreName", text: it.label }),
        el("div", {
          class: "smallMeta",
          text: view.level === "parent" ? "クリックで内訳" : "内訳",
        }),
      ])
    );

    card.appendChild(
      el("div", { class: "metricGrid" }, [
        metric("台数", `${it.machines ?? 0}台`),
        metric("売上", fmtYen(it.sales ?? 0)),
        metric("消化額", fmtYen(it.consume ?? 0)),
        metric("原価率", fmtPct(it.costRate ?? 0, 1)),
        metric("売上構成比", fmtPct(it.salesShare ?? 0, 1)),
        metric("マシン構成比", fmtPct(it.machineShare ?? 0, 1)),
        metric("平均売り上げ", fmtYen(it.avgSales ?? 0)),
      ])
    );

    grid.appendChild(card);
  }

  cardsMount.appendChild(grid);
}

function buildMidView_(state, axis, parentKey) {
  if (axis !== "ジャンル") {
    const items = (Array.isArray(state.byAxis?.[axis]) ? state.byAxis[axis] : []).map((x) => ({
      key: x.key,
      label: x.label,
      machines: x.machines ?? 0,
      sales: x.sales ?? 0,
      consume: x.consume ?? 0,
      costRate: x.costRate ?? 0,
      color: null,
      hasChildren: false,
    }));
    return normalizeShares_(items, { level: "parent", parentLabel: axis });
  }

  const genreTree = Array.isArray(state.byAxis?.["ジャンル"]) ? state.byAxis["ジャンル"] : [];
  const genreMetaByKey = new Map(GENRES.map((g) => [String(g.key), g]));
  const genreMetaByLabel = new Map(GENRES.map((g) => [String(g.label), g]));

  const metaOf = (node) =>
    genreMetaByKey.get(String(node.key)) ||
    genreMetaByLabel.get(String(node.label)) ||
    null;

  if (!parentKey) {
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
    return normalizeShares_(items, { level: "parent", parentLabel: null });
  }

  const parentNode = genreTree.find((x) => String(x.key) === String(parentKey)) || null;
  const parentMeta = parentNode ? metaOf(parentNode) : null;
  const parentLabel = parentMeta?.label || parentNode?.label || String(parentKey);

  const children = Array.isArray(parentNode?.children) ? parentNode.children : [];
  const items = children.map((ch) => ({
    key: ch.key,
    label: ch.label,
    machines: ch.machines ?? 0,
    sales: ch.sales ?? 0,
    consume: ch.consume ?? 0,
    costRate: ch.costRate ?? 0,
    color: parentMeta?.color || null,
    hasChildren: false,
  }));

  return normalizeShares_(items, { level: "child", parentLabel });
}

function normalizeShares_(items, meta) {
  const totalSales = items.reduce((a, x) => a + (Number(x.sales) || 0), 0);
  const totalMachines = items.reduce((a, x) => a + (Number(x.machines) || 0), 0);

  const out = items.map((x) => {
    const machines = Number(x.machines) || 0;
    const sales = Number(x.sales) || 0;
    const avgSales = machines > 0 ? sales / machines : 0;

    return {
      ...x,
      salesShare: totalSales > 0 ? sales / totalSales : 0,
      machineShare: totalMachines > 0 ? machines / totalMachines : 0,
      avgSales,
    };
  });

  return { ...meta, items: out };
}

function metric(label, value) {
  return el("div", { class: "metric" }, [
    el("div", { class: "label", text: label }),
    el("div", { class: "value", text: value, style: "white-space:nowrap;" }),
  ]);
}

function sortItems_(items, key, dir) {
  const sign = dir === "asc" ? 1 : -1;
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
