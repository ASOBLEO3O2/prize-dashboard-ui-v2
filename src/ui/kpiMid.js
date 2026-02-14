// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { renderMidSlot } from "./renderMidSlot.js";

import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";
import { renderWidget2CostHist } from "./widget2CostHist.js";

/**
 * 中段：2×2（枠固定）
 * - slot= .dashSlot
 * - 内部= .midPanel / .midPanelBody
 * - widget1 / widget2 を「決定後でも消えない」ように安全に当てる
 */
export function renderMidKpi(mounts, state, actions) {
  const slotMounts = [
    mounts.midSlotSalesDonut,
    mounts.midSlotMachineDonut,
    mounts.midSlotCostHist,
    mounts.midSlotScatter,
  ];

  const fallback = ["widget1", "widget2", "dummyA", "dummyB"];
  const fixed = norm4_(state.midSlots, fallback);
  const draft = norm4_(state.midSlotsDraft, fixed);
  const slots = state.drawerOpen ? draft : fixed;

  for (let i = 0; i < 4; i++) {
    const mount = slotMounts[i];
    if (!mount) continue;

    const type = slots[i] || "dummyA";

    // =========================================================
    // widget2 は「自前で card を作る」設計なので、slot直下に描く
    // =========================================================
    if (type === "widget2") {
      // 他タイプから切替時の残骸を消す（確実に）
      if (mount.__midSlotKey && mount.__midSlotKey !== "widget2") {
        clear(mount);
        delete mount.__midSlot;
      }
      mount.__midSlotKey = "widget2";

      try {
        renderWidget2CostHist(mount, actions);
      } catch (err) {
        clear(mount);
        mount.appendChild(
          el("div", { class: "card midPanel" }, [
            el("div", { class: "midPanelHeader" }, [
              el("div", { class: "midPanelTitle", text: "② 原価率分布（widget2）" }),
            ]),
            el("div", { class: "midPanelBody" }, [
              el("pre", {
                style: "white-space:pre-wrap; font-size:12px; margin:0;",
                text: `widget2 ERROR:\n${String(err?.stack || err)}`,
              }),
            ]),
          ])
        );
      }
      continue;
    }

    // =========================================================
    // widget1 / dummy / scatter は renderMidSlot（midPanelBody に描く）
    // =========================================================
    if (type === "widget1") {
      renderMidSlot(mount, {
        slotKey: "widget1",
        title: "",          // widget1は内部ヘッダーを持つ
        noHeader: true,     // ✅ 外側ヘッダー無し
        renderBody: (body) => {
          safeRender_(body, () => {
            // widget1は内部で「拡大」ボタンも持ってる
            renderWidget1ShareDonut(body, state, actions, { mode: "normal" });
          }, "widget1");
        },
      });
      continue;
    }

    // それ以外：とりあえず “枠” は出しておく（消えない）
    renderMidSlot(mount, {
      slotKey: type,
      title: titleOf_(type, i),
      renderBody: (body) => {
        clear(body);
        body.appendChild(
          el("div", { style: "opacity:.8; font-size:12px;", text: `type: ${type}` })
        );
      },
    });
  }

  if (mounts.midCards) clear(mounts.midCards);
}

function safeRender_(body, fn, label) {
  try {
    fn();
  } catch (err) {
    clear(body);
    body.appendChild(
      el("pre", {
        style: "white-space:pre-wrap; font-size:12px; margin:0;",
        text: `${label} ERROR:\n${String(err?.stack || err)}`,
      })
    );
  }
}

function norm4_(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}

function titleOf_(type, idx) {
  if (type === "scatter") return "③ 売上×原価率（散布）";
  if (type === "dummyA") return `ダミーA（slot${idx + 1}）`;
  if (type === "dummyB") return `ダミーB（slot${idx + 1}）`;
  return `slot${idx + 1}`;
}
