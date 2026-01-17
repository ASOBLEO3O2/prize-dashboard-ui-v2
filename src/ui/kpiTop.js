import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";

export function renderTopKpi(mount, topKpi) {
  clear(mount);

  const items = [
    { title: "売上合計", value: fmtYen(topKpi.sales), sub: "選択中条件の合計" },
    { title: "消化額合計", value: fmtYen(topKpi.consume), sub: "選択中条件の合計" },
    { title: "原価率", value: fmtPct(topKpi.costRate, 1), sub: "選択中条件の原価率" },
    { title: "平均", value: fmtYen(topKpi.avg), sub: "定義は後で確定" },
  ];

  for (const it of items) {
    mount.appendChild(
      el("div", { class: "card kpiCard" }, [
        el("div", { class: "kpiTitle", text: it.title }),
        el("div", { class: "kpiValue", text: it.value }),
        el("div", { class: "kpiSub", text: it.sub }),
      ])
    );
  }
}
