// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: 売上 / ブース(=1行) 構成比（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: 台数（=ブース数）構成比
 *
 * ✅ あなたの定義（最重要）
 * - 1ブース = filteredRows の 1行
 * - 台数(ブース数) = rows.length
 * - booth_id を distinct で数え直すのは禁止（= 192 の原因）
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
 * - totalBooths は rows.length（=正しい台数）
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
  const totalBooths = rows.length;

  return { items, totalSales, totalBooths };
}

function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return mount.__w1_root;

  // ✅ あなたのCSS(.w1-*)に合わせる
  const root = el("div", { class: "w1 card" });

  const head = el("div", { class: "w1-head" });

  const title = el("div", { class: "w1-title", text: "景品ジャンル別 売上 / ブース構成比" });

  const headRight = el("div", { class: "w1-headRight" });

  const btnExpand = el("button", {
    class: "w1-btn",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  const select = el("select", { class: "w1-axis" });
  AXES.forEach(a => select.appendChild(el("option", { value: a.key, text: a.label })));

  if (mode === "normal") headRight.appendChild(btnExpand);
  headRight.appendChild(select);

  head.appendChild(title);
  head.appendChild(headRight);

  const body = el("div", { class: "w1-body" });

  const left = el("div", { class: "w1-left" });
  const canvas = el("canvas", { class: "w1-canvas" }); // classはCSSに無いが問題なし（識別用）
  left.appendChild(canvas);

  const right = el("div", { class: "w1-right" });
  const list = el("div", { class: "w1-list" });
  const note = el("div", { class: "w1-note", text: "" });

  right.appendChild(list);
  right.appendChild(note);

  body.appendChild(left);
  body.appendChild(right);

  root.appendChild(head);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  // refs
  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_canvas = canvas;
  mount.__w1_list = list;
  mount.__w1_note = note;

  // change handler（1回だけ）
  select.addEventListener("change", () => {
    const axisKey = select.value;
    // ✅ state直書き禁止：storeに確定
    actions.onSetWidget1Axis?.(axisKey);
    // store.setでrenderが回る前提。ここで requestRender を追加しない（無限レンダの火種）
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

  const dataBooths = items.map(x => (totalBooths ? x.booths / totalBooths : 0));
  const dataSales  = items.map(x => (totalSales ? x.sales / totalSales : 0));

  const colorsInner = items.map(x => x.colorSoft);
  const colorsOuter = items.map(x => x.color);

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
            enabled: true,
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

  ch.options.plugins = ch.options.plugins || {};
  ch.options.plugins.tooltip = {
    enabled: true,
    callbacks: { label: tooltipLabel },
  };

  ch.update("none");
}

function renderList_(mount, items, totalSales, totalBooths) {
  const list = mount.__w1_list;
  const note = mount.__w1_note;
  if (!list || !note) return;

  clear(list);

  for (const it of items) {
    const salesShare = totalSales ? (it.sales / totalSales) : 0;

    list.appendChild(
      el("div", { class: "w1-row" }, [
        // ✅ CSSの w1-chip を使う（色はCSS変数 --c で注入）
        el("span", { class: "w1-chip", style: `--c:${it.color}` }),
        el("div", {}, [
          el("div", { class: "w1-name", text: it.label }),
          el("div", { class: "w1-note", style: "margin-top:2px; opacity:.75; font-size:12px;" , text: `台数 ${it.booths}台（ブース） / 売上構成比 ${pct(salesShare)}` }),
        ]),
        el("div", { class: "w1-v", text: yen(it.sales) }),
      ])
    );
  }

  // ✅ 注記：合計は rows.length（=ブース数）
  note.textContent = `台数は ブースID（=1行）単位で集計（合計 ${totalBooths}）`;
}

export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;

  const mode = opts.mode || "normal";
  ensureDom_(mount, actions, mode);

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  const axisKey = getAxisFromState_(state);
  updateSelect_(mount, axisKey);
  updateTitle_(mount, axisKey);

  const { items, totalSales, totalBooths } = buildAgg_(rows, axisKey);

  upsertChart_(mount, items, totalSales, totalBooths);
  renderList_(mount, items, totalSales, totalBooths);
}
