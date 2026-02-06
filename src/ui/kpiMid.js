// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";

/**
 * 目的（ダミー固定フェーズ）：
 * - 中段KPI（2×2）の「4枚の既定カード」を必ず表示して
 *   レイアウト（高さ/幅/被さり）を確定させる。
 *
 * このファイルでは：
 * - ✅ 上段4枚：ダミー固定（header + body 統一）
 * - ✅ canvas：2枚（costHistChart / salesCostScatter）は “器だけ” 出す
 * - ✅ widget1 の実描画は一旦止める（被さり原因の切り分け）
 * - ✅ 下段（midCards）は一旦表示しない（もう不要、とのことなので）
 *
 * ※この後：レイアウトが固まったら widget1 を “同じ枠” に戻す
 */
export function renderMidKpi(mounts, state, actions) {

  console.log("[KPI_MID] LOADED dummy-phase 2026-02-06 r1");  // スロットが無い場合は何もしない
 
  if (!mounts) return;

  // 旧「マシン構成比」枠が残っていれば隠す（保険）
  if (mounts.midSlotMachineDonut && !mounts.midSlotMachineDonut.__hiddenOnce) {
    clear(mounts.midSlotMachineDonut);
    mounts.midSlotMachineDonut.style.display = "none";
    mounts.midSlotMachineDonut.__hiddenOnce = true;
  }

  // ===== 4枚：既定カード（ダミー） =====
  renderDummyCardOnce_(mounts.midSlotSalesDonut, {
    title: "構成比（ドーナツ）",
    body: buildDummyBox_("widget1 placeholder"),
    onFocus: () => actions.onOpenFocus?.("shareDonut"),
  });

  renderCanvasCardOnce_(mounts.midSlotCostHist, {
    title: "原価率 分布",
    tools: el("div", { class: "chartTools" }, [
      el("select", { class: "select", id: "costHistMode" }, [
        el("option", { value: "count", text: "台数" }),
        el("option", { value: "sales", text: "売上" }),
      ]),
    ]),
    canvasId: "costHistChart",
    onFocus: () => actions.onOpenFocus?.("costHist"),
  });

  renderCanvasCardOnce_(mounts.midSlotScatter, {
    title: "売上 × 原価率（マトリクス）",
    tools: null,
    canvasId: "salesCostScatter",
    onFocus: () => actions.onOpenFocus?.("scatter"),
  });

  // 4枚目（今は“空き”になっている想定の枠があればそこに出す）
  // ※mount名がプロジェクトで違う可能性があるので「存在するなら」だけ描く
  //    ここはあなたのlayout.jsのmount名に合わせて後で調整します。
  const slot4 =
    mounts.midSlotExtra ||
    mounts.midSlot4 ||
    mounts.midSlotMachineDonut || // もし4枠目として使い回すなら
    null;

  if (slot4 && slot4 !== mounts.midSlotMachineDonut) {
    renderDummyCardOnce_(slot4, {
      title: "ダミー枠（4枚目）",
      body: buildDummyBox_("slot4 placeholder"),
      onFocus: () => actions.onOpenFocus?.("dummy4"),
    });
  }

  // ===== 下段：今は不要 → 非表示 =====
  if (mounts.midCards) {
    clear(mounts.midCards);
    mounts.midCards.style.display = "none";
  }
}

/* =========================
   共通：ヘッダー（統一）
   ========================= */

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

/* =========================
   ダミーカード：1回だけ作る
   ========================= */

function renderDummyCardOnce_(slotMount, { title, body, onFocus }) {
  if (!slotMount) return;
  if (slotMount.__built) return;
  slotMount.__built = true;

  clear(slotMount);
  slotMount.style.display = "";

  const card = el("div", { class: "card midPanel" });
  const header = buildHeader_({ title, tools: null, onFocus });

  const panelBody = el("div", { class: "midPanelBody" }, [body]);

  card.appendChild(header);
  card.appendChild(panelBody);
  slotMount.appendChild(card);
}

/* =========================
   canvasカード：1回だけ作る（器だけ）
   ========================= */

function renderCanvasCardOnce_(slotMount, { title, tools, canvasId, onFocus }) {
  if (!slotMount) return;
  if (slotMount.__built) return;
  slotMount.__built = true;

  clear(slotMount);
  slotMount.style.display = "";

  const card = el("div", { class: "card midPanel" });
  const header = buildHeader_({ title, tools, onFocus });

  const panelBody = el(
    "div",
    { class: "midPanelBody chartBody", onClick: () => onFocus?.() },
    [el("canvas", { id: canvasId })]
  );

  card.appendChild(header);
  card.appendChild(panelBody);
  slotMount.appendChild(card);
}

/* =========================
   ダミー中身
   ========================= */

function buildDummyBox_(text) {
  return el(
    "div",
    {
      style:
        "height:100%; width:100%; display:flex; align-items:center; justify-content:center; opacity:.6; border:1px dashed rgba(148,163,184,.5); border-radius:12px;",
      text,
    },
    []
  );
}
