// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget②：原価率 分布（ヒストグラム）
 * - Chart.js 実体は charts.js 側（#costHistChart / #costHistMode を参照）
 * - slotの「器（card/header/body）」は renderMidSlot が管理
 *   → ここでは body 内のDOMだけを安定化（同一type中は作り直さない）
 */

export function buildWidget2CostHistTools(actions) {
  const sel = el("select", { class: "select", id: "costHistMode" }, [
    el("option", { value: "count", text: "台数" }),
    el("option", { value: "sales", text: "売上" }),
  ]);

  // mode変更時：charts.js が参照するので再描画を促す
  if (!sel.__bound) {
    sel.addEventListener("change", () => {
      actions?.requestRender?.();
    });
    sel.__bound = true;
  }

  return el("div", { class: "chartTools" }, [sel]);
}

export function renderWidget2CostHist(body, actions) {
  if (!body) return;

  // 同一type中は canvas を生かす（Chart.js崩れ防止）
  if (!body.__w2_built) {
    clear(body);
    body.classList.add("chartBody");

    const canvas = el("canvas", { id: "costHistChart" });
    body.appendChild(canvas);

    // bodyクリックで拡大（select操作は除外）
    body.addEventListener("click", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "select" || tag === "option" || tag === "button") return;
      actions?.onOpenFocus?.("costHist");
    });

    body.__w2_built = true;
  }
}
