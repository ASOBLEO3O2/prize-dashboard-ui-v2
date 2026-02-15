// src/ui/renderMidSlot.js
import { el, clear } from "../utils/dom.js";

/**
 * renderMidSlot
 * - mount(セル) の中に「カード構造」を構築して保持
 * - ただし slotKey が変わったら、構造ごと作り直す（←これが重要）
 * - 同じ slotKey なら body のみ更新
 */
export function renderMidSlot(mount, opts) {
  const o = opts || {};
  const slotKey = String(o.slotKey || "_").trim() || "_";

  // ===== slotKey が変わったら作り直す =====
  const prevKey = mount.__midSlotKey;
  const needRebuild = !mount.__midSlot || prevKey !== slotKey;

  if (needRebuild) {
    clear(mount);

    // card
    const card = el("div", { class: "slotCard" });

    // header
    const header = el("div", { class: "slotHeader" });

    const title = el("div", { class: "slotTitle", text: o.title || "" });
    const tools = el("div", { class: "slotTools" });

    // focus button（必要なら）
    const focusBtn = el("button", {
      class: "btn icon ghost slotFocusBtn",
      text: "拡大",
      onClick: () => o.onFocus?.(),
    });

    // noHeader の場合は header を作らない（widget1用）
    if (!o.noHeader) {
      header.append(title, tools, focusBtn);
      card.append(header);
    } else {
      // noHeaderでも tools を入れたいケースがあるならここで調整可能
      // 現状は widget1 の方針どおり header 自体なし
    }

    // body
    const body = el("div", { class: "slotBody" });
    card.append(body);

    mount.append(card);

    mount.__midSlot = { card, header, title, tools, body };
    mount.__midSlotKey = slotKey;
  }

  // ===== ここから「更新」 =====
  const { title, tools, body } = mount.__midSlot;

  // タイトル（headerありの時だけ）
  if (!o.noHeader) {
    if (title) title.textContent = o.title || "";
  }

  // tools（毎回差し替え）
  if (tools) {
    clear(tools);
    if (o.tools) tools.appendChild(o.tools);
  }

  // body（毎回再描画）
  if (typeof o.renderBody === "function") {
    o.renderBody(body);
  } else {
    clear(body);
  }
}
