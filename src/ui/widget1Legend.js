// src/ui/widget1Legend.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";

/**
 * legendItems: Array<{
 *   key: string,
 *   label: string,
 *   color: string,            // グラフと同色
 *   sales: number|null,       // 売上
 *   salesShare: number|null,  // 売上構成比（0-1）
 *   machines: number|null,    // 台数
 *   machineShare: number|null,// マシン構成比（0-1）
 *   avgSales: number|null,    // 平均売上（1台あたり等）
 *   consume: number|null,     // 消化額合計
 *   costRate: number|null     // 原価率（0-1）
 * }>
 */
export function renderWidget1Legend(mount, legendItems, opts = {}) {
  const {
    title = null,         // 例: "凡例"
    emptyText = "—",
    maxItems = null,      // nullなら全件
    onHover = null,       // (item, isIn) => void
    onClick = null,       // (item) => void
  } = opts;

  clear(mount);

  if (title) {
    mount.appendChild(el("div", { class: "w1LegendTitle", text: title }));
  }

  if (!legendItems || legendItems.length === 0) {
    mount.appendChild(el("div", { class: "w1LegendEmpty", text: emptyText }));
    return;
  }

  const list = el("div", { class: "w1LegendList" });
  mount.appendChild(list);

  const items = (maxItems != null) ? legendItems.slice(0, maxItems) : legendItems;

  for (const item of items) {
    const block = el("div", {
      class: "w1LegendItem",
      onMouseEnter: () => onHover && onHover(item, true),
      onMouseLeave: () => onHover && onHover(item, false),
      onClick: () => onClick && onClick(item),
      title: "" // 既存tooltipを邪魔しないため空（必要なら後で）
    });

    // 1行目：■ + カテゴリ名
    const head = el("div", { class: "w1LegendHead" }, [
      el("span", { class: "w1LegendSwatch", style: `background:${item.color || "#64748b"}` }),
      el("span", { class: "w1LegendLabel", text: item.label ?? emptyText }),
    ]);

    // 2行目：売上（大）
    const salesText = (item.sales == null) ? emptyText : fmtYen(item.sales);
    const sales = el("div", { class: "w1LegendSales", text: salesText });

    // 3行目：構成比2種（横並び）
    const sShare = (item.salesShare == null) ? emptyText : fmtPct(item.salesShare);
    const mShare = (item.machineShare == null) ? emptyText : fmtPct(item.machineShare);
    const shares = el("div", { class: "w1LegendShares" }, [
      el("span", { class: "w1LegendShare", text: `売上構成比：${sShare}` }),
      el("span", { class: "w1LegendShareSep", text: "｜" }),
      el("span", { class: "w1LegendShare", text: `マシン構成比：${mShare}` }),
    ]);

    // 4行目以降：小指標（縦並び）
    const avg = (item.avgSales == null) ? emptyText : fmtYen(item.avgSales);
    const cons = (item.consume == null) ? emptyText : fmtYen(item.consume);
    const cr = (item.costRate == null) ? emptyText : fmtPct(item.costRate);

    const meta = el("div", { class: "w1LegendMeta" }, [
      el("div", { class: "w1LegendMetaRow" }, [
        el("span", { class: "k", text: "平均売上：" }),
        el("span", { class: "v", text: avg }),
      ]),
      el("div", { class: "w1LegendMetaRow" }, [
        el("span", { class: "k", text: "消化額合計：" }),
        el("span", { class: "v", text: cons }),
      ]),
      el("div", { class: "w1LegendMetaRow" }, [
        el("span", { class: "k", text: "原価率：" }),
        el("span", { class: "v", text: cr }),
      ]),
    ]);

    block.appendChild(head);
    block.appendChild(sales);
    block.appendChild(shares);
    block.appendChild(meta);

    list.appendChild(block);
  }
}
