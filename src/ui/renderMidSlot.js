// src/ui/renderMidSlot.js
import { el, clear } from "../utils/dom.js";

/**
 * renderMidSlot（復旧版）
 * - 元の midPanel 構造（CSSが当たる）に戻す
 * - ただし slotKey が変わったら器ごと作り直す（プレビュー/切替のため）
 * - 同じ slotKey の間は body の中身だけ更新（Chart.jsの崩れ回避）
 */
export function renderMidSlot(mount, opts) {
  if (!mount) return;

  const o = opts || {};
  const key = String(o.slotKey || "_").trim() || "_";

  // slotKey が変わったら器ごと作り直す
  const prevKey = mount.__midSlotKey;
  const needRebuild = !mount.__midSlot || prevKey !== key;

  if (needRebuild) {
    clear(mount);

    const card = el("div", { class: "card midPanel" });

    let header = null;
    let titleEl = null;
    let toolsEl = null;

    if (!o.noHeader) {
      toolsEl = el("div", { style: "display:flex; align-items:center; gap:10px;" });

      if (o.tools) toolsEl.appendChild(o.tools);

      if (o.onFocus) {
        toolsEl.appendChild(
          el("button", {
            class: "btn ghost midPanelBtn",
            text: "拡大",
            onClick: (e) => {
              e.preventDefault();
              o.onFocus?.();
            },
          })
        );
      }

      titleEl = el("div", { class: "midPanelTitle", text: o.title || "" });

      header = el("div", { class: "midPanelHeader" }, [
        el("div", { class: "midPanelTitleWrap" }, [
          titleEl,
          el("div", { class: "midPanelSub", text: "" }),
        ]),
        toolsEl,
      ]);

      card.appendChild(header);
    }

    const body = el("div", { class: "midPanelBody" });
    card.appendChild(body);

    // bodyクリックでも拡大（select操作等は除外）
    if (o.onFocus) {
      body.addEventListener("click", (e) => {
        const tag = (e.target?.tagName || "").toLowerCase();
        if (tag === "select" || tag === "option" || tag === "button") return;
        o.onFocus?.();
      });
    }

    mount.appendChild(card);

    mount.__midSlot = { card, header, body, titleEl, toolsEl };
    mount.__midSlotKey = key;
  }

  // ===== 更新（同一slotKey内） =====
  const api = mount.__midSlot;

  // タイトル更新
  if (!o.noHeader && api.titleEl) {
    api.titleEl.textContent = o.title || "";
  }

  // tools は毎回差し替え（selectなどの変化に追従）
  if (!o.noHeader && api.toolsEl) {
    clear(api.toolsEl);
    if (o.tools) api.toolsEl.appendChild(o.tools);

    if (o.onFocus) {
      api.toolsEl.appendChild(
        el("button", {
          class: "btn ghost midPanelBtn",
          text: "拡大",
          onClick: (e) => {
            e.preventDefault();
            o.onFocus?.();
          },
        })
      );
    }
  }

  // body 描画
  if (typeof o.renderBody === "function") {
    o.renderBody(api.body);
  } else {
    clear(api.body);
  }
}
