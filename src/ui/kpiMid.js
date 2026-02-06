// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";
import { renderWidget2CostHist } from "./widget2CostHist.js";

/**
 * 中段KPI（4枠）の描画
 * - state.midSlots（確定）に従って 4スロットを描き分け
 * - 「type が変わったら必ず clear → 作り直し」して残骸/重なりを根絶
 * - 各スロットに __slotType を保持（Consoleで確認できる）
 *
 * 想定 slotType:
 *  - "widget1"
 *  - "widget2"
 *  - "dummyA" "dummyB" "dummyC" "dummyD"
 */
export function renderMidKpi(mounts, state, actions) {
  // 4枠の mount（layout.js で返してるやつ）
  const slots = [
    mounts.midSlotSalesDonut,
    mounts.midSlotMachineDonut,
    mounts.midSlotCostHist,
    mounts.midSlotScatter,
  ].filter(Boolean);

  // 念のため：スロット配列が無い/短い場合はデフォルト
  const midSlots = Array.isArray(state.midSlots) ? state.midSlots : ["widget1", "widget2", "dummyA", "dummyB"];

  for (let i = 0; i < 4; i++) {
    const mount = slots[i];
    const type = midSlots[i] || "dummyA";
    if (!mount) continue;
    renderSlot_(mount, type, state, actions, i);
  }
}

/* =========================
   core: slot rebuild control
   ========================= */

function ensureSlotType_(mount, type) {
  // typeが変わったら必ず作り直す（残骸/重なり防止の本丸）
  if (mount.__slotType !== type) {
    clear(mount);
    mount.__slotType = type;
    mount.__built = false;
  }
}

function renderSlot_(mount, type, state, actions, idx) {
  ensureSlotType_(mount, type);

  // 初回だけ「器」を作るタイプ（dummy/共通枠）もあるが、
  // widget1/widget2 は各レンダラ側が全部組む前提でもOK。
  switch (type) {
    case "widget1": {
      // ここで __slotType が必ず入る（= undefined 問題を潰す）
      // widget1 側が mount 内を全描画
      renderWidget1ShareDonut(mount, state, actions);
      mount.__built = true;
      return;
    }

    case "widget2": {
      // widget2CostHist 側が mount 内を全描画
      renderWidget2CostHist(mount, state, actions);
      mount.__built = true;
      return;
    }

    case "dummyA":
    case "dummyB":
    case "dummyC":
    case "dummyD":
    default: {
      renderDummy_(mount, type, idx, actions);
      mount.__built = true;
      return;
    }
  }
}

/* =========================
   dummy cards (4つ)
   ========================= */

function renderDummy_(mount, type, idx, actions) {
  // 既存CSSに寄せる：.card / header / body（最低限）
  clear(mount);

  const titleMap = {
    dummyA: "ダミー①",
    dummyB: "ダミー②",
    dummyC: "ダミー③",
    dummyD: "ダミー④",
  };

  const title = titleMap[type] || `ダミー(${type})`;

  const card = el("div", { class: "card kpiCard" }, [
    el("div", { class: "midPanelHeader" }, [
      el("div", { class: "midPanelTitle", text: title }),
      el("div", { class: "midPanelControls" }, [
        el("button", {
          class: "btn ghost",
          text: "拡大",
          onClick: () => actions?.onOpenFocus?.({ slotIndex: idx, slotType: type }),
        }),
      ]),
    ]),
    el("div", { class: "midPanelBody" }, [
      el("div", { class: "placeholder", text: `${type} placeholder` }),
    ]),
  ]);

  mount.appendChild(card);
}
