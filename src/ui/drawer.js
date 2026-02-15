// src/ui/drawer.js
import { el, clear } from "../utils/dom.js";

/**
 * Drawer：中段 4スロット切替
 * - state.drawerOpen が true のとき表示
 * - state.midSlotsDraft を編集（即プレビュー）
 * - 決定：actions.onApplyMidSlots()
 * - 取消：actions.onCancelMidSlots()
 * - 閉じる：actions.onCloseDrawer()
 *
 * 重要：
 * - 変更のたびに actions.requestRender() を必ず呼ぶ（即プレビュー保証）
 */
export function renderDrawer(drawerMount, drawerOverlay, state, actions) {
  if (!drawerMount || !drawerOverlay) return;

  const open = !!state.drawerOpen;

  // 表示/非表示（CSS側で opacity 切替でもOKだが、まずは確実に display）
  drawerOverlay.style.display = open ? "block" : "none";
  drawerMount.style.display = open ? "block" : "none";

  // 閉じているなら中身を消して終了
  if (!open) {
    clear(drawerMount);
    return;
  }

  // ここから描画
  clear(drawerMount);

  // overlay クリックで閉じる（毎回 handler を付け直すため once）
  drawerOverlay.onclick = null;
  drawerOverlay.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      actions?.onCloseDrawer?.();
      actions?.requestRender?.();
    },
    { once: true }
  );

  // パネル（クリックで閉じない）
  const panel = el("div", { class: "drawerPanel" });
  panel.addEventListener("click", (e) => e.stopPropagation());

  const head = el("div", { class: "drawerHead" }, [
    el("div", { class: "drawerTitle", text: "中段スロット切替" }),
    el("button", {
      class: "btn ghost",
      text: "閉じる",
      onClick: (e) => {
        e.preventDefault();
        actions?.onCloseDrawer?.();
        actions?.requestRender?.();
      },
    }),
  ]);

  const OPTIONS = [
    ["widget1", "widget1（構成比ドーナツ）"],
    ["widget2", "widget2（原価率分布）"],
    ["scatter", "scatter"],
    ["dummyA", "空き枠A"],
    ["dummyB", "空き枠B"],
    ["dummyC", "空き枠C"],
    ["dummyD", "空き枠D"],
  ];

  const draft = Array.isArray(state.midSlotsDraft) ? state.midSlotsDraft : [];
  const rows = el("div", { class: "drawerRows" });

  for (let i = 0; i < 4; i++) {
    const cur = String(draft[i] || "").trim() || "dummyA";

    const sel = el(
      "select",
      {
        class: "select drawerSelect",
        onChange: (e) => {
          const v = e.target.value;

          // ✅ draft 更新
          actions?.onSetMidSlotDraft?.(i, v);

          // ✅ 即プレビューを保証
          actions?.requestRender?.();
        },
      },
      OPTIONS.map(([value, label]) =>
        el("option", {
          value,
          text: label,
          selected: value === cur,
        })
      )
    );

    rows.appendChild(
      el("div", { class: "drawerRow" }, [
        el("div", { class: "drawerLabel", text: `スロット ${i + 1}` }),
        sel,
      ])
    );
  }

  const foot = el("div", { class: "drawerFoot" }, [
    el("button", {
      class: "btn ghost",
      text: "取消",
      onClick: (e) => {
        e.preventDefault();
        actions?.onCancelMidSlots?.();
        actions?.requestRender?.(); // ✅ 取消も即反映（元に戻るプレビュー）
      },
    }),
    el("button", {
      class: "btn primary",
      text: "決定",
      onClick: (e) => {
        e.preventDefault();

        // ✅ 確定＋閉じる（app.js 側で drawerOpen:false にしている）
        actions?.onApplyMidSlots?.();

        // ✅ 念のため即反映
        actions?.requestRender?.();
      },
    }),
  ]);

  panel.append(head, rows, foot);
  drawerMount.append(panel);
}
