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

  const section = el("div", { class: "section" }, [
    el("div", { class: "sectionHeader" }, [
      el("div", { class: "sectionTitle", text: "中段KPI" }),
      el("div", { class: "sectionHint", text: "ドーナツ → カード強調 / カード → 下に詳細展開" }),
    ]),
    el("div", { class: "midKpiWrap", id: "midKpiWrap" }, [
      el("div", { class: "midTop" }, [
        el("div", { class: "donuts", id: "donutsArea" }),
      ]),
      el("div", { class: "midCards", id: "midCards" }),
    ]),
    el("div", { id: "detailMount" }),
  ]);

  container.appendChild(topbar);
  container.appendChild(topKpi);
  container.appendChild(section);

  root.appendChild(container);

  // Drawer mount
  const overlay = el("div", { class: "drawerOverlay", id: "drawerOverlay", onClick: actions.onCloseDrawer });
  const drawer = el("div", { class: "drawer", id: "drawer" });
  root.appendChild(overlay);
  root.appendChild(drawer);

  return {
    updatedBadge: container.querySelector("#updatedBadge"),
    topKpi,
    donutsArea: container.querySelector("#donutsArea"),
    midCards: container.querySelector("#midCards"),
    detailMount: container.querySelector("#detailMount"),
    drawer,
    drawerOverlay: overlay,
  };
}
