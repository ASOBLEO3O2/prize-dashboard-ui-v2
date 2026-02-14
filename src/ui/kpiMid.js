// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { renderMidSlot } from "./renderMidSlot.js";

import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

/**
 * 中段：2×2（5:4固定の枠は維持）
 * - 4セルは必ず renderMidSlot を通す（枠を消さない）
 * - widget1：既存の描画（body内完結）
 * - widget2：当て先だけ（body内に select + canvas を置く）
 * - それ以外：プレースホルダ表示（枠維持）
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

    renderMidSlot(mount, {
      slotKey: String(type || "").trim() || "_",
      title: titleOf_(type, i),
      onFocus: () => actions?.onOpenFocus?.({ slotIndex: i, slotType: type }),
      renderBody: (body) => {
        clear(body);

        if (type === "widget1") {
          renderWidget1ShareDonut(body, state, actions);
          return;
        }

        if (type === "widget2") {
          ensureWidget2Body_(body);
          return;
        }

        body.appendChild(
          el("div", { class: "frameOnlyHint" }, [
            el("div", { class: "frameOnlyType", text: `type: ${type}` }),
            el("div", { class: "frameOnlyText", text: "（未復活：枠のみ）" }),
          ])
        );
      },
    });
  }

  // 下段は未使用（維持）
  if (mounts.midCards) clear(mounts.midCards);
}

function ensureWidget2Body_(body) {
  // charts.js 側の既存描画互換（id固定）
  const wrap = el("div", {
    class: "chartBody",
    style:
      "width:100%;height:100%;min-height:0;display:flex;flex-direction:column;gap:10px;",
  });

  const tools = el(
    "div",
    {
      class: "chartTools",
      style: "flex:0 0 auto;display:flex;gap:10px;align-items:center;",
    },
    [
      el("select", { class: "select", id: "costHistMode" }, [
        el("option", { value: "count", text: "台数" }),
        el("option", { value: "sales", text: "売上" }),
      ]),
    ]
  );

  const canvasWrap = el(
    "div",
    { style: "position:relative;flex:1;min-height:0;" },
    [el("canvas", { id: "costHistChart", style: "width:100%;height:100%;" })]
  );

  wrap.appendChild(tools);
  wrap.appendChild(canvasWrap);
  body.appendChild(wrap);
}

function titleOf_(type, idx) {
  if (type === "widget1") return "売上構成比";
  if (type === "widget2") return "原価率 分布";
  if (type === "scatter") return "散布図";
  if (type === "dummyA") return `枠${idx + 1}`;
  return String(type || `枠${idx + 1}`);
}

function norm4_(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}
