// src/ui/drawer.js
import { el, clear } from "../utils/dom.js";

/**
 * Drawer（中段4枠の差し替え）
 * - draft を編集（即プレビューは mid 側が対応）
 * - 「決定」で midSlots に確定
 * - select の表示が切り替わらない問題は
 *   「select.value を DOMプロパティとして必ずセット」で解消する
 */

const OPTIONS = [
  { value: "widget1", label: "① 構成比ドーナツ（既存）" },
  { value: "widget2", label: "② 原価率分布（既存）" },
  { value: "scatter", label: "③ 売上×原価率（散布）" }, // 使わないなら選ばなければOK
  { value: "dummyA", label: "ダミーA" },
  { value: "dummyB", label: "ダミーB" },
  { value: "dummyC", label: "ダミーC" },
  { value: "dummyD", label: "ダミーD" },
];

function norm4(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}

/**
 * ★重要：select は attribute の value では表示が追従しないことがあるため
 * DOMプロパティとして sel.value を必ずセットする
 */
function buildSlotSelect_(currentValue, onChange) {
  const sel = el("select", {
    class: "select",
    onChange,
  });

  // option は selected を使わない（ブラウザ差＆el()差を避ける）
  for (const op of OPTIONS) {
    sel.appendChild(el("option", { value: op.value, text: op.label }));
  }

  // ★ここが本丸：DOMプロパティとして value をセット
  sel.value = String(currentValue || "");

  // 保険：存在しない値なら先頭に落とす
  if (!OPTIONS.some((o) => o.value === sel.value)) {
    sel.value = OPTIONS[0]?.value || "";
  }

  return sel;
}

export function renderDrawer(drawer, overlay, state, actions) {
  clear(drawer);

  const slots = norm4(state.midSlots, ["widget1", "widget2", "dummyA", "dummyB"]);
  const draft = norm4(state.midSlotsDraft, slots);

  // =========================
  // Header
  // =========================
  drawer.appendChild(
    el("div", { class: "drawerHeader" }, [
      el("div", { class: "drawerTitle", text: "ドロワー" }),
      el("div", { style: "display:flex; gap:10px; align-items:center;" }, [
        el("button", {
          class: "btn ghost",
          text: "取消",
          onClick: (e) => {
            e.preventDefault();
            actions.onCancelMidSlots?.();
          },
        }),
        el("button", {
          class: "btn primary",
          text: "決定",
          onClick: (e) => {
            e.preventDefault();
            actions.onApplyMidSlots?.();
          },
        }),
        el("button", {
          class: "btn ghost",
          text: "閉じる",
          onClick: actions.onCloseDrawer,
        }),
      ]),
    ])
  );

  // =========================
  // Body
  // =========================
  const body = el("div", { class: "drawerBody" }, [
    el("div", { class: "drawerCard" }, [
      el("h4", { text: "中段KPI（4枠）の表示内容" }),
      el("p", { text: "選択中は draft。『決定』で確定（midSlots）になります。" }),
    ]),
  ]);

  // 4スロット
  for (let i = 0; i < 4; i++) {
    body.appendChild(
      el("div", { class: "drawerCard" }, [
        el("div", {
          style: "font-weight:900; margin-bottom:8px;",
          text: `スロット ${i + 1}`,
        }),
        buildSlotSelect_(draft[i], (e) => {
          actions.onSetMidSlotDraft?.(i, e.target.value);
          actions.requestRender?.(); // ★追加：即プレビュー保証
        }),
      ])
    );
  }

  // debug
  body.appendChild(
    el("div", { class: "drawerCard" }, [
      el("h4", { text: "現在の状態（debug）" }),
      el("p", { text: `midSlots (確定): ${JSON.stringify(slots)}` }),
      el("p", { text: `midSlotsDraft (編集中): ${JSON.stringify(draft)}` }),
      el("p", { text: `drawerOpen: ${state.drawerOpen ? "true" : "false"}` }),
    ])
  );

  drawer.appendChild(body);

  // =========================
  // Open / Close
  // =========================
  overlay.classList.toggle("open", !!state.drawerOpen);
  drawer.classList.toggle("open", !!state.drawerOpen);
}
