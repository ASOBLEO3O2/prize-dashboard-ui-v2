// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { renderWidget1ShareDonut } from "./widget1ShareDonut.js";
import { renderWidget2CostHist } from "./widget2CostHist.js";

/**
 * 役割：
 * - 中段4枠を「state.midSlots / midSlotsDraft」に従って差し替え表示する
 * - ✅ ドロワーOPEN中は draft をプレビュー（決定前でも切替が見える）
 * - ✅ 下段（midCards）は当面 “無効化”（不要表示を止める）
 *
 * slotType:
 * - "widget1" : 構成比ドーナツ（既存）
 * - "widget2" : 原価率分布（Widget②：本命）
 * - "dummyA".."dummyD" : ダミー
 * - "scatter" : （将来用/任意）売上×原価率 scatter の器
 */
export function renderMidKpi(mounts, state, actions) {
  // ===== 下段（不要表示を止める）=====
  if (mounts.midCards) {
    mounts.midCards.style.display = "none";
    if (!mounts.midCards.__clearedOnce) {
      clear(mounts.midCards);
      mounts.midCards.__clearedOnce = true;
    }
  }

  // ===== 4枠：確定 or プレビュー =====
  const slots = pickSlots4_(state);

  // レイアウトが返す4枠（順番固定）
  const slotMounts = [
    mounts.midSlotSalesDonut,
    mounts.midSlotMachineDonut,
    mounts.midSlotCostHist,
    mounts.midSlotScatter,
  ];

  for (let i = 0; i < 4; i++) {
    const mount = slotMounts[i];
    const kind = slots[i] || "dummyA";
    renderMidSlot_(mount, kind, state, actions, i);
  }
}

/* =========================
   slots: drawerOpen中は draft をプレビュー
   ========================= */
function pickSlots4_(state) {
  const fallback = ["widget1", "widget2", "dummyA", "dummyB"];
  const src = state?.drawerOpen ? state?.midSlotsDraft : state?.midSlots;
  const arr = Array.isArray(src) ? src.slice(0, 4) : fallback.slice(0, 4);
  while (arr.length < 4) arr.push(fallback[arr.length] || "dummyA");
  return arr.map((x) => String(x || "").trim() || "dummyA");
}

/* =========================
   slot router
   - kind が変わったら DOM を作り直す（プレビュー対応）
   ========================= */
function renderMidSlot_(slotMount, kind, state, actions, index) {
  if (!slotMount) return;

  slotMount.style.display = "";

  // kind が変わったら作り直す（決定前プレビューのため）
  if (slotMount.__kind !== kind) {
    clear(slotMount);
    slotMount.__kind = kind;

    // 再生成用メモを消す（ウィジェット側の __built をやり直す）
    delete slotMount.__w1_body;
    delete slotMount.__built;
    delete slotMount.__w2_built;
  }

  // ===== widget1 =====
  if (kind === "widget1") {
    renderWidget1Card_(slotMount, state, actions);
    return;
  }

  // ===== widget2（原価率分布）=====
  if (kind === "widget2") {
    renderWidget2CostHist(slotMount, actions);
    return;
  }

  // ===== 将来用 scatter（必要なら slot に入れられる）=====
  if (kind === "scatter") {
    renderChartCard_(slotMount, {
      title: "売上 × 原価率（マトリクス）",
      tools: null,
      canvasId: "salesCostScatter",
      onFocus: () => actions.onOpenFocus?.("scatter"),
    });
    return;
  }

  // ===== dummy =====
  renderDummyCard_(slotMount, kind, index, actions);
}

/* =========================
   ウィジェット①（DOMは slotMount 内に保持）
   ========================= */
function renderWidget1Card_(slotMount, state, actions) {
  // 初回だけ枠を作る
  if (!slotMount.__w1_body) {
    clear(slotMount);

    const card = el("div", { class: "card midPanel" });

    const header = el("div", { class: "midPanelHeader" }, [
      el("div", { class: "midPanelTitleWrap" }, [
        el("div", { class: "midPanelTitle", text: "構成比（ドーナツ）" }),
        el("div", { class: "midPanelSub", text: "" }),
      ]),
      el("div", { style: "display:flex; align-items:center; gap:10px;" }, [
        el("button", {
          class: "btn ghost midPanelBtn",
          text: "拡大",
          onClick: (e) => {
            e.preventDefault();
            actions.onOpenFocus?.("shareDonut");
          },
        }),
      ]),
    ]);

    const body = el("div", { class: "midPanelBody" });

    card.appendChild(header);
    card.appendChild(body);
    slotMount.appendChild(card);

    slotMount.__w1_body = body;
  }

  // 毎回：中身だけ更新
  renderWidget1ShareDonut(slotMount.__w1_body, state, actions, { mode: "normal" });
}

/* =========================
   チャートカード（canvas器）
   ========================= */
function renderChartCard_(slotMount, { title, tools, canvasId, onFocus }) {
  if (slotMount.__built) return;
  slotMount.__built = true;

  clear(slotMount);

  const card = el("div", { class: "card midPanel" });

  const headerRight = el(
    "div",
    { style: "display:flex; align-items:center; gap:10px;" },
    []
  );
  if (tools) headerRight.appendChild(tools);
  headerRight.appendChild(
    el("button", {
      class: "btn ghost midPanelBtn",
      text: "拡大",
      onClick: (e) => {
        e.preventDefault();
        onFocus?.();
      },
    })
  );

  const header = el("div", { class: "midPanelHeader" }, [
    el("div", { class: "midPanelTitleWrap" }, [
      el("div", { class: "midPanelTitle", text: title }),
      el("div", { class: "midPanelSub", text: "" }),
    ]),
    headerRight,
  ]);

  const body = el(
    "div",
    { class: "midPanelBody chartBody", onClick: () => onFocus?.() },
    [el("canvas", { id: canvasId })]
  );

  card.appendChild(header);
  card.appendChild(body);
  slotMount.appendChild(card);
}

/* =========================
   ダミー
   ========================= */
function renderDummyCard_(slotMount, kind, index, actions) {
  if (slotMount.__built) return;
  slotMount.__built = true;

  clear(slotMount);

  const card = el("div", { class: "card midPanel" });

  const header = el("div", { class: "midPanelHeader" }, [
    el("div", { class: "midPanelTitleWrap" }, [
      el("div", { class: "midPanelTitle", text: `ダミー (${kind})` }),
      el("div", { class: "midPanelSub", text: "placeholder" }),
    ]),
    el("div", { style: "display:flex; align-items:center; gap:10px;" }, [
      el("button", {
        class: "btn ghost midPanelBtn",
        text: "拡大",
        onClick: (e) => {
          e.preventDefault();
          actions.onOpenFocus?.(`dummy:${kind}:${index}`);
        },
      }),
    ]),
  ]);

  const body = el("div", { class: "midPanelBody" }, [
    el("div", {
      style:
        "height:100%; display:flex; align-items:center; justify-content:center; opacity:.65; border:1px dashed rgba(148,163,184,.35); border-radius:12px;",
      text: `${kind} placeholder`,
    }),
  ]);

  card.appendChild(header);
  card.appendChild(body);
  slotMount.appendChild(card);
}
