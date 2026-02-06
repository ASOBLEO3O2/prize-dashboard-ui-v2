// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget②：原価率 分布（ヒストグラム）
 * - Chart.js 実体は charts.js 側
 * - ここでは「器」だけを保証する
 */
export function renderWidget2CostHist(slotMount, actions) {
  if (!slotMount) return;

  // 初回のみDOM構築
  if (!slotMount.__w2_built) {
    clear(slotMount);

    const card = el("div", { class: "card midPanel widget2" });

    const header = el("div", { class: "midPanelHeader" }, [
      el("div", { class: "midPanelTitleWrap" }, [
        el("div", { class: "midPanelTitle", text: "原価率 分布" }),
        el("div", { class: "midPanelSub", text: "" }),
      ]),
      el("button", {
        class: "btn ghost midPanelBtn",
        text: "拡大",
        onClick: (e) => {
          e.preventDefault();
          actions.onOpenFocus?.("costHist");
        },
      }),
    ]);

    const tools = el("div", { class: "chartTools" }, [
      el("select", { class: "select", id: "costHistMode" }, [
        el("option", { value: "count", text: "台数" }),
        el("option", { value: "sales", text: "売上" }),
      ]),
    ]);

    header.appendChild(tools);

    const body = el(
      "div",
      {
        class: "midPanelBody chartBody",
        onClick: () => actions.onOpenFocus?.("costHist"),
      },
      [el("canvas", { id: "costHistChart" })]
    );

    card.appendChild(header);
    card.appendChild(body);
    slotMount.appendChild(card);

    slotMount.__w2_built = true;
  }
}
