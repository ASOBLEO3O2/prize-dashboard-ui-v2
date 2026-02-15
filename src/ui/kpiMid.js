// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { renderMidSlot } from "./renderMidSlot.js";

import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";
import { renderWidget2CostHist, buildWidget2CostHistTools } from "./widget2CostHist.js";

// ✅ 追加：Widget③
import { renderWidget3Scatter } from "./widget3Scatter.js";

/**
 * 中段：2×2（スロット切替対応）
 * - drawerOpen中：midSlotsDraft を即プレビュー
 * - drawerOpen閉：midSlots（確定）を表示
 *
 * 重要（方針A）：
 * - slotの「器」は renderMidSlot が一元管理
 * - 各ウィジェットは “自分の中身” を自分で描く（app.js/charts.js から干渉しない）
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

    // ===== widget1 =====
    if (type === "widget1") {
      renderMidSlot(mount, {
        slotKey: "widget1",
        title: "",
        noHeader: true, // widget1自身がヘッダーを持つ
        onFocus: () => actions?.onOpenFocus?.("shareDonut"),
        renderBody: (body) => {
          renderWidget1ShareDonut(body, state, actions);
        },
      });
      continue;
    }

    // ===== widget2（器はrenderMidSlotで統一） =====
    if (type === "widget2") {
      renderMidSlot(mount, {
        slotKey: "widget2",
        title: "原価率 分布",
        tools: buildWidget2CostHistTools(actions),
        onFocus: () => actions?.onOpenFocus?.("costHist"),
        renderBody: (body) => {
          renderWidget2CostHist(body, state, actions);
        },
      });
      continue;
    }

    // ===== widget3（scatter v0） =====
    if (type === "scatter") {
      renderMidSlot(mount, {
        slotKey: "scatter",
        title: "売上 × 原価率",
        onFocus: () => actions?.onOpenFocus?.("scatter"),
        renderBody: (body) => {
          renderWidget3Scatter(body, state, actions);
        },
      });
      continue;
    }

    // ===== dummy =====
    renderMidSlot(mount, {
      slotKey: String(type || "").trim() || "_",
      title: titleOf_(type, i),
      renderBody: (body) => {
        clear(body);
        body.appendChild(el("div", { class: "frameOnlyHint", text: `type: ${type}` }));
      },
    });
  }

  // 下段カードは midKpi では触らない（ここで空にするだけ）
  if (mounts.midCards) clear(mounts.midCards);
}

function norm4_(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}

function titleOf_(type, idx) {
  const map = {
    dummyA: "空き枠A",
    dummyB: "空き枠B",
    dummyC: "空き枠C",
    dummyD: "空き枠D",
  };
  return map[type] || `枠${idx + 1}`;
}
