// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: 売上 / ステーション(=booth_id) 構成比（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: ステーション構成比（distinct booth_id）
 * 母集団: state.filteredRows（フィルタ後）
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

function safeStr(v, fallback = "未分類") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}
function toNum(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function yen(n) {
  return new Intl.NumberFormat("ja-JP").format(Math.round(n || 0)) + "円";
}
function pct(v) {
  if (!Number.isFinite(v)) return "0.0%";
  return (v * 100).toFixed(1) + "%";
}

function axisMeta(axisKey) {
  return AXES.find(a => a.key === axisKey) || AXES[3];
}
function getAxisFromState_(state) {
  const raw = safeStr(state?.widget1Axis, "景品ジャンル");
  return (raw === "ジャンル") ? "景品ジャンル" : raw;
}

/** 色：key→hsl（必ず文字列を返す） */
function hashHue_(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}
function colorSolid_(key) {
  const hue = hashHue_(String(key));
  return `hsl(${hue} 80% 55%)`;
}
function colorSoft_(key) {
  const hue = hashHue_(String(key));
  return `hsl(${hue} 75% 70%)`;
}

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

  const totalSales = items.reduce((a, x) => a + x.sales, 0);
  const totalBooths = items.reduce((a, x) => a + x.booths, 0);

  return { items, totalSales, totalBooths };
}

function buildABC_(items, totalSales) {
  let cum = 0;
  return items.map(x => {
    cum += x.sales;
    const r = totalSales ? (cum / totalSales) : 0;
    const rank = (r <= 0.7) ? "A" : (r <= 0.9) ? "B" : "C";
    return { rank, label: x.label, sales: x.sales, color: x.color };
  });
}

function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return mount.__w1_root;

  const root = el("div", { class: `widget1 widget1-${mode}` });

  const header = el("div", { class: "widget1Header" });
  const title = el("div", { class: "widget1Title", text: "景品ジャンル別 売上 / ステーション構成比" });
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

  const body = el("div", { class: "widget1Body" });

  const chartWrap = el("div", { class: "widget1ChartWrap" });
  const canvas = el("canvas", { class: "widget1Canvas" });
  chartWrap.appendChild(canvas);

  const abcWrap = el("div", { class: "widget1ABC" });

  body.appendChild(chartWrap);
  body.appendChild(abcWrap);

  root.appendChild(header);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_canvas = canvas;
  mount.__w1_abc = abcWrap;

  select.addEventListener("change", () => {
    actions.onSetWidget1Axis?.(select.value);
    // requestRender は不要（store.setで描画回る）
  });

  return root;
}

function updateTitle_(mount, axisKey) {
  const meta = axisMeta(axisKey);
  if (mount.__w1_title) {
    mount.__w1_title.textContent = `${meta.titleLabel}別 売上 / ステーション構成比`;
  }
}
function updateSelect_(mount, axisKey) {
  const sel = mount.__w1_select;
  if (sel && sel.value !== axisKey) sel.value = axisKey;
}

function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;
  if (!Chart || !canvas) return;

  // 0件ならチャート作らない（Chart.js側の例外予防）
  if (!items.length || (totalSales <= 0 && totalBooths <= 0)) {
    if (mount.__w1_chart) {
      mount.__w1_chart.destroy();
      mount.__w1_chart = null;
    }
    return;
  }

  const labels = items.map(x => x.label);

  const dataBooths = items.map(x => (totalBooths ? x.booths / totalBooths : 0));
  const dataSales  = items.map(x => (totalSales ? x.sales / totalSales : 0));

  // ✅ 重要：配列の全要素が「文字列」になるように保証
  const colorsInner = items.map(x => String(x.colorSoft || "#93c5fd"));
  const colorsOuter = items.map(x => String(x.color || "#2563eb"));

  const tooltipLabel = (ctx) => {
    const i = ctx.dataIndex;
    const it = items[i];
    const isInner = (ctx.datasetIndex === 0);
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
            label: "台数（ステーション）構成比",
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

  // ✅ updateでは options を触らない（_scriptable再帰回避）
  ch.update("none");
}

function renderABC_(mount, abcRows, totalBooths) {
  const box = mount.__w1_abc;
  if (!box) return;

  clear(box);

  for (const r of abcRows) {
    box.appendChild(
      el("div", { class: `widget1ABCRow rank-${r.rank}` }, [
        el("span", { class: "rank", text: r.rank }),
        el("span", { class: "label", text: r.label }),
        el("span", { class: "value", text: yen(r.sales) }),
      ])
    );
  }

  box.appendChild(
    el("div", {
      class: "widget1Note",
      text: `台数は 1ステーション（ブースID）単位で集計${Number.isFinite(totalBooths) ? `（合計 ${totalBooths}）` : ""}`,
    })
  );
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

  const abc = buildABC_(items, totalSales);
  renderABC_(mount, abc, totalBooths);
}
