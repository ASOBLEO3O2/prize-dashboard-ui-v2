import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";
import { renderDonut } from "../charts/donut.js";
import { GENRES, DONUT_COLORS } from "../constants.js";

function buildDonutValues(byGenre, field) {
  return GENRES.map(g => ({
    key: g.key,
    label: g.label,
    value: byGenre[g.key]?.[field] ?? 0,
    color: DONUT_COLORS[g.key],
  }));
}

export function renderMidKpi(donutsMount, cardsMount, state, actions) {
  // Donuts (card群として)
  clear(donutsMount);

  const salesDonutWrap = el("div", { class: "donutPanel card" }, [
    el("div", { class: "donutMeta" }, [
      el("div", { class: "title", text: "売上構成比" }),
      el("div", { class: "note", text: "ジャンル別（％）" }),
      buildLegend(state, actions),
    ]),
    el("div", { id: "salesDonut" }),
  ]);

  const machineDonutWrap = el("div", { class: "donutPanel card" }, [
    el("div", { class: "donutMeta" }, [
      el("div", { class: "title", text: "マシン構成比" }),
      el("div", { class: "note", text: "ジャンル別（％）" }),
      buildLegend(state, actions),
    ]),
    el("div", { id: "machineDonut" }),
  ]);

  donutsMount.appendChild(salesDonutWrap);
  donutsMount.appendChild(machineDonutWrap);

  const salesVals = buildDonutValues(state.byGenre, "salesShare");
  const machineVals = buildDonutValues(state.byGenre, "machineShare");

  renderDonut(salesDonutWrap.querySelector("#salesDonut"), {
    title: "売上構成比",
    values: salesVals,
    pickedKey: state.focusGenre,
    onPick: actions.onPickGenre,
  });

  renderDonut(machineDonutWrap.querySelector("#machineDonut"), {
    title: "マシン構成比",
    values: machineVals,
    pickedKey: state.focusGenre,
    onPick: actions.onPickGenre,
  });

  // Cards
  clear(cardsMount);

  for (const g of GENRES) {
    const row = state.byGenre[g.key];
    const isFocus = state.focusGenre && state.focusGenre === g.key;
    const isDim = state.focusGenre && state.focusGenre !== g.key;
    const isOpen = state.openDetailGenre === g.key;

    const card = el("div", {
      class: `card genreCard ${isFocus ? "focus" : ""} ${isDim ? "dim" : ""} ${isOpen ? "open" : ""}`,
      onClick: () => actions.onToggleDetail(g.key),
      role: "button",
      tabindex: "0",
    }, [
      el("div", { class: "genreCardHeader" }, [
        el("div", { class: "genreName", text: g.label }),
        el("div", { class: "smallMeta", text: "クリックで詳細" }),
      ]),
      el("div", { class: "metricGrid" }, [
        metric("台数", row?.machines != null ? `${row.machines}台` : "—"),
        metric("売上", fmtYen(row?.sales)),
        metric("消化額", fmtYen(row?.consume)),
        metric("原価率", fmtPct(row?.costRate, 1)),
        metric("売上構成比", fmtPct(row?.salesShare, 1)),
        metric("マシン構成比", fmtPct(row?.machineShare, 1)),
      ])
    ]);

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        actions.onToggleDetail(g.key);
      }
    });

    cardsMount.appendChild(card);
  }
}

function metric(label, value) {
  return el("div", { class: "metric" }, [
    el("div", { class: "label", text: label }),
    el("div", { class: "value", text: value }),
  ]);
}

function buildLegend(state, actions) {
  const legend = el("div", { class: "legend" });
  for (const g of GENRES) {
    const item = el("div", {
      class: "legendItem",
      onClick: () => actions.onPickGenre(state.focusGenre === g.key ? null : g.key),
      title: "クリックでカード強調",
    }, [
      el("span", { class: "legendSwatch", style: `background:${DONUT_COLORS[g.key]};` }),
      el("span", { text: g.label }),
    ]);
    legend.appendChild(item);
  }
  return legend;
}
