// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { renderMidSlot } from "./renderMidSlot.js";

import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

/**
 * 中段：2×2（枠は固定）
 * - 4セルは必ず renderMidSlot を通して「枠」を維持する
 * - widget1 は既存の renderWidget1ShareDonut(body, state, actions) を呼ぶ
 * - widget2 は一旦「器だけ」：body内に select+canvas を置く（charts.js側が描く想定）
 * - それ以外はプレースホルダ（枠維持のため）
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

    // ✅ 重要：枠は常に renderMidSlot で維持
    renderMidSlot(mount, {
      slotKey: String(type || "").trim() || "_",
      title: titleOf_(type, i),
      onFocus: () => actions?.onOpenFocus?.({ slotIndex: i, slotType: type }),
      renderBody: (body) => {
        // まず中身だけクリア（枠はrenderMidSlotが保持）
        clear(body);

        // widget1：既存描画
        if (type === "widget1") {
          renderWidget1ShareDonut(body, state, actions);
          return;
        }

        // widget2：いまは「枠内に収まる器だけ」置く（描画ロジックには触らない）
        if (type === "widget2") {
          ensureWidget2Body_(body);
          // ここで charts.js 側が costHistChart を見て描く設計なら、そのまま描画される
          // （まだ描かれなくても「当て先」は完了＝枠は出る）
          return;
        }

        // その他：プレースホルダ（枠が消えないため）
        body.appendChild(
          el("div", { class: "frameOnlyHint" }, [
            el("div", { class: "frameOnlyType", text: `type: ${type}` }),
            el("div", { class: "frameOnlyText", text: "（未復活：枠のみ）" }),
          ])
        );
      },
    });
  }

  // 下段は空でOK
  if (mounts.midCards) clear(mounts.midCards);
}

function ensureWidget2Body_(body) {
  // 既存charts.js互換を意識して id を固定
  // - select: #costHistMode
  // - canvas: #costHistChart
  // ※ body内完結
  const wrap = el("div", { class: "chartBody", style: "width:100%;height:100%;min-height:0;display:flex;flex-direction:column;gap:10px;" });

  const tools = el("div", { class: "chartTools", style: "flex:0 0 auto;display:flex;gap:10px;align-items:center;" }, [
    el("select", { class: "select", id: "costHistMode" }, [
      el("option", { value: "count", text: "台数" }),
      el("option", { value: "sales", text: "売上" }),
    ]),
  ]);

  const canvasWrap = el("div", { style: "position:relative;flex:1;min-height:0;" }, [
    el("canvas", { id: "costHistChart", style: "width:100%;height:100%;" }),
  ]);

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
