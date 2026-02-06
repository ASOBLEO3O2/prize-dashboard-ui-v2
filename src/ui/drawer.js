import { el, clear } from "../utils/dom.js";

export function renderDrawer(drawer, overlay, state, actions) {
  clear(drawer);

  const draft = Array.isArray(state.midSlotsDraft)
    ? state.midSlotsDraft
    : (Array.isArray(state.midSlots) ? state.midSlots : ["widget1","widget2","dummyA","dummyB"]);

  drawer.appendChild(
    el("div", { class: "drawerHeader" }, [
      el("div", { class: "drawerTitle", text: "ドロワー" }),
      el("div", { style: "display:flex; gap:8px; align-items:center;" }, [
        el("button", { class: "btn ghost", onClick: actions.onCancelMidSlots, text: "取消" }),
        el("button", { class: "btn primary", onClick: actions.onApplyMidSlots, text: "決定" }),
        el("button", { class: "btn ghost", onClick: actions.onCloseDrawer, text: "閉じる" }),
      ]),
    ])
  );

  drawer.appendChild(
    el("div", { class: "drawerBody" }, [

      el("div", { class: "drawerCard" }, [
        el("h4", { text: "中段KPI（4枠）の表示内容" }),
        el("p", { class: "muted", text: "選択 → 決定 で反映（作業中の切替が安全になります）" }),

        ...[0,1,2,3].map(i => (
          el("div", { style: "margin-top:10px;" }, [
            el("label", { class: "smallLabel", text: `スロット ${i+1}` }),
            el("select", {
              class: "select",
              value: draft[i] ?? "",
              onChange: (e) => actions.onSetMidSlotDraft?.(i, e.target.value),
            }, [
              el("option", { value: "widget1" }, "① 構成比ドーナツ"),
              el("option", { value: "widget2" }, "② 原価率分布"),
              el("option", { value: "dummyA" }, "ダミーA"),
              el("option", { value: "dummyB" }, "ダミーB"),
              el("option", { value: "dummyC" }, "ダミーC"),
              el("option", { value: "dummyD" }, "ダミーD"),
            ]),
          ])
        )),
      ]),

      el("div", { class: "drawerCard" }, [
        el("h4", { text: "現在の状態（debug）" }),
        el("p", { text: `midSlots: ${JSON.stringify(state.midSlots)}` }),
        el("p", { text: `midSlotsDraft: ${JSON.stringify(draft)}` }),
      ]),
    ])
  );

  overlay.classList.toggle("open", !!state.drawerOpen);
  drawer.classList.toggle("open", !!state.drawerOpen);
}
