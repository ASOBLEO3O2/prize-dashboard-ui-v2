// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget②：原価率分布（器だけ）
 * - charts.js が既に描画する前提で、canvas と mode UI を提供する
 * - 非破壊：描画ロジックは一切持たない
 *
 * 期待する既存ID（charts.js が参照している想定）：
 * - canvas: #costHistCanvas
 * - mode  : #costHistMode  ("count" | "sales")
 */
export function mountWidget2CostHist(mount, state, actions, opts = {}) {
  const ids = {
    canvas: opts.canvasId || "costHistCanvas",
    mode: opts.modeId || "costHistMode",
  };

  clear(mount);

  // header（タイトル + 右上モード）
  const header = el("div", { class: "cardHead" }, [
    el("div", { class: "cardTitle", text: "原価率分布" }),
    el("div", { class: "cardTools" }, [
      el("label", { class: "miniLabel", text: "表示" }),
      el("select", {
        class: "miniSelect",
        id: ids.mode,
        onChange: (e) => {
          const v = e?.target?.value;
          // 既存の actions があればそれを呼ぶ（非必須）
          if (actions?.setCostHistMode) actions.setCostHistMode(v);
          // charts.js が select の change を拾う実装でも動く
        },
      }, [
        el("option", { value: "count", text: "台数" }),
        el("option", { value: "sales", text: "売上" }),
      ]),
    ]),
  ]);

  // body（canvas の器だけ）
  const body = el("div", { class: "cardBody" }, [
    el("canvas", { id: ids.canvas, class: "chartCanvas" }),
  ]);

  mount.appendChild(el("div", { class: "card card--widget2" }, [header, body]));

  // 初期値：state 側にあれば合わせる（なければcount）
  const sel = mount.querySelector(`#${ids.mode}`);
  const initial = state?.ui?.costHistMode || state?.costHistMode || "count";
  if (sel) sel.value = initial;

  // ここでは描画しない（charts.js の既存フローに任せる）
  // ただし、描画トリガが必要なら actions.requestRender() 的なものを呼べる
  if (actions?.requestRender) actions.requestRender();
}
