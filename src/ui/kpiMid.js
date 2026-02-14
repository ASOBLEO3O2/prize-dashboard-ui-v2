// src/ui/kpiMid.js
import { clear } from "../utils/dom.js";
import { renderMidSlot } from "./renderMidSlot.js";

import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";
import { renderWidget2CostHist } from "./widget2CostHist.js";

/**
 * 中段：2×2（枠固定）
 * - midSlots / midSlotsDraft / drawerOpen の切替は維持
 * - widget1 / widget2 を当てる
 * - 中身は .midPanelBody の中だけ（widget2は自前card設計なので例外でmount直下）
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

    // ===== widget2（自前でcard構築。mount直下）=====
    if (type === "widget2") {
      renderWidget2CostHist(mount, actions);
      continue;
    }

    // ===== widget1 / scatter / dummy（renderMidSlotで枠を作り body に描く）=====
    renderMidSlot(mount, {
      slotKey: String(type || "").trim() || "_",
      title: type === "widget1" ? "" : titleOf_(type, i),
      noHeader: type === "widget1", // widget1は内部ヘッダーあり
      onFocus: () => {
        if (type === "widget1") actions.onOpenFocus?.("shareDonut");
        else if (type === "scatter") actions.onOpenFocus?.("scatter");
      },
      renderBody: (body) => {
        // widget1
        if (type === "widget1") {
          renderWidget1ShareDonut(body, state, actions, { mode: "normal" });
          return;
        }

        // 他は一旦プレースホルダ（今は復活対象外）
        clear(body);
        body.textContent = `type: ${type}`;
      },
    });
  }

  // 下段カードは不要（維持）
  if (mounts.midCards) clear(mounts.midCards);
}

function norm4_(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}

function titleOf_(type, idx) {
  const map = {
    scatter: "Scatter（未復活）",
    dummyA: "空き枠A",
    dummyB: "空き枠B",
    dummyC: "空き枠C",
    dummyD: "空き枠D",
  };
  return map[type] || `枠${idx + 1}`;
}
