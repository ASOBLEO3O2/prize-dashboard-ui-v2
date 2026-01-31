// src/ui/layout.js
import { el } from "../utils/dom.js";

export function mountLayout(root, actions) {
  const container = el("div", { class: "container" });

  const topbar = el("div", { class: "topbar" }, [
    el("div", { class: "left" }, [
      el("div", { class: "brand", text: "プライズシート" }),
      el("div", { class: "badge", id: "updatedBadge", text: "更新日: —" }),
    ]),
    el("div", { class: "right" }, [
      el("button", { class: "btn ghost", onClick: actions.onRefresh, text: "更新（モック）" }),
      el("button", { class: "btn primary", onClick: actions.onOpenDrawer, text: "ドロワー" }),
    ])
  ]);

  const topKpi = el("div", { class: "kpiTop", id: "topKpi" });

  // =========================
  // 中段：器だけ（#midDash を復活）
  //  - 2×2固定（5枠なし）
  //  - 中身はゼロ（kpiMid 側が後で差し込む）
  // =========================
  const midDash = el("div", { id: "midDash" }, [
    el("div", { class: "midPanel dashPanel", id: "midSlotSalesDonut" }),
    el("div", { class: "midPanel dashPanel", id: "midSlotMachineDonut" }),
    el("div", { class: "midPanel dashPanel", id: "midSlotCostHist" }),
    el("div", { class: "midPanel dashPanel", id: "midSlotScatter" }),
  ]);

  const section = el("div", { class: "section" }, [
    el("div", { class: "sectionHeader" }, [
      el("div", { class: "sectionTitle", text: "中段KPI" }),
      el("div", { class: "sectionHint", text: "カードをタップ → 拡大表示（ドーナツは下層へ）" }),
    ]),
    el("div", { class: "midKpiWrap", id: "midKpiWrap" }, [
      // ✅ 上段：2×2の器（#midDash）
      el("div", { class: "midTop", id: "midTop" }, [
        midDash,
      ]),
      // ✅ 下段（既存の下段カード：無罪・触らない）
      el("div", { class: "midCardsMount", id: "midCards" }),
    ]),
    el("div", { id: "detailMount" }),
  ]);

  container.appendChild(topbar);
  container.appendChild(topKpi);
  container.appendChild(section);
  root.appendChild(container);

  // =========================
  // フォーカス（上層レイヤー）
  //  - 中段カードを拡大表示するための器だけ
  // =========================
  const focusOverlay = el("div", { class: "focusOverlay", id: "focusOverlay" });
  const focusModal = el("div", { class: "focusModal", id: "focusModal" });
  focusOverlay.appendChild(focusModal);
  root.appendChild(focusOverlay);

  // Drawer mount
  const overlay = el("div", { class: "drawerOverlay", id: "drawerOverlay", onClick: actions.onCloseDrawer });
  const drawer = el("div", { class: "drawer", id: "drawer" });
  root.appendChild(overlay);
  root.appendChild(drawer);

  return {
    updatedBadge: container.querySelector("#updatedBadge"),
    topKpi,

    // ✅ 中段4スロット（midDash 内に実体あり）
    midSlotSalesDonut: container.querySelector("#midSlotSalesDonut"),
    midSlotMachineDonut: container.querySelector("#midSlotMachineDonut"),
    midSlotCostHist: container.querySelector("#midSlotCostHist"),
    midSlotScatter: container.querySelector("#midSlotScatter"),

    // ✅ 既存：下段カード（無罪）
    midCards: container.querySelector("#midCards"),
    detailMount: container.querySelector("#detailMount"),

    // ✅ フォーカス（上層レイヤー）
    focusOverlay,
    focusModal,

    drawer,
    drawerOverlay: overlay,
  };
}
