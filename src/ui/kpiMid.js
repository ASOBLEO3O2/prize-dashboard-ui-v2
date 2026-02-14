// src/ui/kpiMid.js
import { clear } from "../utils/dom.js";
import { renderMidSlot } from "./renderMidSlot.js";

import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";
import { renderWidget2CostHist } from "./widget2CostHist.js";

/**
 * 中段：2×2
 * - 枠サイズは固定（5:4）
 * - widget1 / widget2 を実際に当てる
 */
export function renderMidKpi(mounts, state, actions) {
  const slotMounts = [
    mounts.midSlotSalesDonut,
    mounts.midSlotMachineDonut,
    mounts.midSlotCostHist,
    mounts.midSlotScatter,
  ];

  const fallback = ["widget1", "widget2", "scatter", "dummyA"];
  const fixed = norm4_(state.midSlots, fallback);
  const draft = norm4_(state.midSlotsDraft, fixed);
  const slots = state.drawerOpen ? draft : fixed;

  for (let i = 0; i < 4; i++) {
    const mount = slotMounts[i];
    if (!mount) continue;

    const type = slots[i] || "dummyA";

    // ===============================
    // widget1
    // ===============================
    if (type === "widget1") {
      renderMidSlot(mount, {
        slotKey: "widget1",
        title: "売上構成比",
        onFocus: () =>
          actions?.onOpenFocus?.({ slotIndex: i, slotType: type }),
        renderBody: (body) => {
          renderWidget1ShareDonut(body, state, actions);
        },
      });
      continue;
    }

    // ===============================
    // widget2
    // ===============================
    if (type === "widget2") {
      // widget2は自前でcard構築する設計
      clear(mount);
      renderWidget2CostHist(mount, actions);
      continue;
    }

    // ===============================
    // それ以外（まだ未復活）
    // ===============================
    clear(mount);
  }

  // 下段は未使用
  if (mounts.midCards) clear(mounts.midCards);
}

function norm4_(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}
