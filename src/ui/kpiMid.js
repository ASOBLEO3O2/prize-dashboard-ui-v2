// src/ui/kpiMid.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";
import { GENRES } from "../constants.js";
import { renderDonut } from "../charts/donut.js";

export function renderMidKpi(donutsArea, cardsMount, state, actions) {
  // === 1) Donuts ===
  clear(donutsArea);

  // ドーナツ用データ（構成比）
  const donutSales = GENRES.map(g => ({
    key: g.key,
    label: g.label,
    value: state.byGenre?.[g.key]?.salesShare ?? 0,
    color: g.color,
  }));

  const donutMachines = GENRES.map(g => ({
    key: g.key,
    label: g.label,
    value: state.byGenre?.[g.key]?.machineShare ?? 0,
    color: g.color,
  }));

  // ドーナツ2枚（売上/マシン）
  const wrap = el("div", { class: "midKpiDonuts", style: "display:grid; grid-template-columns: 1fr 1fr; gap: 12px;" }, [
    donutPanel("売上構成比", donutSales, state.focusGenre, actions.onPickGenre),
    donutPanel("マシン構成比", donutMachines, state.focusGenre, actions.onPickGenre),
  ]);

  donutsArea.appendChild(wrap);

  // === 2) Cards ===
  // 既存のカード表示があるなら、ここはあなたの現行の構造に合わせたいので
  // いまは “最小で動くカード表示” を同梱（必要ならあなたのデザインに合わせて後で整える）
  clear(cardsMount);

  const grid = el("div", { style: "display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;" });

  for (const g of GENRES) {
    const data = state.byGenre?.[g.key] || {};
    const dim = (state.focusGenre && state.focusGenre !== g.key);

    const card = el("div", {
      class: "card",
      style: [
        "padding:14px;",
        "border-radius:16px;",
        "border:1px solid rgba(64,87,110,.55);",
        "background:rgba(11,18,26,.55);",
        dim ? "opacity:.35;" : "opacity:1;",
        // 強調（フォーカス中）
        (!dim && state.focusGenre === g.key) ? "outline:2px solid rgba(130,220,160,.55);" : "",
        "cursor:pointer;",
      ].join("")
    });

    card.addEventListener("click", () => actions.onToggleDetail(g.key));

    card.appendChild(el("div", { style: "display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;" }, [
      el("div", { style: "font-weight:900; font-size:18px;" }, [g.label]),
      el("div", { style: "opacity:.75; font-size:12px;" }, ["クリックで詳細"]),
    ]));

    card.appendChild(kv("台数", `${data.machines ?? 0}台`));
    card.appendChild(kv("売上", fmtYen(data.sales ?? 0)));
    card.appendChild(kv("消化額", fmtYen(data.consume ?? 0)));
    card.appendChild(kv("原価率", fmtPct(data.costRate ?? 0, 1)));
    card.appendChild(kv("売上構成比", fmtPct(data.salesShare ?? 0, 1)));
    card.appendChild(kv("マシン構成比", fmtPct(data.machineShare ?? 0, 1)));

    grid.appendChild(card);
  }

  cardsMount.appendChild(grid);
}

function donutPanel(title, values, pickedKey, onPick) {
  const panel = el("div", {
    class: "card",
    style: [
      "padding:14px;",
      "border-radius:16px;",
      "border:1px solid rgba(64,87,110,.55);",
      "background:rgba(11,18,26,.55);",
    ].join("")
  });

  panel.appendChild(el("div", { style: "display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:10px;" }, [
    el("div", { style: "font-weight:900;" }, [title]),
    el("div", { style: "opacity:.65; font-size:12px;" }, ["ジャンル別（%）"]),
  ]));

  const body = el("div", { class: "donutPanelBody" });

  // ✅ これが重要：SVGを入れるための「固定サイズの描画領域」
  const canvas = el("div", { class: "donutCanvas" });
  body.appendChild(canvas);

  // 凡例（チップ）
  const legend = el("div", { class: "donutLegend" });
  for (const seg of values) {
    const active = (!pickedKey || pickedKey === seg.key);
    const chip = el("button", {
      class: "chip",
      style: [
        "border:1px solid rgba(64,87,110,.55);",
        "background:rgba(10,15,22,.55);",
        "color:rgba(235,242,250,.95);",
        "border-radius:999px;",
        "padding:6px 10px;",
        "font-size:12px;",
        "cursor:pointer;",
        active ? "" : "opacity:.35;",
      ].join("")
    }, [seg.label]);

    chip.addEventListener("click", (e) => {
      e.preventDefault();
      const next = (pickedKey === seg.key) ? null : seg.key;
      onPick?.(next);
    });

    legend.appendChild(chip);
  }
  body.appendChild(legend);

  panel.appendChild(body);

  // SVG描画（必ず canvas に入る）
  renderDonut(canvas, {
    title,
    values,
    pickedKey,
    onPick,
  });

  return panel;
}

function kv(k, v) {
  return el("div", { style: "display:flex; justify-content:space-between; gap:10px; padding:3px 0; font-size:13px;" }, [
    el("div", { style: "opacity:.75;" }, [k]),
    el("div", { style: "font-weight:800;" }, [v]),
  ]);
}
