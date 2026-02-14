// src/ui/renderMidSlot.js
import { el, clear } from "../utils/dom.js";

/**
 * midスロットの「構造」を1回だけ作る（再生成しない）
 * ただし、slotKey（=割当type）が変わったら「器」ごと作り直す。
 * - slotMount.__midSlotKey に現在のキー
 * - slotMount.__midSlot に { card, header, body, noHeader }
 * - 同一slotKeyの間は body の中身だけを renderBody で更新する
 *
 * 目的：
 * - Chart.js の「初回サイズ崩れ」を避けるため、同一typeのときは canvas を生かす
 * - ただし type が変わったときはヘッダー/ツール構成も変わるので器を作り直す
 */
export function renderMidSlot(slotMount, {
  slotKey = "",          // ✅ 追加：このスロットに割り当てられている type（widget1 / widget2 / scatter / dummyA...）
  title = "",
  tools = null,
  onFocus = null,
  noHeader = false,      // widget1用：外側ヘッダー不要（内部で持っているため）
  renderBody,            // (bodyEl) => void
}) {
  if (!slotMount) return;

  const key = String(slotKey || "").trim() || "_";

  // typeが変わったら必ず作り直す（残骸/ヘッダー不整合防止）
  if (slotMount.__midSlotKey !== key) {
    clear(slotMount);
    delete slotMount.__midSlot;
    slotMount.__midSlotKey = key;
  }

  // 1回だけ構造を作る
  if (!slotMount.__midSlot) {
    const card = el("div", { class: "card midPanel" });

    let header = null;
    if (!noHeader && (title || tools || onFocus)) {
      const headerRight = el("div", {
        style: "display:flex; align-items:center; gap:10px;",
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
    card.appendChild(body);

    // bodyクリックでも拡大（select操作などを邪魔しない）
    if (onFocus) {
      body.addEventListener("click", (e) => {
        const tag = (e.target?.tagName || "").toLowerCase();
        if (tag === "select" || tag === "option" || tag === "button") return;
        onFocus();
      });
    }

    slotMount.appendChild(card);
    slotMount.__midSlot = { card, header, body, noHeader };
  }

  // 2回目以降：ヘッダー文字だけ更新（同一slotKey内）
  const api = slotMount.__midSlot;

  if (!api.noHeader && api.header) {
    const titleEl = api.header.querySelector(".midPanelTitle");
    if (titleEl) titleEl.textContent = title || "";
  }

  // 中身だけ描画（中身側が clear(body) してOK）
  if (typeof renderBody === "function") {
    renderBody(api.body);
  }
}
