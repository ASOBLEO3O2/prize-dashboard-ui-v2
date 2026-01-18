
// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";
import { renderDonut } from "../charts/donut.js";
import { GENRES } from "../constants.js";

export function renderMidKpi(donutsMount, cardsMount, state, actions) {
  // ===== Donuts =====
  clear(donutsMount);

  const donuts = el("div", { class: "donuts" });

  // 売上構成比（%）
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

  // マシン構成比（%）
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

  const grid = el("div", { class: "midCards" });

  for (const g of GENRES) {
    const d = state.byGenre?.[g.key] || {};

    const isDim = (state.focusGenre && state.focusGenre !== g.key);
    const isFocus = (state.focusGenre === g.key);
    const isOpen = (state.openDetailGenre === g.key);

    const card = el("div", {
      class: `card genreCard ${isDim ? "dim" : ""} ${isFocus ? "focus" : ""} ${isOpen ? "open" : ""}`
    });

    card.addEventListener("click", () => actions.onToggleDetail(g.key));

    card.appendChild(el("div", { class: "genreCardHeader" }, [
      el("div", { class: "genreName", text: g.label }),
      el("div", { class: "smallMeta", text: "クリックで詳細" }),
    ]));

    const mg = el("div", { class: "metricGrid" }, [
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

  // ✅ ドーナツ描画領域（CSSをいじらず、ここだけ最小限確保）
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

  for (const seg of values) {
    const dim = (pickedKey && pickedKey !== seg.key);

    const item = el("div", {
      class: "legendItem",
      style: dim ? "opacity:.35;" : ""
    }, [
    el("span", {
  　class: "legendSwatch",
  　style: `background-color:${seg.color || "var(--muted)"} !important;`
　　　}),
　　 el("span", { text: seg.label }),
    ]);

    item.addEventListener("click", (e) => {
      e.preventDefault();
      const next = (pickedKey === seg.key) ? null : seg.key;
      onPick?.(next);
    });

    box.appendChild(item);
  }

  return box;
}

function metric(label, value) {
  return el("div", { class: "metric" }, [
    el("div", { class: "label", text: label }),
    el("div", { class: "value", text: value }),
  ]);
}
