// src/ui/focusOverlay.js
import { el, clear } from "../utils/dom.js";

import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";
import { renderWidget2CostHistFocus } from "./widget2CostHist.js";

/**
 * Focus Overlay（方針A：枠＋ルーティングのみ）
 * - オーバーレイは「開閉・ヘッダー・描画先(body)」だけ管理
 * - 中身（DOM/Chart/並び替え等）は各Widget側の責務
 * - close時は、残っているChart.jsインスタンスを確実に破棄してからDOMを消す
 */

// modalEl 配下の Chart.js を破棄（DOM clear だけでは Chart が残るため）
function destroyChartsUnder_(rootEl) {
  const Chart = window.Chart;
  if (!Chart || !rootEl) return;

  const canvases = rootEl.querySelectorAll?.("canvas");
  if (!canvases || canvases.length === 0) return;

  // v3/v4: Chart.getChart
  const getChart =
    typeof Chart.getChart === "function" ? (c) => Chart.getChart(c) : null;

  // fallback: Chart.instances（配列/Map/オブジェクト）
  const listInstances = () => {
    const inst = Chart.instances;
    if (!inst) return [];
    if (Array.isArray(inst)) return inst.filter(Boolean);
    if (inst instanceof Map) return Array.from(inst.values()).filter(Boolean);
    if (typeof inst === "object") return Object.values(inst).filter(Boolean);
    return [];
  };

  const all = getChart ? null : listInstances();

  canvases.forEach((cv) => {
    try {
      const ch = getChart ? getChart(cv) : all.find((x) => x?.canvas === cv);
      if (ch && typeof ch.destroy === "function") ch.destroy();
    } catch (e) {
      // 無視
    }
  });
}

export function renderFocusOverlay(overlayEl, modalEl, state, actions) {
  if (!overlayEl || !modalEl) return;

  const focus = state?.focus || { open: false };

  // =========================
  // CLOSE
  // =========================
  if (!focus.open) {
    overlayEl.classList.remove("open");

    // ✅ 重要：DOMを消す前に Chart を必ず破棄
    destroyChartsUnder_(modalEl);

    clear(modalEl);
    document.body.style.overflow = "";

    overlayEl.onclick = null;
    return;
  }

  // =========================
  // OPEN
  // =========================
  overlayEl.classList.add("open");

  // open時も保険で掃除（残骸対策）
  destroyChartsUnder_(modalEl);
  clear(modalEl);

  document.body.style.overflow = "hidden";

  overlayEl.onclick = (e) => {
    if (e.target === overlayEl) actions?.onCloseFocus?.();
  };

  const header = el("div", { class: "focusHeader" }, [
    el("button", {
      class: "btn ghost",
      text: "← 戻る",
      onClick: () => actions?.onCloseFocus?.(),
    }),
    el("div", { class: "focusTitle", text: focus.title || "詳細" }),
    el("button", {
      class: "btn ghost",
      text: "×",
      onClick: () => actions?.onCloseFocus?.(),
    }),
  ]);

  const body = el("div", { class: "focusBody" });

  modalEl.appendChild(header);
  modalEl.appendChild(body);

  // =========================
  // ROUTING（振り分けのみ）
  // =========================

  // widget1 expanded
  if (focus.kind === "shareDonut") {
    renderWidget1ShareDonut(body, state, actions, { mode: "expanded" });
    return;
  }

  // widget2 expanded（あなたの widget2CostHist.js の export を呼ぶ）
  if (focus.kind === "costHist") {
    renderWidget2CostHistFocus(body, state, actions);
    return;
  }

  // fallback
  body.appendChild(
    el("div", { class: "focusPlaceholder", text: "（拡大表示：未対応）" })
  );
}
