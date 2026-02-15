// src/ui/drawer.js
import { el, clear } from "../utils/dom.js";

/**
 * Drawer（中段スロット切替）
 * - state.drawerOpen: true で表示
 * - state.midSlotsDraft を編集（即プレビュー）
 * - 決定: actions.onApplyMidSlots()
 * - キャンセル: actions.onCancelMidSlots() + 閉じる
 *
 * 前提：actions には以下がある
 * - onSetMidSlotDraft(index, value)
 * - onApplyMidSlots()
 * - onCancelMidSlots()
 * - onCloseDrawer()
 * - requestRender()
 */
export function renderDrawer(drawerMount, drawerOverlay, state, actions) {
  if (!drawerMount || !drawerOverlay) return;

  // 表示/非表示
  const open = !!state.drawerOpen;
  drawerOverlay.style.display = open ? "block" : "none";
  drawerMount.style.display = open ? "block" : "none";

  if (!open) return;

  clear(drawerMount);
  clear(drawerOverlay);

  // オーバーレイ（外クリックで閉じる）
  drawerOverlay.className = "drawerOverlay";
  drawerOverlay.addEventListener("click", () => {
    actions?.onCloseDrawer?.();
    actions?.requestRender?.();
  }, { once: true });

  const panel = el("div", { class: "drawerPanel" });
  panel.addEventListener("click", (e) => e.stopPropagation()); // パネル内クリックは閉じない

  const title = el("div", { class: "drawerTitle", text: "中段スロット切替" });

  // スロット候補（必要なら増やしてOK）
  const OPTIONS = [
    { value: "widget1", text: "widget1（構成比ドーナツ）" },
    { value: "widget2", text: "widget2（原価率分布）" },
    { value: "scatter", text: "scatter" },
    { value: "dummyA", text: "空き枠A" },
    { value: "dummyB", text: "空き枠B" },
    { value: "dummyC", text: "空き枠C" },
    { value: "dummyD", text: "空き枠D" },
  ];

  const draft = Array.isArray(state.midSlotsDraft) ? state.midSlotsDraft : [];
  const rows = el("div", { class: "drawerRows" });

  for (let i = 0; i < 4; i++) {
    const current = String(draft[i] || "").trim() || "dummyA";

    const sel = el(
      "select",
      {
        class: "select drawerSelect",
        onChange: (e) => {
          const v = e.target.value;
          actions?.onSetMidSlotDraft?.(i, v);
          actions?.requestRender?.(); // ✅ 即プレビュー
        },
      },
      OPTIONS.map((o) =>
        el("option", {
          value: o.value,
          text: o.text,
          selected: o.value === current,
        })
      )
    );

    rows.appendChild(
      el("div", { class: "drawerRow" }, [
        el("div", { class: "drawerLabel", text: `枠${i + 1}` }),
        sel,
      ])
    );
  }

  const btns = el("div", { class: "drawerBtns" }, [
    el("button", {
      class: "btn ghost",
      text: "キャンセル",
      onClick: () => {
        actions?.onCancelMidSlots?.();
        actions?.onCloseDrawer?.();
        actions?.requestRender?.();
      },
    }),
    el("button", {
      class: "btn primary",
      text: "決定",
      onClick: () => {
        actions?.onApplyMidSlots?.(); // onApply側で閉じる想定
        actions?.requestRender?.();
      },
    }),
  ]);

  panel.append(title, rows, btns);
  drawerMount.append(panel);

  // overlay の中に drawerMount を載せる構成の場合
  // （既存のDOM構造次第で不要なら消してOK）
  drawerOverlay.append(drawerMount);
}
