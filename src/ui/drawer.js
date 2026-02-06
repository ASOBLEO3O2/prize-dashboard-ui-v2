import { el, clear } from "../utils/dom.js";

/**
 * Drawer：中段KPIの「枠に何を出すか」を選ぶだけ
 * - 描画ロジックは持たない
 * - state / actions をそのまま渡す
 */
export function renderDrawer(drawer, overlay, state, actions) {
  clear(drawer);

  // =========================
  // Header
  // =========================
  drawer.appendChild(
    el("div", { class: "drawerHeader" }, [
      el("div", { class: "drawerTitle", text: "ドロワー" }),
      el("button", {
        class: "btn ghost",
        onClick: actions.onCloseDrawer,
        text: "閉じる",
      }),
    ])
  );

  // =========================
  // Body
  // =========================
  drawer.appendChild(
    el("div", { class: "drawerBody" }, [

      // ---- 中段KPI 枠セレクタ ----
      el("div", { class: "drawerCard" }, [
        el("h4", { text: "中段KPI（4枠）の表示内容" }),
        el("p", {
          class: "muted",
          text: "各枠に表示するウィジェットを選択します（①②は実体、他はダミー）",
        }),

        ...[0, 1, 2, 3].map((i) =>
          el("div", { style: "margin-top:10px;" }, [
            el("label", {
              class: "smallLabel",
              text: `スロット ${i + 1}`,
            }),
            el(
              "select",
              {
                class: "select",
                value: state.midSlots?.[i] ?? "",
                onChange: (e) => {
                  actions.onSetMidSlot?.(i, e.target.value);
                },
              },
              [
                // --- 実体 ---
                el("option", { value: "widget1" }, "① 構成比ドーナツ"),
                el("option", { value: "widget2" }, "② 原価率分布"),

                // --- ダミー ---
                el("option", { value: "dummyA" }, "ダミーA"),
                el("option", { value: "dummyB" }, "ダミーB"),
                el("option", { value: "dummyC" }, "ダミーC"),
                el("option", { value: "dummyD" }, "ダミーD"),
              ]
            ),
          ])
        ),
      ]),

      // ---- 説明 ----
      el("div", { class: "drawerCard" }, [
        el("h4", { text: "このフェーズでやっていること" }),
        el("p", {
          text:
            "・2×2 の器を安定させる\n" +
            "・枠と中身を分離する\n" +
            "・後からウィジェットを差し替えられる設計にする",
        }),
      ]),

      // ---- デバッグ ----
      el("div", { class: "drawerCard" }, [
        el("h4", { text: "現在の状態（debug）" }),
        el("p", { text: `midSlots: ${JSON.stringify(state.midSlots)}` }),
        el("p", { text: `focusGenre: ${state.focusGenre ?? "null"}` }),
        el("p", { text: `openDetailGenre: ${state.openDetailGenre ?? "null"}` }),
      ]),
    ])
  );

  // =========================
  // Open / Close
  // =========================
  overlay.classList.toggle("open", !!state.drawerOpen);
  drawer.classList.toggle("open", !!state.drawerOpen);
}
