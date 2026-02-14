// src/ui/kpiMid.js
import { clear } from "../utils/dom.js";
import { renderMidSlot } from "./renderMidSlot.js";

import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";
import { renderWidget2CostHist } from "./widget2CostHist.js";

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
    const slotKey = String(type || "").trim() || "_";

    renderMidSlot(mount, {
      slotKey,
      // widget1はヘッダ無し（元仕様）
      title: type === "widget1" ? "" : titleOf_(type, i),
      noHeader: type === "widget1",
      onFocus: () => {
        if (type === "widget1") actions.onOpenFocus?.("shareDonut");
        else if (type === "scatter") actions.onOpenFocus?.("scatter");
        else if (type === "widget2") actions.onOpenFocus?.("costHist");
      },
      renderBody: (body) => {
        // ★ここが復旧の要：全部 body の中で描く（mount直下は触らない）
        if (type === "widget1") {
          renderWidget1ShareDonut(body, state, actions);
          return;
        }

        if (type === "widget2") {
          clear(body);
          renderWidget2CostHist(body, actions); // ← mount ではなく body に描画
          return;
        }

        clear(body);
        body.textContent = `type: ${type}`;
      },
    });
  }

  if (mounts.midCards) clear(mounts.midCards);
}

function norm4_(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}

function titleOf_(type, idx) {
  const map = {
    widget2: "原価率分布",
    scatter: "Scatter（未復活）",
    dummyA: "空き枠A",
    dummyB: "空き枠B",
    dummyC: "空き枠C",
    dummyD: "空き枠D",
  };
  return map[type] || `枠${idx + 1}`;
}
