// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";
import { GENRES } from "../constants.js";
import { renderDonut } from "../charts/donut.js";

export function renderMidKpi(donutsArea, cardsMount, state, actions) {
  // ===== Donuts area =====
  clear(donutsArea);

  const salesValues = GENRES.map(g => ({
    key: g.key,
    label: g.label,
    value: state.byGenre?.[g.key]?.salesShare ?? 0,
    color: g.color,
  }));

  const machineValues = GENRES.map(g => ({
    key: g.key,
    label: g.label,
    value: state.byGenre?.[g.key]?.machineShare ?? 0,
    color: g.color,
  }));

  const donutsGrid = el("div", { class: "midDonutsGrid" }, [
    donutPanel({
      title: "売上構成比",
      subtitle: "ジャンル別（%）",
      values: salesValues,
      pickedKey: state.focusGenre,
      onPick: actions.onPickGenre,
    }),
    donutPanel({
      title: "マシン構成比",
      subtitle: "ジャンル別（%）",
      values: machineValues,
      pickedKey: state.focusGenre,
      onPick: actions.onPickGenre,
    }),
  ]);

  donutsArea.appendChild(donutsGrid);

  // ===== Cards area =====
  clear(cardsMount);

  const grid = el("div", { class: "midCardsGrid" });

  for (const g of GENRES) {
    const d = state.byGenre?.[g.key] || {};
    const dim = (state.focusGenre && state.focusGenre !== g.key);

    const card = el("div", {
      class: `midCard ${dim ? "isDim" : ""} ${state.focusGenre === g.key ? "isFocus" : ""}`
    });

    card.addEventListener("click", () => actions.onToggleDetail(g.key));

    card.appendChild(el("div", { class: "midCardHead" }, [
      el("div", { class: "midCardTitle", text: g.label }),
      el("div", { class: "midCardHint", text: "クリックで詳細" }),
    ]));

    card.appendChild(kv("台数", `${d.machines ?? 0}台`));
    card.appendChild(kv("売上", fmtYen(d.sales ?? 0)));
    card.appendChild(kv("消化額", fmtYen(d.consume ?? 0)));
    card.appendChild(kv("原価率", fmtPct(d.costRate ?? 0, 1)));
    card.appendChild(kv("売上構成比", fmtPct(d.salesShare ?? 0, 1)));
    card.appendChild(kv("マシン構成比", fmtPct(d.machineShare ?? 0, 1)));

    grid.appendChild(card);
  }

  cardsMount.appendChild(grid);
}

function donutPanel({ title, subtitle, values, pickedKey, onPick }) {
  const panel = el("div", { class: "donutPanel" });

  panel.appendChild(el("div", { class: "donutPanelHead" }, [
    el("div", { class: "donutPanelTitle", text: title }),
    el("div", { class: "donutPanelSub", text: subtitle }),
  ]));

  const body = el("div", { class: "donutPanelBody" });

  // ✅ ここがポイント：固定サイズの描画領域
  const canvas = el("div", { class: "donutCanvas" });

  const legend = el("div", { class: "donutLegend" });
  for (const seg of values) {
    const active = (!pickedKey || pickedKey === seg.key);
    const chip = el("button", {
      class: `donutChip ${active ? "" : "isDim"}`,
      type: "button",
    }, [seg.label]);

    chip.addEventListener("click", (e) => {
      e.preventDefault();
      const next = (pickedKey === seg.key) ? null : seg.key;
      onPick?.(next);
    });

    legend.appendChild(chip);
  }

  body.appendChild(canvas);
  body.appendChild(legend);

  panel.appendChild(body);

  // ドーナツ描画（canvasに必ず入る）
  renderDonut(canvas, { title, values, pickedKey, onPick });

  // 下に説明（元UIの文言に近い）
  panel.appendChild(el("div", { class: "donutNote", text: `${title}クリックで強調` }));

  return panel;
}

function kv(k, v) {
  return el("div", { class: "kvRow" }, [
    el("div", { class: "kvKey", text: k }),
    el("div", { class: "kvVal", text: v }),
  ]);
}
