// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";

/**
 * 中段KPI（フェーズ：器固定）
 * - 2×2の4枚を「同じ枠（card midPanel）」で必ず描画
 * - widget1 はいったん placeholder（被さり切り分け）
 * - costHist / scatter は canvas器だけ出す（charts.js が描く）
 * - 下段は今は不要 → 非表示
 */
export function renderMidKpi(mounts, state, actions) {
  console.log("[KPI_MID] LOADED dummy-phase 2026-02-06 r2");

  // 旧「マシン構成比」枠は一旦ダミーにする（表示は維持）
  renderDummyCardOnce_(mounts.midSlotMachineDonut, {
    title: "（予約）4枠目",
    body: buildDummyBox_("slot2 placeholder"),
    onFocus: () => actions.onOpenFocus?.("dummy2"),
  });

  // ①（左上）：構成比（ドーナツ）＝今はダミー
  renderDummyCardOnce_(mounts.midSlotSalesDonut, {
    title: "構成比（ドーナツ）",
    body: buildDummyBox_("widget1 placeholder"),
    onFocus: () => actions.onOpenFocus?.("shareDonut"),
  });

  // ②（右上）：原価率分布（器）
  renderCanvasCardOnce_(mounts.midSlotCostHist, {
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

  // ③（左下）：散布図（器）
  renderCanvasCardOnce_(mounts.midSlotScatter, {
    title: "売上 × 原価率（マトリクス）",
    tools: null,
    canvasId: "salesCostScatter",
    onFocus: () => actions.onOpenFocus?.("scatter"),
  });

  // 下段：今は不要
  if (mounts.midCards) {
    clear(mounts.midCards);
    mounts.midCards.style.display = "none";
  }
}

/* =========================
   共通：ヘッダー（統一）
   ========================= */

function buildHeader_({ title, tools, onFocus }) {
  const right = el(
    "div",
    { style: "display:flex; align-items:center; gap:10px;" },
    []
  );

  if (tools) right.appendChild(tools);

  right.appendChild(
    el("button", {
      class: "btn ghost midPanelBtn",
      text: "拡大",
      onClick: (e) => {
        e.preventDefault();
        onFocus?.();
      },
    })
  );

  return el("div", { class: "midPanelHeader" }, [
    el("div", { class: "midPanelTitleWrap" }, [
      el("div", { class: "midPanelTitle", text: title }),
      el("div", { class: "midPanelSub", text: "" }),
    ]),
    right,
  ]);
}

/* =========================
   ダミーカード：毎回作り直さない
   ========================= */

function renderDummyCardOnce_(slotMount, { title, body, onFocus }) {
  if (!slotMount) return;
  if (slotMount.__built) return;
  slotMount.__built = true;

  clear(slotMount);

  const card = el("div", { class: "card midPanel" });
  const header = buildHeader_({ title, tools: null, onFocus });
  const panelBody = el("div", { class: "midPanelBody" }, [body]);

  card.appendChild(header);
  card.appendChild(panelBody);
  slotMount.appendChild(card);
}

/* =========================
   canvasカード：器だけ（毎回作り直さない）
   ========================= */

function renderCanvasCardOnce_(slotMount, { title, tools, canvasId, onFocus }) {
  if (!slotMount) return;
  if (slotMount.__built) return;
  slotMount.__built = true;

  clear(slotMount);

  const card = el("div", { class: "card midPanel" });
  const header = buildHeader_({ title, tools, onFocus });

  const panelBody = el(
    "div",
    { class: "midPanelBody chartBody", onClick: () => onFocus?.() },
    [el("canvas", { id: canvasId })]
  );

  card.appendChild(header);
  card.appendChild(panelBody);
  slotMount.appendChild(card);
}

/* =========================
   ダミー中身
   ========================= */

function buildDummyBox_(text) {
  return el("div", {
    style:
      "height:100%; width:100%; display:flex; align-items:center; justify-content:center; opacity:.55; border:1px dashed rgba(148,163,184,.5); border-radius:12px;",
    text,
  });
}
