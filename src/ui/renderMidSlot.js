import { el, clear } from "../utils/dom.js";

/**
 * mid スロットの「唯一の正解構造」を生成する
 * - slot は layout.js が用意する
 * - 中身は必ず midPanelBody にだけ描画される
 */
export function renderMidSlot(slotMount, {
  title = "",
  tools = null,
  onFocus = null,
  renderBody,   // (bodyEl) => void
}) {
  if (!slotMount) return;

  // 毎回完全に作り直す（DOM再利用禁止）
  clear(slotMount);

  const card = el("div", { class: "card midPanel" });

  // header（必要な場合のみ）
  if (title || tools || onFocus) {
    const headerRight = el("div", {
      style: "display:flex; align-items:center; gap:10px;"
    });

    if (tools) headerRight.appendChild(tools);
    if (onFocus) {
      headerRight.appendChild(
        el("button", {
          class: "btn ghost midPanelBtn",
          text: "拡大",
          onClick: (e) => {
            e.preventDefault();
            onFocus();
          },
        })
      );
    }

    const header = el("div", { class: "midPanelHeader" }, [
      el("div", { class: "midPanelTitleWrap" }, [
        el("div", { class: "midPanelTitle", text: title }),
        el("div", { class: "midPanelSub", text: "" }),
      ]),
      headerRight,
    ]);

    card.appendChild(header);
  }

  // body（全ウィジェット共通）
  const body = el("div", { class: "midPanelBody" });
  card.appendChild(body);
  slotMount.appendChild(card);

  // 中身は「必ずここだけ」に描画
  if (typeof renderBody === "function") {
    renderBody(body);
  }
}
