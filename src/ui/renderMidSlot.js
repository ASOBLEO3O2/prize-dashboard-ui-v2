import { el, clear } from "../utils/dom.js";

/**
 * midスロットの「構造」を1回だけ作る（再生成しない）
 * - slotMount.__midSlot に { card, body } を保持
 * - 以後は body の中身だけを renderBody で更新する
 */
export function renderMidSlot(slotMount, {
  title = "",
  tools = null,
  onFocus = null,
  noHeader = false,     // ✅ widget1用：外側ヘッダー不要（内部で持っているため）
  renderBody,           // (bodyEl) => void
}) {
  if (!slotMount) return;

  // 1回だけ構造を作る
  if (!slotMount.__midSlot) {
    clear(slotMount);

    const card = el("div", { class: "card midPanel" });

    let header = null;
    if (!noHeader && (title || tools || onFocus)) {
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

      header = el("div", { class: "midPanelHeader" }, [
        el("div", { class: "midPanelTitleWrap" }, [
          el("div", { class: "midPanelTitle", text: title }),
          el("div", { class: "midPanelSub", text: "" }),
        ]),
        headerRight,
      ]);

      card.appendChild(header);
    }

    const body = el("div", { class: "midPanelBody" });
    // ヘッダ無しでも body が伸びる前提を作る
    card.appendChild(body);

    // bodyクリックでも拡大（任意）
    if (onFocus) {
      body.addEventListener("click", (e) => {
        // select操作などを邪魔しない
        const tag = (e.target?.tagName || "").toLowerCase();
        if (tag === "select" || tag === "option" || tag === "button") return;
        onFocus();
      });
    }

    slotMount.appendChild(card);

    slotMount.__midSlot = { card, header, body, noHeader };
  }

  // 2回目以降：ヘッダー文字だけ更新（構造は壊さない）
  const api = slotMount.__midSlot;

  // noHeader のスロットは触らない（widget1が自前で持つ）
  if (!api.noHeader && api.header) {
    const titleEl = api.header.querySelector(".midPanelTitle");
    if (titleEl && title) titleEl.textContent = title;
  }

  // 中身だけ描画（中身側が clear(body) してOK）
  if (typeof renderBody === "function") {
    renderBody(api.body);
  }
}
