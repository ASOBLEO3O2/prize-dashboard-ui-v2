// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";

export function buildWidget2CostHistTools(actions) {
  const sel = el("select", { class: "select", id: "costHistMode" }, [
    el("option", { value: "count", text: "台数" }),
    el("option", { value: "sales", text: "売上" }),
  ]);

  if (!sel.__bound) {
    sel.addEventListener("change", () => actions?.requestRender?.());
    sel.__bound = true;
  }

  return el("div", { class: "chartTools" }, [sel]);
}

export function renderWidget2CostHist(body, actions) {
  if (!body) return;

  // ✅ フラグではなくcanvasの存在で判定（slot切替耐性）
  let canvas = body.querySelector("#costHistChart");
  if (!canvas) {
    clear(body);
    body.classList.add("chartBody");

    canvas = el("canvas", { id: "costHistChart" });
    body.appendChild(canvas);

    body.addEventListener("click", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "select" || tag === "option" || tag === "button") return;
      actions?.onOpenFocus?.("costHist");
    });

    body.__w2_built = true;
  }
}
