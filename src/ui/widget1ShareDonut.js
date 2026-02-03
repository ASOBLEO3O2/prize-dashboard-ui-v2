// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: 売上 / ブース(=booth_id=1行) 構成比（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: 台数（=ブース数）構成比
 *
 * ✅ 最重要（あなたの定義）
 * - 1ブース = 1行（filteredRows の 1要素）
 * - 台数(ブース数) = rows.length
 * - booth_id を distinct で数え直すのは禁止（= 192バグの温床）
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
  return AXES.find(a => a.key === axisKey) || AXES.find(a => a.key === "景品ジャンル");
}

function getAxisFromState_(state) {
  // app.js 初期値が "ジャンル" の場合も吸収
  const raw = safeStr(state?.widget1Axis, "景品ジャンル");
  return (raw === "ジャンル") ? "景品ジャンル" : raw;
}

/** 色：カテゴリkeyから安定生成（同じkeyは常に同色） */
function hashHue_(str) {
  let h = 0;
  const s = String(str ?? "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
function colorSolid_(key) {
  const hue = hashHue_(key);
  return `hsl(${hue} 80% 55%)`;
}
function colorSoft_(key) {
  const hue = hashHue_(key);
  return `hsl(${hue} 75% 70%)`;
}

function pct(v) {
  if (!Number.isFinite(v)) return "0.0%";
  return (v * 100).toFixed(1) + "%";
}

/**
 * ✅ 集計：rows をそのまま group by
 * - booths(台数) は「行数カウント」
 * - totalBooths は rows.length
 * - booth_id の distinct は一切しない
 */
function buildAgg_(rows, axisKey) {
  const map = new Map();

  for (const r of rows) {
    const k = safeStr(r?.[axisKey], "未分類");
    let o = map.get(k);
    if (!o) {
      o = { key: k, label: k, sales: 0, booths: 0 };
      map.set(k, o);
    }
    o.sales += toNum(r?.sales);
    o.booths += 1; // ✅ 1行=1ブース
  }

  const items = Array.from(map.values()).map(x => ({
    key: x.key,
    label: x.label,
    sales: x.sales,
    booths: x.booths,
    color: colorSolid_(x.key),
    colorSoft: colorSoft_(x.key),
  }));

  items.sort((a, b) => (b.sales - a.sales) || (b.booths - a.booths) || String(a.label).localeCompare(String(b.label), "ja"));

  const totalSales = items.reduce((a, x) => a + (Number(x.sales) || 0), 0);
  const totalBooths = rows.length; // ✅ ここが母数（278）

  return { items, totalSales, totalBooths };
}

function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return mount.__w1_root;

  const root = el("div", { class: `widget1 widget1-${mode}` });

  // header
  const header = el("div", { class: "widget1Header" });
  const title = el("div", { class: "widget1Title", text: "景品ジャンル別 売上 / ブース構成比" });
  const left = el("div", { class: "widget1HeaderLeft" }, [title]);

  const btnExpand = el("button", {
    class: "btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  const selectWrap = el("div", { class: "widget1SelectWrap" });
  const select = el("select", { class: "widget1Select" });
  AXES.forEach(a => select.appendChild(el("option", { value: a.key, text: a.label })));
  selectWrap.appendChild(select);

  const right = el("div", { class: "widget1HeaderRight" }, []);
  if (mode === "normal") right.appendChild(btnExpand);
  right.appendChild(selectWrap);

  header.appendChild(left);
  header.appendChild(right);

  // body
  const body = el("div", { class: "widget1Body" });

  const chartWrap = el("div", { class: "widget1ChartWrap" });
  const canvas = el("canvas", { class: "widget1Canvas" });
  chartWrap.appendChild(canvas);

  const listWrap = el("div", { class: "widget1ABC" });

  body.appendChild(chartWrap);
  body.appendChild(listWrap);

  root.appendChild(header);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  // refs
  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_canvas = canvas;
  mount.__w1_list = listWrap;

  // change handler（1回だけ）
  select.addEventListener("change", () => {
    const axisKey = select.value;
    // ✅ state直書き禁止：storeに確定
    actions.onSetWidget1Axis?.(axisKey);
    // store.set で render が回る前提。二重更新を避けるので requestRender は呼ばない。
  });

  return root;
}

function updateTitle_(mount, axisKey) {
  const meta = axisMeta(axisKey);
  const title = mount.__w1_title;
  if (!title) return;
  title.textContent = `${meta.titleLabel}別 売上 / ブース構成比`;
}

function updateSelect_(mount, axisKey) {
  const sel = mount.__w1_select;
  if (!sel) return;
  if (sel.value !== axisKey) sel.value = axisKey;
}

function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;
  if (!Chart || !canvas) return;

  const labels = items.map(x => x.label);

  // 比率（0..1）
  const dataBooths = items.map(x => (totalBooths ? x.booths / totalBooths : 0));
  const dataSales  = items.map(x => (totalSales ? x.sales / totalSales : 0));

  // 色
  const colorsInner = items.map(x => x.colorSoft || "#93c5fd");
  const colorsOuter = items.map(x => x.color || "#2563eb");

  // ✅ Tooltip: 台数〇台（ブース）/ 構成比〇%
  const tooltipLabel = (ctx) => {
    const i = ctx.dataIndex;
    const it = items[i];
    const isInner = (ctx.datasetIndex === 0); // 0: 台数, 1: 売上
    const share = isInner ? dataBooths[i] : dataSales[i];
    return `${it.label} / 台数 ${it.booths}台（ブース） / 構成比 ${pct(share)}`;
  };

  if (!mount.__w1_chart) {
    mount.__w1_chart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            label: "台数（ブース）構成比",
            data: dataBooths,
            backgroundColor: colorsInner,
            borderColor: "rgba(10,15,20,.65)",
            borderWidth: 1,
            radius: "55%",
          },
          {
            label: "売上構成比",
            data: dataSales,
            backgroundColor: colorsOuter,
            borderColor: "rgba(10,15,20,.65)",
            borderWidth: 1,
            radius: "95%",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "40%",
        animation: false,
        resizeDelay: 80,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,                 // ✅ 強制ON
            callbacks: { label: tooltipLabel },
          },
        },
      },
    });
    return;
  }

  const ch = mount.__w1_chart;

  ch.data.labels = labels;

  ch.data.datasets[0].data = dataBooths;
  ch.data.datasets[0].backgroundColor = colorsInner;

  ch.data.datasets[1].data = dataSales;
  ch.data.datasets[1].backgroundColor = colorsOuter;

  // ✅ updateでも tooltip を強制維持
  ch.options.plugins = ch.options.plugins || {};
  ch.options.plugins.tooltip = {
    enabled: true,
    callbacks: { label: tooltipLabel },
  };

  ch.update("none");
}

function renderList_(mount, items, totalSales, totalBooths) {
  const box = mount.__w1_list;
  if (!box) return;

  clear(box);

  if (!items.length) {
    box.appendChild(el("div", { class: "widget1Empty", text: "データなし" }));
    box.appendChild(el("div", { class: "widget1Note", text: `台数は ブースID（=1行）単位で集計（合計 ${totalBooths}）` }));
    return;
  }

  for (const it of items) {
    const salesShare = totalSales ? (it.sales / totalSales) : 0;

    box.appendChild(
      el("div", { class: "widget1Row" }, [
        el("span", { class: "w1chip", style: `background:${it.color};` }),
        el("div", { class: "widget1RowMain" }, [
          el("div", { class: "widget1RowLabel", text: it.label }),
          el("div", { class: "widget1RowSub", text: `台数 ${it.booths}台（ブース） / 売上構成比 ${pct(salesShare)}` }),
        ]),
        el("div", { class: "widget1RowValue", text: yen(it.sales) }),
      ])
    );
  }

  box.appendChild(
    el("div", {
      class: "widget1Note",
      text: `台数は ブースID（=1行）単位で集計（合計 ${totalBooths}）`
    })
  );
}

export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;
  const mode = opts.mode || "normal";

  ensureDom_(mount, actions, mode);

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  // 軸（stateの揺れを吸収）
  const axisKey = getAxisFromState_(state);
  updateSelect_(mount, axisKey);
  updateTitle_(mount, axisKey);

  const { items, totalSales, totalBooths } = buildAgg_(rows, axisKey);

  upsertChart_(mount, items, totalSales, totalBooths);
  renderList_(mount, items, totalSales, totalBooths);
}
