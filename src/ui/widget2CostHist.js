// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget②：原価率分布（器）
 * - charts.js が #costHistChart に描画する前提
 * - mode select は #costHistMode を提供（既存仕様踏襲）
 * - DOMは初回だけ構築し、以降は再生成しない
 */
export function renderWidget2CostHist(slotMount, state, actions, opts = {}) {
  if (!slotMount) return;

  const title = opts.title || "原価率 分布";
  const canvasId = opts.canvasId || "costHistChart"; // ← 既存を維持
  const modeId = opts.modeId || "costHistMode";      // ← 既存を維持
  const onFocus = opts.onFocus || (() => actions.onOpenFocus?.("costHist"));

  // 初回だけカード枠を作る
  if (!slotMount.__w2_built) {
    slotMount.__w2_built = true;

    clear(slotMount);
    slotMount.style.display = "";

    const card = el("div", { class: "card midPanel" });

    // tools（右上：台数/売上）
    const tools = el("div", { class: "chartTools" }, [
      el("select", { class: "select", id: modeId }, [
        el("option", { value: "count", text: "台数" }),
        el("option", { value: "sales", text: "売上" }),
      ]),
    ]);

    const headerRight = el(
      "div",
      { style: "display:flex; align-items:center; gap:10px;" },
      [
        tools,
        el("button", {
          class: "btn ghost midPanelBtn",
          text: "拡大",
          onClick: (e) => {
            e.preventDefault();
            onFocus?.();
          },
        }),
      ]
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

    slotMount.__w2_modeEl = slotMount.querySelector(`#${modeId}`);

    // 初期値：stateにあれば反映（無ければcount）
    const initial =
      state?.ui?.costHistMode ??
      state?.costHistMode ??
      "count";
    if (slotMount.__w2_modeEl) slotMount.__w2_modeEl.value = initial;

    // 変更時：既存の charts.js が change を拾うならそれでOK
    // 追加で actions があるなら呼ぶ（非必須 / 非破壊）
    if (slotMount.__w2_modeEl) {
      slotMount.__w2_modeEl.addEventListener("change", (e) => {
        const v = e?.target?.value;
        actions?.onSetCostHistMode?.(v);   // ← あれば使う（無ければ何もしない）
        actions?.requestRender?.();        // ← あれば使う（無ければ何もしない）
      });
    }
  } else {
    // 2回目以降：DOMは触らない（必要なら初期値だけ追従）
    const initial =
      state?.ui?.costHistMode ??
      state?.costHistMode ??
      null;
    if (initial && slotMount.__w2_modeEl) {
      slotMount.__w2_modeEl.value = initial;
    }
  }
}
