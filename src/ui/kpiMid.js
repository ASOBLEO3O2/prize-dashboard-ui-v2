// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";

/**
 * 目的：
 * - 中段 2×2 の4枠は固定
 * - 中身は「スロット→ウィジェット」割当で差し替える
 *
 * 重要ルール：
 * - スロット自体（midDashの子）を display:none にしない（2×2が壊れる）
 * - 1スロットに同時に1ウィジェットだけ描画
 * - chart系は「canvas id」を固定して charts.js が描く（器だけここで用意）
 */

// ====== ウィジェット定義（候補）======
// kind: focusOverlay に渡す識別子（将来拡張）
// build: slotMount に DOM を作る（初回だけ）
// update: state/actions を元に必要なら更新（基本はここでは空でOK）
const WIDGETS = {
  // ---- ダミー（複数用意して切替の動作確認に使う）----
  dummy1: dummyWidget_("ダミー①", "dummy1"),
  dummy2: dummyWidget_("ダミー②", "dummy2"),
  dummy3: dummyWidget_("ダミー③", "dummy3"),
  dummy4: dummyWidget_("ダミー④", "dummy4"),
  dummy5: dummyWidget_("ダミー⑤", "dummy5"),
  dummy6: dummyWidget_("ダミー⑥", "dummy6"),
  dummy7: dummyWidget_("ダミー⑦", "dummy7"),
  dummy8: dummyWidget_("ダミー⑧", "dummy8"),

  // ---- chart器（charts.js が描画）----
  costHist: canvasWidget_({
    title: "原価率 分布",
    kind: "costHist",
    tools: () =>
      el("div", { class: "chartTools" }, [
        el("select", { class: "select", id: "costHistMode" }, [
          el("option", { value: "count", text: "台数" }),
          el("option", { value: "sales", text: "売上" }),
        ]),
      ]),
    canvasId: "costHistChart",
  }),

  scatter: canvasWidget_({
    title: "売上 × 原価率（マトリクス）",
    kind: "scatter",
    tools: null,
    canvasId: "salesCostScatter",
  }),

  // ---- widget1（いまは未接続：placeholderにしておく）----
  shareDonutPlaceholder: dummyWidget_("構成比（ドーナツ）", "shareDonut"),
};

// ====== slot → widget の割当（暫定）======
// 今はデフォルト固定。
// 将来：state.midSlots に保存して、UIから変更できるようにする。
function getSlotPlan_(state) {
  const planFromState = state?.midSlots; // 例: { s1:"...", s2:"...", s3:"...", s4:"..." }
  const plan = planFromState && typeof planFromState === "object" ? planFromState : null;

  return {
    s1: plan?.s1 || "shareDonutPlaceholder",
    s2: plan?.s2 || "dummy2",
    s3: plan?.s3 || "costHist",
    s4: plan?.s4 || "scatter",
  };
}

/* =======================================================
   main
   ======================================================= */

export function renderMidKpi(mounts, state, actions) {
  console.log("[KPI_MID] render mid slots");

  const plan = getSlotPlan_(state);

  // スロットは絶対に消さない（display:none禁止）
  renderSlot_(mounts.midSlotSalesDonut, plan.s1, state, actions);
  renderSlot_(mounts.midSlotMachineDonut, plan.s2, state, actions);
  renderSlot_(mounts.midSlotCostHist, plan.s3, state, actions);
  renderSlot_(mounts.midSlotScatter, plan.s4, state, actions);

  // 下段：今は不要なら非表示（必要になったら戻す）
  if (mounts.midCards) {
    clear(mounts.midCards);
    mounts.midCards.style.display = "none";
  }
}

/* =======================================================
   slot renderer
   ======================================================= */

function renderSlot_(slotMount, widgetKey, state, actions) {
  if (!slotMount) return;

  const def = WIDGETS[widgetKey] || WIDGETS.dummy1;

  // 既に別ウィジェットが入っているなら差し替え
  if (slotMount.__widgetKey !== widgetKey) {
    clear(slotMount);
    slotMount.__built = false;
    slotMount.__widgetKey = widgetKey;
  }

  // 初回だけ build
  if (!slotMount.__built) {
    slotMount.__built = true;
    def.build(slotMount, state, actions);
  }

  // update（必要なら）
  def.update?.(slotMount, state, actions);
}

/* =======================================================
   widget factories
   ======================================================= */

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

function dummyWidget_(title, kind) {
  return {
    build(slotMount, state, actions) {
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

function canvasWidget_({ title, kind, tools, canvasId }) {
  return {
    build(slotMount, state, actions) {
      const card = el("div", { class: "card midPanel" });
      const header = buildHeader_({
        title,
        tools: typeof tools === "function" ? tools() : tools,
        onFocus: () => actions.onOpenFocus?.(kind),
      });

      const body = el(
        "div",
        { class: "midPanelBody chartBody", onClick: () => actions.onOpenFocus?.(kind) },
        [el("canvas", { id: canvasId })]
      );

      card.appendChild(header);
      card.appendChild(body);
      slotMount.appendChild(card);
    },
    update() {},
  };
}
