// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { renderMidSlot } from "./renderMidSlot.js";

/**
 * 中段：2×2の「枠だけ」表示モード
 * - 上部はそのまま（layout側）
 * - 切替設計（midSlots / midSlotsDraft / drawerOpen）は維持
 * - 中身のウィジェット描画は一旦しない（サイズ決め専用）
 * - 下段カード（midCards）は不要：空にするだけ
 */
export function renderMidKpi(mounts, state, actions) {
  const slotMounts = [
    mounts.midSlotSalesDonut,
    mounts.midSlotMachineDonut,
    mounts.midSlotCostHist,
    mounts.midSlotScatter,
  ];

  // デフォルト割当（切替設計は残す）
  const fallback = ["widget1", "widget2", "scatter", "dummyA"];
  const fixed = norm4_(state.midSlots, fallback);
  const draft = norm4_(state.midSlotsDraft, fixed);
  const slots = state.drawerOpen ? draft : fixed;

  for (let i = 0; i < 4; i++) {
    const mount = slotMounts[i];
    if (!mount) continue;

    const type = slots[i] || "dummyA";
    renderFrameOnly_(mount, type, actions, i);
  }

  // ✅ 下段カードは不要：空にする（レイアウト崩れ防止）
  if (mounts.midCards) clear(mounts.midCards);
}

function norm4_(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}

function titleOf_(type, idx) {
  const map = {
    widget1: "Widget1（枠）",
    widget2: "Widget2（枠）",
    scatter: "Scatter（枠）",
    dummyA: "空き枠A",
    dummyB: "空き枠B",
    dummyC: "空き枠C",
    dummyD: "空き枠D",
  };
  return map[type] || `枠${idx + 1}`;
}

function renderFrameOnly_(mount, type, actions, idx) {
  // slotKey=type で「枠の器」を安定化（typeが変わったら作り直し）
  renderMidSlot(mount, {
    slotKey: String(type || "").trim() || "_",
    title: titleOf_(type, idx),
    onFocus: () => actions?.onOpenFocus?.({ slotIndex: idx, slotType: type }),
    renderBody: (body) => {
      // “中身なし” で高さ確認するためのプレースホルダ
      clear(body);
      body.classList.add("frameOnlyBody");

      body.appendChild(
        el("div", { class: "frameOnlyHint" }, [
          el("div", { class: "frameOnlyType", text: `type: ${type}` }),
          el("div", {
            class: "frameOnlyText",
            text: "※ サイズ決めモード：中身は描画しません",
          }),
        ])
      );
    },
  });
}
