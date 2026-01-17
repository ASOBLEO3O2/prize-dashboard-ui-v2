import { el, clear } from "../utils/dom.js";

export function renderDrawer(drawer, overlay, state, actions) {
  clear(drawer);

  drawer.appendChild(
    el("div", { class: "drawerHeader" }, [
      el("div", { class: "drawerTitle", text: "ドロワー（後で中身確定）" }),
      el("button", { class: "btn ghost", onClick: actions.onCloseDrawer, text: "閉じる" }),
    ])
  );

  drawer.appendChild(
    el("div", { class: "drawerBody" }, [
      el("div", { class: "drawerCard" }, [
        el("h4", { text: "このStep Aでできること" }),
        el("p", { text: "・上部KPI表示 / 中段ドーナツ2連 / ジャンルカード / ドーナツ→カード強調 / カード→詳細を下に展開" }),
      ]),
      el("div", { class: "drawerCard" }, [
        el("h4", { text: "ここは後で確定する" }),
        el("p", { text: "・フィルタUI / ソート / 数値条件（ANDルール）/ 列表示など。いまは器だけ維持します。" }),
      ]),
      el("div", { class: "drawerCard" }, [
        el("h4", { text: "現在の状態（デバッグ表示）" }),
        el("p", { text: `focusGenre: ${state.focusGenre ?? "null"}` }),
        el("p", { text: `openDetailGenre: ${state.openDetailGenre ?? "null"}` }),
      ]),
    ])
  );

  overlay.classList.toggle("open", !!state.drawerOpen);
  drawer.classList.toggle("open", !!state.drawerOpen);
}
