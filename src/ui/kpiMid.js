// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";
import { renderDonut } from "../charts/donut.js";
import { GENRES } from "../constants.js";

export function renderMidKpi(donutsMount, cardsMount, state, actions) {
  // ===== Donuts =====
  clear(donutsMount);

  const donuts = el("div", { class: "donuts", style: "width:100%;" });

  donuts.appendChild(donutPanel({
    title: "売上構成比",
    note: "ジャンル別（%）",
    values: GENRES.map(g => ({
      key: g.key,
      label: g.label,
      value: state.byGenre?.[g.key]?.salesShare ?? 0,
      color: g.color,
    })),
    pickedKey: state.focusGenre,
    onPick: actions.onPickGenre,
  }));

  donuts.appendChild(donutPanel({
    title: "マシン構成比",
    note: "ジャンル別（%）",
    values: GENRES.map(g => ({
      key: g.key,
      label: g.label,
      value: state.byGenre?.[g.key]?.machineShare ?? 0,
      color: g.color,
    })),
    pickedKey: state.focusGenre,
    onPick: actions.onPickGenre,
  }));

  donutsMount.appendChild(donuts);

  // ===== Cards =====
  clear(cardsMount);

  // ✅ 親がflexでも縮まないように「幅100%」「flex-basis 100%」を直書き
  const grid = el("div", {
    class: "midCards",
    style: [
      "width:100%",
      "flex:1 1 100%",
      "align-content:start",
      // ✅ 3列固定ではなく、横幅に応じて自動で並べる
      "grid-template-columns:repeat(auto-fit, minmax(260px, 1fr))"
    ].join(";")
  });

  for (const g of GENRES) {
    const d = state.byGenre?.[g.key] || {};

    const isDim = (state.focusGenre && state.focusGenre !== g.key);
    const isFocus = (state.focusGenre === g.key);
    const isOpen = (state.openDetailGenre === g.key);

    const card = el("div", {
      class: `card genreCard ${isDim ? "dim" : ""} ${isFocus ? "focus" : ""} ${isOpen ? "open" : ""}`,
      // ✅ カード自体も潰れない最小幅を保証
      style: "min-width:260px;"
    });

    card.addEventListener("click", () => actions.onToggleDetail(g.key));

    card.appendChild(el("div", { class: "genreCardHeader" }, [
      el("div", { class: "genreName", text: g.label }),
      el("div", { class: "smallMeta", text: "クリックで詳細" }),
    ]));

    const mg = el("div", {
      class: "metricGrid",
      // ✅ 狭い時は1列になるように（JS側で確実化）
      style: "grid-template-columns:1fr 1fr;"
    }, [
      metric("台数", `${d.machines ?? 0}台`),
      metric("売上", fmtYen(d.sales ?? 0)),
      metric("消化額", fmtYen(d.consume ?? 0)),
      metric("原価率", fmtPct(d.costRate ?? 0, 1)),
      metric("売上構成比", fmtPct(d.salesShare ?? 0, 1)),
      metric("マシン構成比", fmtPct(d.machineShare ?? 0, 1)),
    ]);

    card.appendChild(mg);
    grid.appendChild(card);
  }

  cardsMount.appendChild(grid);
}

function donutPanel({ title, note, values, pickedKey, onPick }) {
  const panel = el("div", { class: "donutPanel" });

  const host = el("div", {
    style: "width:170px;height:170px;flex:0 0 170px;display:flex;align-items:center;justify-content:center;overflow:visible;"
  });

  const meta = el("div", { class: "donutMeta" }, [
    el("div", { class: "title", text: title }),
    el("div", { class: "note", text: note }),
    legend(values, pickedKey, onPick),
  ]);

  panel.appendChild(host);
  panel.appendChild(meta);

  renderDonut(host, { title, values, pickedKey, onPick });

  return panel;
}

function legend(values, pickedKey, onPick) {
  const box = el("div", { class: "legend" });
  const fallback = ["#6dd3fb", "#7ee081", "#f2c14e", "#b28dff", "#ff6b6b"];

  values.forEach((seg, idx) => {
    const dim = (pickedKey && pickedKey !== seg.key);

    const sw = el("span", { class: "legendSwatch" });
    sw.style.backgroundColor = seg.color || fallback[idx % fallback.length];

    const label = el("span", { text: seg.label });

    const item = el("div", {
      class: "legendItem",
      style: dim ? "opacity:.35;" : ""
    }, [sw, label]);

    item.addEventListener("click", (e) => {
      e.preventDefault();
      const next = (pickedKey === seg.key) ? null : seg.key;
      onPick?.(next);
    });

    box.appendChild(item);
  });

  return box;
}

function metric(label, value) {
  return el("div", { class: "metric" }, [
    el("div", { class: "label", text: label }),
    // ✅ 「2,010,800円」が絶対に改行されないように直書き
    el("div", { class: "value", text: value, style: "white-space:nowrap;" }),
  ]);
}
