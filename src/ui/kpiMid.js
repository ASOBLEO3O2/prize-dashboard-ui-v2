// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";
import { renderDonut } from "../charts/donut.js";
import { GENRES } from "../constants.js";

export function renderMidKpi(donutsMount, cardsMount, state, actions) {
  const axis = state.midAxis || "ジャンル";
  const parentKey = state.midParentKey || null;

  // ===== この画面で使う「表示リスト」を決める（上層 or 下層） =====
  const view = buildMidView_(state, axis, parentKey);

  // ===== Donuts（この view に連動） =====
  clear(donutsMount);

  const donuts = el("div", { class: "donuts" });

  donuts.appendChild(donutPanel({
    title: "売上構成比",
    note: view.noteSales,
    values: view.items.map((x, idx) => ({
      key: x.key,
      label: x.label,
      value: x.salesShare,
      color: x.color || null,
    })),
    pickedKey: null,
    onPick: (k) => {
      if (view.level === "parent") actions.onPickMidParent?.(k);
    },
  }));

  donuts.appendChild(donutPanel({
    title: "マシン構成比",
    note: view.noteMachines,
    values: view.items.map((x, idx) => ({
      key: x.key,
      label: x.label,
      value: x.machineShare,
      color: x.color || null,
    })),
    pickedKey: null,
    onPick: (k) => {
      if (view.level === "parent") actions.onPickMidParent?.(k);
    },
  }));

  donutsMount.appendChild(donuts);

  // ===== Cards =====
  clear(cardsMount);

  const grid = el("div", { class: "midCards" });

  // 下層表示のときは戻るUI
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

  // 並び替え
  const sortKey = state.midSortKey || "sales";
  const sortDir = state.midSortDir || "desc";
  const items = sortItems_(view.items, sortKey, sortDir);

  for (const it of items) {
    const card = el("div", { class: "card genreCard" });

    // 上層：クリックで下層へ
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
   view builder（上層/下層の決定）
   ========================= */

function buildMidView_(state, axis, parentKey) {
  // axis がジャンル以外は現状そのまま（ドリルは後で）
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
      noteSales: `${axis}別（%）`,
      noteMachines: `${axis}別（%）`,
    });
  }

  // ===== ここから「ジャンル」：必ず byAxis を唯一のソースにする =====
  const genreTree = Array.isArray(state.byAxis?.["ジャンル"]) ? state.byAxis["ジャンル"] : [];

  // GENRES は色/表示名の補助（key/label どちらでも引けるようにする）
  const genreMetaByKey = new Map(GENRES.map(g => [String(g.key), g]));
  const genreMetaByLabel = new Map(GENRES.map(g => [String(g.label), g]));

  const metaOf = (node) => {
    return genreMetaByKey.get(String(node.key)) ||
           genreMetaByLabel.get(String(node.label)) ||
           null;
  };

  // ===== ジャンル：上層 =====
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

    // 可能なら GENRES の順番に寄せる（未知のジャンルは後ろ）
    items.sort((a, b) => {
      const ai = GENRES.findIndex(g => String(g.key) === String(a.key) || String(g.label) === String(a.label));
      const bi = GENRES.findIndex(g => String(g.key) === String(b.key) || String(g.label) === String(b.label));
      const aa = (ai === -1) ? 9999 : ai;
      const bb = (bi === -1) ? 9999 : bi;
      if (aa !== bb) return aa - bb;
      // 同順位なら売上降順
      return (b.sales - a.sales);
    });

    return normalizeShares_(items, {
      level: "parent",
      parentLabel: null,
      noteSales: "ジャンル別（%）",
      noteMachines: "ジャンル別（%）",
    });
  }

  // ===== ジャンル：下層 =====
  // 親は「キー一致」だけで拾う（label一致は誤爆するので禁止）
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
    noteSales: `${parentLabel} 内訳（%）`,
    noteMachines: `${parentLabel} 内訳（%）`,
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
   donut ui
   ========================= */

function donutPanel({ title, note, values, pickedKey, onPick }) {
  const panel = el("div", { class: "donutPanel" });

  const host = el("div", {
    style: "width:170px;height:170px;flex:0 0 170px;display:flex;align-items:center;justify-content:center;overflow:visible;"
  });

  const meta = el("div", { class: "donutMeta" }, [
    el("div", { class: "title", text: title }),
    el("div", { class: "note", text: note }),
    legend(values, pickedKey, onPick),
  ]);

  panel.appendChild(host);
  panel.appendChild(meta);

  renderDonut(host, { title, values, pickedKey, onPick });

  return panel;
}

function legend(values, pickedKey, onPick) {
  const box = el("div", { class: "legend" });
  const fallback = ["#6dd3fb", "#7ee081", "#f2c14e", "#b28dff", "#ff6b6b"];

  values.forEach((seg, idx) => {
    const dim = (pickedKey && pickedKey !== seg.key);

    const sw = el("span", { class: "legendSwatch" });
    sw.style.backgroundColor = seg.color || fallback[idx % fallback.length];

    const label = el("span", { text: seg.label });

    const item = el("div", {
      class: "legendItem",
      style: dim ? "opacity:.35;" : ""
    }, [sw, label]);

    item.addEventListener("click", (e) => {
      e.preventDefault();
      const next = seg.key;
      onPick?.(next);
    });

    box.appendChild(item);
  });

  return box;
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
