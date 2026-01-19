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

  // いまは「ジャンル」だけ既存stateから作れる（将来: axis切替でも使える形）
  const parents = buildGenreParents_(state);

  // 並び替え（ドロワー側で state.midSortKey / midSortDir を更新する想定）
  const sortKey = state.midSortKey || "sales";     // "sales" | "consume" | "costRate" | "machines"
  const sortDir = state.midSortDir || "desc";      // "asc" | "desc"
  const sortedParents = sortItems_(parents, sortKey, sortDir);

  for (const p of sortedParents) {
    const isDim = (state.focusGenre && state.focusGenre !== p.key);
    const isFocus = (state.focusGenre === p.key);
    const isOpenDetail = (state.openDetailGenre === p.key);

    const isExpanded = (state.midExpandedParentKey === p.key);
    const hasChildren = Array.isArray(p.children) && p.children.length > 0;

    const card = el("div", {
      class: `card genreCard ${isDim ? "dim" : ""} ${isFocus ? "focus" : ""} ${isOpenDetail ? "open" : ""}`
    });

    // 既存仕様：カードクリックは詳細（テーブル）を開く
    card.addEventListener("click", () => actions.onToggleDetail(p.key));

    card.appendChild(el("div", { class: "genreCardHeader" }, [
      el("div", { class: "genreName", text: p.label }),
      el("div", { style: "display:flex; gap:8px; align-items:center;" }, [
        el("div", { class: "smallMeta", text: "クリックで詳細" }),

        // ✅ 掘り下げ（カード内展開）は右端のボタンで
        hasChildren ? el("button", {
          class: "btn ghost",
          text: isExpanded ? "▾" : "▸",
          onClick: (e) => {
            e.stopPropagation(); // カードクリック（詳細開く）を止める
            state.midExpandedParentKey = isExpanded ? null : p.key; // 1つだけ展開
            actions.requestRender?.(); // あれば（無ければ下の行でOK）
            // actions.onRefreshMid?.(); // こういう再描画フックがあるならそれでもOK
          }
        }) : null,
      ])
    ]));

    // 親のKPI
    card.appendChild(el("div", { class: "metricGrid" }, [
      metric("台数", `${p.machines ?? 0}台`),
      metric("売上", fmtYen(p.sales ?? 0)),
      metric("消化額", fmtYen(p.consume ?? 0)),
      metric("原価率", fmtPct(p.costRate ?? 0, 1)),
    ]));

    // ✅ 子のカード（カード内展開）
    if (hasChildren && isExpanded) {
      let children = sortItems_(p.children, sortKey, sortDir);

      card.appendChild(el("div", { class: "childWrap" }, [
        el("div", { class: "childGrid" },
          children.map(ch => el("div", { class: "childCard" }, [
            el("div", { class: "childTitle", text: ch.label }),
            el("div", { class: "childMeta" }, [
              el("div", { text: `台数 ${ch.machines ?? 0}台` }),
              el("div", { text: `売上 ${fmtYen(ch.sales ?? 0)}` }),
              el("div", { text: `消化額 ${fmtYen(ch.consume ?? 0)}` }),
              el("div", { text: `原価率 ${fmtPct(ch.costRate ?? 0, 1)}` }),
            ])
          ]))
        )
      ]));


function donutPanel({ title, note, values, pickedKey, onPick }) {
  const panel = el("div", { class: "donutPanel" });

  // ドーナツ描画領域（固定）
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
    el("div", { class: "value", text: value, style: "white-space:nowrap;" }),
  ]);
}

function buildGenreParents_(state) {
  // 親：GENRES（既存）
  // 子：state.byGenreChildren?.[genreKey] があればカード内展開する
  return GENRES.map(g => {
    const d = state.byGenre?.[g.key] || {};
    const children = state.byGenreChildren?.[g.key] || null; // 任意

    return {
      key: g.key,
      label: g.label,
      machines: d.machines ?? 0,
      sales: d.sales ?? 0,
      consume: d.consume ?? 0,
      costRate: d.costRate ?? 0,
      children: Array.isArray(children) ? children : null,
    };
  });
}

function sortItems_(items, key, dir) {
  const k = key;
  const sign = (dir === "asc") ? 1 : -1;

  return [...items].sort((a, b) => {
    const av = Number(a?.[k]) || 0;
    const bv = Number(b?.[k]) || 0;
    if (av === bv) return 0;
    return (av < bv ? -1 : 1) * sign;
  });
}

