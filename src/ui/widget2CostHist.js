// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";
import { renderCharts } from "./charts.js";

/**
 * Widget2: 原価率ヒスト
 * 既存仕様：
 * - mount 直下に card/canvas を構築
 * - charts.js が canvas id を拾って Chart.js を生成
 *
 * 問題：
 * - slot切替等で mount が clear されると DOM は消えるが __w2_built が残る
 * - その結果、再描画時に何も作られず「描画されない」
 *
 * 対策：
 * - DOM が無いなら再構築する（__w2_built だけに依存しない）
 * - その上で renderCharts() を呼び直す
 */
export function renderWidget2CostHist(mount, actions) {
  if (!mount) return;

  // DOMが残っているか？（canvas id で判定）
  const hasCanvas = !!mount.querySelector("#w2_cost_hist_canvas");

  // すでに built でも、DOM が無いなら作り直す
  if (!mount.__w2_built || !hasCanvas) {
    clear(mount);

    const card = el("div", { class: "card midPanel", id: "w2_cost_hist" }, [
      el("div", { class: "midPanelHeader" }, [
        el("div", { class: "midPanelTitle", text: "② 原価率分布" }),
      ]),
      el("div", { class: "midPanelBody" }, [
        el("canvas", { id: "w2_cost_hist_canvas" }),
      ]),
    ]);

    mount.appendChild(card);
    mount.__w2_built = true;
  }

  // charts.js 側で Chart インスタンスを (再)生成
  // ※ canvas差し替え時は charts.js が destroy→create する
  renderCharts(actions?.state || null, actions);
}
