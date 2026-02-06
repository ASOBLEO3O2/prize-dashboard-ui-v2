import { el } from "../utils/dom.js";
import { renderMidSlot } from "./renderMidSlot.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

/**
 * 中段KPI（4枠）
 * - 構造は renderMidSlot に完全委譲
 * - ここでは「どのスロットに何を出すか」だけを決める
 */
export function renderMidKpi(mounts, state, actions) {

  // ===== スロット①：Widget1（売上/台数ドーナツ）=====
  renderMidSlot(mounts.midSlotSalesDonut, {
    title: "売上 / 台数 構成比",
    onFocus: () => actions.onOpenFocus?.("shareDonut"),
    renderBody: (body) => {
      renderWidget1ShareDonut(body, state, actions, { mode: "normal" });
    },
  });

  // ===== スロット②：ダミー（将来 widget2）=====
  renderMidSlot(mounts.midSlotMachineDonut, {
    title: "（ダミー）",
    renderBody: (body) => {
      body.appendChild(
        el("div", {
          style: "margin:auto; opacity:.5;",
          text: "WIDGET SLOT",
        })
      );
    },
  });

  // ===== スロット③：原価率分布（canvas器のみ）=====
  renderMidSlot(mounts.midSlotCostHist, {
    title: "原価率 分布",
    tools: el("select", { class: "select", id: "costHistMode" }, [
      el("option", { value: "count", text: "台数" }),
      el("option", { value: "sales", text: "売上" }),
    ]),
    onFocus: () => actions.onOpenFocus?.("costHist"),
    renderBody: (body) => {
      body.appendChild(el("canvas", { id: "costHistChart" }));
    },
  });

  // ===== スロット④：散布図（canvas器のみ）=====
  renderMidSlot(mounts.midSlotScatter, {
    title: "売上 × 原価率",
    onFocus: () => actions.onOpenFocus?.("scatter"),
    renderBody: (body) => {
      body.appendChild(el("canvas", { id: "salesCostScatter" }));
    },
  });
}
