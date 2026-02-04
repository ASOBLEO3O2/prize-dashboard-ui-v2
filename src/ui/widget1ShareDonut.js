// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: 売上 / ステーション(=booth_id) 構成比（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: ステーション構成比（distinct booth_id）
 *
 * 右側は「凡例＋売上金額」のみ（A/B/Cは廃止）
 */

const AXES = [
  { key: "料金", label: "① 料金", titleLabel: "料金" },
  { key: "回数", label: "② プレイ回数", titleLabel: "プレイ回数" },
  { key: "投入法", label: "③ 投入法", titleLabel: "投入法" },
  { key: "景品ジャンル", label: "④ 景品ジャンル", titleLabel: "景品ジャンル" },
  { key: "ターゲット", label: "⑤ ターゲット", titleLabel: "ターゲット" },
  { key: "年代", label: "⑥ 年代", titleLabel: "年代" },
  { key: "キャラ", label: "⑦ キャラ", titleLabel: "キャラ" },
  { key: "映画", label: "⑧ 映画", titleLabel: "映画" },
  { key: "予約", label: "⑨ 予約", titleLabel: "予約" },
  { key: "WLオリジナル", label: "⑩ WLオリジナル", titleLabel: "WLオリジナル" },
];

function toNum(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function yen(n) {
  return new Intl.NumberFormat("ja-JP").format(Math.round(n || 0)) + "円";
}

function safeStr(v, fallback = "未分類") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function axisMeta(axisKey) {
  return AXES.find(a => a.key === axisKey) || AXES[3];
}

function getAxisFromState_(state) {
  const raw = safeStr(state?.widget1Axis, "景品ジャンル");
  return raw === "ジャンル" ? "景品ジャンル" : raw;
}

/* ===== 色 ===== */
function hashHue_(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}
function colorSolid_(key) {
  return `hsl(${hashHue_(String(key))}, 80%, 55%)`;
}
function colorSoft_(key) {
  return `hsl(${hashHue_(String(key))}, 75%, 70%)`;
}

/* ===== 集計 ===== */
function buildAgg_(rows, axisKey) {
  const map = new Map();

  for (const r of rows) {
    const k = safeStr(r?.[axisKey], "未分類");
    let o = map.get(k);
    if (!o) {
      o = { key: k, label: k, sales: 0, booths: new Set() };
      map.set(k, o);
    }
    o.sales += toNum(r?.sales);
    if (r?.booth_id != null) o.booths.add(String(r.booth_id));
  }

  const items = Array.from(map.values()).map(x => ({
    key: x.key,
    label: x.label,
    sales: x.sales,
    booths: x.booths.size,
    color: colorSolid_(x.key),
    colorSoft: colorSoft_(x.key),
  }));

  items.sort((a, b) => b.sales - a.sales);

  return {
    items,
    totalSales: items.reduce((a, x) => a + x.sales, 0),
    totalBooths: items.reduce((a, x) => a + x.booths, 0),
  };
}

/* ===== DOM ===== */
function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return;

  const root = el("div", { class: `widget1 widget1-${mode}` });

  const header = el("div", { class: "widget1Header" });
  const title = el("div", { class: "widget1Title" });
  const left = el("div", { class: "widget1HeaderLeft" }, [title]);

  const btnExpand = el("button", {
    class: "btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  const select = el("select", { class: "widget1Select" });
  AXES.forEach(a => select.appendChild(el("option", { value: a.key, text: a.label })));

  const right = el("div", { class: "widget1HeaderRight" }, []);
  if (mode === "normal") right.appendChild(btnExpand);
  right.appendChild(select);

  header.append(left, right);

  const body = el("div", { class: "widget1Body" });
  const chartWrap = el("div", { class: "widget1ChartWrap" }, [
    el("canvas", { class: "widget1Canvas" }),
  ]);
  const list = el("div", { class: "widget1ABC" });

  body.append(chartWrap, list);
  root.append(header, body);

  clear(mount);
  mount.appendChild(root);

  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_canvas = chartWrap.querySelector("canvas");
  mount.__w1_list = list;

  select.addEventListener("change", () => {
    actions.onSetWidget1Axis?.(select.value);
    actions.requestRender?.();
  });
}

function updateTitle_(mount, axisKey) {
  mount.__w1_title.textContent =
    `${axisMeta(axisKey).titleLabel}別 売上 / ステーション構成比`;
}

function updateSelect_(mount, axisKey) {
  if (mount.__w1_select.value !== axisKey)
    mount.__w1_select.value = axisKey;
}

/* ===== チャート ===== */
function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;
  if (!Chart || !canvas) return;

  const dataBooths = items.map(x => totalBooths ? x.booths / totalBooths : 0);
  const dataSales  = items.map(x => totalSales ? x.sales / totalSales : 0);

  const tooltipLabel = (ctx) => {
    const i = ctx.dataIndex;
    const it = items[i];
    const share = ctx.datasetIndex === 0 ? dataBooths[i] : dataSales[i];
    return `${it.label} / ${yen(it.sales)} / ${(share * 100).toFixed(1)}%`;
  };

  if (mount.__w1_chart) {
    mount.__w1_chart.data.datasets[0].data = dataBooths;
    mount.__w1_chart.data.datasets[1].data = dataSales;
    mount.__w1_chart.update("none");
    return;
  }

  mount.__w1_chart = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: items.map(x => x.label),
      datasets: [
        { data: dataBooths, backgroundColor: items.map(x => x.colorSoft), radius: "55%" },
        { data: dataSales,  backgroundColor: items.map(x => x.color),     radius: "95%" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: tooltipLabel } },
      },
    },
  });
}

/* ===== 凡例（ABCなし） ===== */
function renderList_(mount, items) {
  clear(mount.__w1_list);
  items.forEach(it => {
    mount.__w1_list.appendChild(
      el("div", { class: "widget1Row" }, [
        el("span", { class: "w1chip", style: `background:${it.color}` }),
        el("span", { text: it.label }),
        el("span", { style: "margin-left:auto;font-weight:800;" }, [yen(it.sales)]),
      ])
    );
  });
}

export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;
  ensureDom_(mount, actions, opts.mode || "normal");

  const axisKey = getAxisFromState_(state);
  updateSelect_(mount, axisKey);
  updateTitle_(mount, axisKey);

  const rows = Array.isArray(state.filteredRows) ? state.filteredRows : [];
  const { items, totalSales, totalBooths } = buildAgg_(rows, axisKey);

  upsertChart_(mount, items, totalSales, totalBooths);
  renderList_(mount, items);
}
