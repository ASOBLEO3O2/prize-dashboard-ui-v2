// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";
import { GENRES } from "../constants.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

/**
 * 役割：
 * - 中段 2×2 を「スロット割当（state.midSlots）」で描画
 *   - widget1: 構成比ドーナツ（既存）
 *   - widget2: 原価率分布（既存 canvas: costHistChart + select: costHistMode）
 *   - dummyA〜dummyD: ダミーカード
 *
 * 重要：
 * - slot（#midDash > *）のDOMは作り直さない（高さ・Chart初期化崩れ防止）
 * - 各スロット内のカードDOMも「同じ種類なら再利用」。種類が変わったら中身だけ差し替え。
 */
export function renderMidKpi(mounts, state, actions) {
  // 4枠の実体（layout.jsで固定）
  const slotMounts = [
    mounts.midSlotSalesDonut,
    mounts.midSlotMachineDonut,
    mounts.midSlotCostHist,
    mounts.midSlotScatter,
  ].filter(Boolean);

  // state から割当を読む（無ければデフォルト）
  const slots = normalizeSlots_(state?.midSlots);

  // 4枠を順に描画
  for (let i = 0; i < 4; i++) {
    const slotMount = slotMounts[i];
    if (!slotMount) continue;
    renderMidSlot_(slotMount, slots[i], state, actions);
  }

  // 下段（無罪）
  renderLowerCards_(mounts.midCards, state, actions);
}

/* =========================
   midSlots（4要素）正規化
   ========================= */
function normalizeSlots_(arr) {
  const fallback = ["widget1", "widget2", "dummyA", "dummyB"];
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback;
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}

/* =========================
   1スロット描画（種類切替対応）
   ========================= */
function renderMidSlot_(slotMount, key, state, actions) {
  // 同じkeyなら「中身更新」だけで済む（DOM安定）
  if (slotMount.__slotKey !== key) {
    // 種類が変わったらカードを作り直す（ただしスロット自体は残す）
    clear(slotMount);
    slotMount.__slotKey = key;

    // keyごとに器を作る
    if (key === "widget1") {
      buildCardShell_(slotMount, { title: "構成比（ドーナツ）", withHeader: false });
      // widget1は body を保持しておく（renderで中身更新）
      slotMount.__w1_body = slotMount.querySelector(".midPanelBody");
      return; // 初回はここで終了（次のrenderで中身が乗る）
    }

    if (key === "widget2") {
      // 原価率分布（canvas器＋モードselect）
      buildChartCard_(slotMount, {
        title: "原価率 分布",
        tools: el("div", { class: "chartTools" }, [
          el("select", { class: "select", id: "costHistMode" }, [
            el("option", { value: "count", text: "台数" }),
            el("option", { value: "sales", text: "売上" }),
          ]),
        ]),
        canvasId: "costHistChart",
        onFocus: () => actions.onOpenFocus?.("costHist"),
      });
      return;
    }

    // dummy
    buildDummyCard_(slotMount, key);
    return;
  }

  // ========= 同じkeyなら更新 =========
  if (key === "widget1") {
    // 初回build直後でも安全に再取得
    const body = slotMount.__w1_body || slotMount.querySelector(".midPanelBody");
    if (!body) return;
    slotMount.__w1_body = body;
    renderWidget1ShareDonut(body, state, actions, { mode: "normal" });
    return;
  }

  // widget2 は canvas で charts.js が描くので、ここでは何もしない
  // dummy も中身固定
}

/* =========================
   カードの共通シェル
   ========================= */
function buildCardShell_(slotMount, { title, withHeader = true, tools = null, onFocus = null } = {}) {
  const card = el("div", { class: "card midPanel" });

  if (withHeader) {
    const headerRight = el(
      "div",
      { style: "display:flex; align-items:center; gap:10px;" },
      []
    );
    if (tools) headerRight.appendChild(tools);
    if (onFocus) {
      headerRight.appendChild(
        el("button", {
          class: "btn ghost midPanelBtn",
          text: "拡大",
          onClick: (e) => {
            e.preventDefault();
            onFocus?.();
          },
        })
      );
    }

    const header = el("div", { class: "midPanelHeader" }, [
      el("div", { class: "midPanelTitleWrap" }, [
        el("div", { class: "midPanelTitle", text: title || "" }),
        el("div", { class: "midPanelSub", text: "" }),
      ]),
      headerRight,
    ]);
    card.appendChild(header);
  }

  const body = el("div", { class: "midPanelBody" });
  card.appendChild(body);

  slotMount.appendChild(card);
}

function buildChartCard_(slotMount, { title, tools, canvasId, onFocus }) {
  const card = el("div", { class: "card midPanel" });

  const headerRight = el(
    "div",
    { style: "display:flex; align-items:center; gap:10px;" },
    []
  );
  if (tools) headerRight.appendChild(tools);
  headerRight.appendChild(
    el("button", {
      class: "btn ghost midPanelBtn",
      text: "拡大",
      onClick: (e) => {
        e.preventDefault();
        onFocus?.();
      },
    })
  );

  const header = el("div", { class: "midPanelHeader" }, [
    el("div", { class: "midPanelTitleWrap" }, [
      el("div", { class: "midPanelTitle", text: title }),
      el("div", { class: "midPanelSub", text: "" }),
    ]),
    headerRight,
  ]);

  const body = el(
    "div",
    { class: "midPanelBody chartBody", onClick: () => onFocus?.() },
    [el("canvas", { id: canvasId })]
  );

  card.appendChild(header);
  card.appendChild(body);
  slotMount.appendChild(card);
}

function buildDummyCard_(slotMount, key) {
  // ダミーは “高さ確認用” なので、派手にしない
  const title =
    key === "dummyA" ? "ダミーA" :
    key === "dummyB" ? "ダミーB" :
    key === "dummyC" ? "ダミーC" :
    key === "dummyD" ? "ダミーD" :
    `ダミー`;

  const card = el("div", { class: "card midPanel" });

  const header = el("div", { class: "midPanelHeader" }, [
    el("div", { class: "midPanelTitleWrap" }, [
      el("div", { class: "midPanelTitle", text: title }),
      el("div", { class: "midPanelSub", text: "placeholder" }),
    ]),
    el("div", {}, [
      el("button", { class: "btn ghost midPanelBtn", text: "拡大", onClick: (e) => e.preventDefault() }),
    ]),
  ]);

  const body = el("div", { class: "midPanelBody" }, [
    el("div", {
      style:
        "height:100%; min-height:0; display:flex; align-items:center; justify-content:center; opacity:.55; border:1px dashed rgba(148,163,184,.45); border-radius:12px;",
      text: `${key} placeholder`,
    }),
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
    grid.appendChild(
      el(
        "div",
        { class: "card genreCard", style: "padding:12px; cursor:default;" },
        [
          el("div", {
            style:
              "display:flex; align-items:center; justify-content:space-between; gap:10px;",
          }, [
            el("div", {
              style: "font-weight:900;",
              text: `内訳：${view.parentLabel}`,
            }),
            el("button", {
              class: "btn",
              text: "上層にもどる",
              onClick: (e) => {
                e.preventDefault();
                actions.onPickMidParent?.(null);
              },
            }),
          ]),
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
      if (view.level === "parent" && it.hasChildren)
        actions.onPickMidParent?.(it.key);
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

/* =========================
   view builder（下段用：既存）
   ========================= */

function buildMidView_(state, axis, parentKey) {
  if (axis !== "ジャンル") {
    const items = (Array.isArray(state.byAxis?.[axis])
      ? state.byAxis[axis]
      : []
    ).map((x) => ({
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

  const genreTree = Array.isArray(state.byAxis?.["ジャンル"])
    ? state.byAxis["ジャンル"]
    : [];

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

  const parentNode =
    genreTree.find((x) => String(x.key) === String(parentKey)) || null;
  const parentMeta = parentNode ? metaOf(parentNode) : null;
  const parentLabel =
    parentMeta?.label || parentNode?.label || String(parentKey);
  const children = Array.isArray(parentNode?.children)
    ? parentNode.children
    : [];

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
