// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";

/**
 * 中段KPI（2×2）
 * - 4枠の「器」は layout.js 側で固定（#midDash）
 * - ここは「枠の中身」を差し替えるだけ
 *
 * 選択可能ウィジェット（現段階）：
 *   - w1: 既存ウィジェット①（売上/台数 構成比ドーナツ）
 *   - w2: 既存ウィジェット②（原価率分布ヒストグラム：charts.js が描画）
 *   - d1〜d4: ダミー4個
 */

// =========================
// widget registry
// =========================

const WIDGETS = {
  // ---- 既存①（実体）----
  w1: widget1_(),

  // ---- 既存②（器のみ：charts.js が描画）----
  w2: costHistWidget_(),

  // ---- ダミー（4個）----
  d1: dummyWidget_("ダミー①", "d1"),
  d2: dummyWidget_("ダミー②", "d2"),
  d3: dummyWidget_("ダミー③", "d3"),
  d4: dummyWidget_("ダミー④", "d4"),
};

// =========================
// slot plan
// =========================
// state.midSlots があればそれを採用（例: { s1:"w1", s2:"d1", s3:"w2", s4:"d2" }）
// なければデフォルトに落とす
function getSlotPlan_(state) {
  const p = state?.midSlots && typeof state.midSlots === "object" ? state.midSlots : null;

  return {
    s1: p?.s1 || "w1",
    s2: p?.s2 || "d1",
    s3: p?.s3 || "w2",
    s4: p?.s4 || "d2",
  };
}

// =========================
// main
// =========================

export function renderMidKpi(mounts, state, actions) {
  console.log("[KPI_MID] render mid slots");

  const plan = getSlotPlan_(state);

  renderSlot_(mounts.midSlotSalesDonut, plan.s1, state, actions);
  renderSlot_(mounts.midSlotMachineDonut, plan.s2, state, actions);
  renderSlot_(mounts.midSlotCostHist, plan.s3, state, actions);
  renderSlot_(mounts.midSlotScatter, plan.s4, state, actions);

  // 下段（今は不要なら非表示：器安定が優先）
  if (mounts.midCards) {
    clear(mounts.midCards);
    mounts.midCards.style.display = "none";
  }
}

// =========================
// slot renderer
// =========================

function renderSlot_(slotMount, widgetKey, state, actions) {
  if (!slotMount) return;

  const def = WIDGETS[widgetKey] || WIDGETS.d1;

  // 別ウィジェットに切り替わったら、slot内を作り直す
  if (slotMount.__widgetKey !== widgetKey) {
    clear(slotMount);
    slotMount.__built = false;
    slotMount.__widgetKey = widgetKey;
  }

  if (!slotMount.__built) {
    slotMount.__built = true;
    def.build(slotMount, state, actions);
  }

  def.update?.(slotMount, state, actions);
}

// =========================
// widget factories
// =========================

function buildHeader_({ title, tools, onFocus }) {
  const right = el(
    "div",
    { style: "display:flex; align-items:center; gap:10px;" },
    []
  );

  if (tools) right.appendChild(tools);

  right.appendChild(
    el("button", {
      class: "btn ghost midPanelBtn",
      text: "拡大",
      onClick: (e) => {
        e.preventDefault();
        onFocus?.();
      },
    })
  );

  return el("div", { class: "midPanelHeader" }, [
    el("div", { class: "midPanelTitleWrap" }, [
      el("div", { class: "midPanelTitle", text: title }),
      el("div", { class: "midPanelSub", text: "" }),
    ]),
    right,
  ]);
}

// ---- 既存①：ウィジェット①（DOMを作って中身だけ更新）----
function widget1_() {
  return {
    build(slotMount, state, actions) {
      clear(slotMount);

      const card = el("div", { class: "card midPanel" });
      const body = el("div", { class: "midPanelBody" });

      card.appendChild(body);
      slotMount.appendChild(card);

      // 保持（更新用）
      slotMount.__w1_body = body;
    },
    update(slotMount, state, actions) {
      // ここが「安定の要」：DOM再生成せず中身だけ更新
      const body = slotMount.__w1_body;
      if (!body) return;
      renderWidget1ShareDonut(body, state, actions, { mode: "normal" });
    },
  };
}

// ---- 既存②：原価率分布（charts.js が描画する canvas 器だけ用意）----
function costHistWidget_() {
  return {
    build(slotMount, state, actions) {
      clear(slotMount);

      const card = el("div", { class: "card midPanel" });

      const tools = el("div", { class: "chartTools" }, [
        el("select", { class: "select", id: "costHistMode" }, [
          el("option", { value: "count", text: "台数" }),
          el("option", { value: "sales", text: "売上" }),
        ]),
      ]);

      const header = buildHeader_({
        title: "原価率 分布",
        tools,
        onFocus: () => actions.onOpenFocus?.("costHist"),
      });

      const body = el(
        "div",
        { class: "midPanelBody chartBody", onClick: () => actions.onOpenFocus?.("costHist") },
        [el("canvas", { id: "costHistChart" })]
      );

      card.appendChild(header);
      card.appendChild(body);
      slotMount.appendChild(card);
    },
    update() {},
  };
}

// ---- ダミー（同格のカード：高さ・構造統一用）----
function dummyWidget_(title, kind) {
  return {
    build(slotMount, state, actions) {
      clear(slotMount);

      const card = el("div", { class: "card midPanel" });

      const header = buildHeader_({
        title,
        tools: null,
        onFocus: () => actions.onOpenFocus?.(kind),
      });

      const body = el("div", { class: "midPanelBody" }, [
        el("div", {
          style:
            "height:100%; width:100%; display:flex; align-items:center; justify-content:center; opacity:.55; border:1px dashed rgba(148,163,184,.5); border-radius:12px;",
          text: `${title} placeholder`,
        }),
      ]);

      card.appendChild(header);
      card.appendChild(body);
      slotMount.appendChild(card);
    },
    update() {},
  };
}
