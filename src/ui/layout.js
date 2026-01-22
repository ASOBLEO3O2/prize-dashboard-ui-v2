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

  // ✅ 追加：チャート2枚（原価率分布 / 売上×原価率）
  const chartsGrid = el("div", { class: "chartsGrid", id: "chartsGrid" }, [
    el("div", { class: "chartCard" }, [
      el("div", { class: "chartHeader" }, [
        el("div", { class: "chartTitle", text: "原価率 分布" }),
        el("div", { class: "chartTools" }, [
          el("select", { class: "select", id: "costHistMode" }, [
            el("option", { value: "count", text: "台数" }),
            el("option", { value: "sales", text: "売上" }),
          ])
        ])
      ]),
      el("div", { class: "chartBody" }, [
        el("canvas", { id: "costHistChart" })
      ])
    ]),

    el("div", { class: "chartCard" }, [
      el("div", { class: "chartHeader" }, [
        el("div", { class: "chartTitle", text: "売上 × 原価率（マトリクス）" }),
      ]),
      el("div", { class: "chartBody" }, [
        el("canvas", { id: "salesCostScatter" })
      ])
    ])
  ]);

  const section = el("div", { class: "section" }, [
    el("div", { class: "sectionHeader" }, [
      el("div", { class: "sectionTitle", text: "中段KPI" }),
      el("div", { class: "sectionHint", text: "ドーナツ → カード強調 / カード → 下に詳細展開" }),
    ]),
    el("div", { class: "midKpiWrap", id: "midKpiWrap" }, [
      el("div", { class: "midTop" }, [
        el("div", { class: "donuts", id: "donutsArea" }),
        chartsGrid, // ✅ ここに追加
      ]),
      // ✅ ここがポイント：gridにしない「マウント専用」
      el("div", { class: "midCardsMount", id: "midCards" }),
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

    // ✅ 追加：チャートDOM参照（必要なら使う）
    costHistMode: container.querySelector("#costHistMode"),
    costHistCanvas: container.querySelector("#costHistChart"),
    salesCostCanvas: container.querySelector("#salesCostScatter"),

    drawer,
    drawerOverlay: overlay,
  };
}
