// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";
import { renderCharts } from "./charts.js";

/**
 * 中段KPI
 * - 2×2 固定スロット
 * - 全スロット同一DOM構造
 * - widgetは「bodyの中身だけ」を描画
 */

export function renderMidKpi(mounts, state, actions) {
  // ===== 上段4スロット =====
  renderSlot_(mounts.midSlotSalesDonut, {
    title: "売上 / ステーション 構成比",
    type: "widget1",
    renderBody: (body) =>
      renderWidget1ShareDonut(body, state, actions, { mode: "normal" }),
  });

  renderSlot_(mounts.midSlotMachineDonut, {
    title: "（ダミー）スロット2",
    type: "dummy",
  });

  renderSlot_(mounts.midSlotCostHist, {
    title: "原価率 分布",
    type: "chart",
    canvasId: "costHistChart",
  });

  renderSlot_(mounts.midSlotScatter, {
    title: "売上 × 原価率",
    type: "chart",
    canvasId: "salesCostScatter",
  });

  // チャート更新（canvasが揃った後）
  renderCharts(mounts, state);
}

/* =========================================================
   共通：スロット1枚分の骨格（全スロット完全一致）
   ========================================================= */

function renderSlot_(slotMount, { title, type, renderBody, canvasId }) {
  if (!slotMount) return;

  // 初回のみDOM生成
  if (!slotMount.__built) {
    clear(slotMount);

    const card = el("div", { class: "card midPanel" });

    const header = el("div", { class: "midPanelHeader" }, [
      el("div", { class: "midPanelTitle", text: title }),
    ]);

    const body = el("div", {
      class: "midPanelBody",
    });

    card.appendChild(header);
    card.appendChild(body);
    slotMount.appendChild(card);

    slotMount.__card = card;
    slotMount.__body = body;
    slotMount.__built = true;
  }

  const body = slotMount.__body;

  // 中身だけ毎回更新
  clear(body);

  // ===== 中身の描画 =====
  if (type === "widget1" && renderBody) {
    renderBody(body);
    return;
  }

  if (type === "chart" && canvasId) {
    body.appendChild(
      el("canvas", {
        id: canvasId,
        style: "width:100%;height:100%;display:block;",
      })
    );
    return;
  }

  // ダミー
  body.appendChild(
    el("div", {
      style:
        "height:100%;display:flex;align-items:center;justify-content:center;opacity:.4;",
      text: "DUMMY",
    })
  );
}
