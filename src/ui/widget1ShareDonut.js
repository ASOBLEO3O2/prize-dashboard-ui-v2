import { el, clear } from "../utils/dom.js";

/**
 * Widget①: 売上 / ステーション(=booth_id) 構成比（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: ステーション構成比
 *
 * A/B/C ランクは完全削除
 * 凡例・ツールチップは必ず表示
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

const toNum = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const safeStr = (v, fb = "未分類") => {
  const s = String(v ?? "").trim();
  return s || fb;
};

const axisMeta = (k) => AXES.find(a => a.key === k) || AXES[3];

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
const colorSolid_ = (k) => `hsl(${hashHue_(String(k))},80%,55%)`;
const colorSoft_  = (k) => `hsl(${hashHue_(String(k))},75%,70%)`;

/* ===== 集計 ===== */
function buildAgg_(rows, axisKey) {
  const map = new Map();

  for (const r of rows) {
    const k = safeStr(r?.[axisKey]);
    if (!map.has(k)) {
      map.set(k, { key: k, label: k, sales: 0, booths: new Set() });
    }
    const o = map.get(k);
    o.sales += toNum(r?.sales);
    if (r?.booth_id != null) o.booths.add(String(r.booth_id));
  }

  const items = [...map.values()]
    .map(x => ({
      key: x.key,
      label: x.label,
      sales: x.sales,
      booths: x.booths.size,
      color: colorSolid_(x.key),
      colorSoft: colorSoft_(x.key),
    }))
    .sort((a, b) => b.sales - a.sales);

  const totalSales = items.reduce((a, x) => a + x.sales, 0);
  const totalBooths = items.reduce((a, x) => a + x.booths, 0);

  return { items, totalSales, totalBooths };
}

/* ===== DOM ===== */
function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return;

  const root = el("div", { class: `widget1 widget1-${mode}` });

  const header = el("div", { class: "widget1Header" });
  const title  = el("div", { class: "widget1Title" });
  const left   = el("div", { class: "widget1HeaderLeft" }, [title]);

  const select = el("select", { class: "widget1Select" });
  AXES.forEach(a => select.appendChild(el("option", { value: a.key, text: a.label })));

  const btnExpand = el("button", {
    class: "btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  const right = el("div", { class: "widget1HeaderRight" });
  if (mode === "normal") right.appendChild(btnExpand);
  right.appendChild(select);

  header.appendChild(left);
  header.appendChild(right);

  const body = el("div", { class: "widget1Body" });
  const wrap = el("div", { class: "widget1ChartWrap" });
  const canvas = el("canvas", { class: "widget1Canvas" });
  wrap.appendChild(canvas);
  body.appendChild(wrap);

  root.appendChild(header);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_canvas = canvas;
  mount.__w1_chart = null;
  mount.__w1_axis = null;

  select.addEventListener("change", () => {
    actions.onSetWidget1Axis?.(select.value);
    actions.requestRender?.();
  });
}

/* ===== Chart（upsert） ===== */
function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;
  if (!Chart || !canvas) return;

  const labels = items.map(x => x.label);
  const dataBooths = items.map(x => totalBooths ? x.booths / totalBooths : 0);
  const dataSales  = items.map(x => totalSales  ? x.sales  / totalSales  : 0);

  if (mount.__w1_chart) {
    const ch = mount.__w1_chart;
    ch.data.labels = labels;
    ch.data.datasets[0].data = dataBooths;
    ch.data.datasets[0].backgroundColor = items.map(x => x.colorSoft);
    ch.data.datasets[1].data = dataSales;
    ch.data.datasets[1].backgroundColor = items.map(x => x.color);
    ch.update("none");
    return;
  }

  mount.__w1_chart = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          label: "ステーション構成比",
          data: dataBooths,
          backgroundColor: items.map(x => x.colorSoft),
          radius: "55%",
        },
        {
          label: "売上構成比",
          data: dataSales,
          backgroundColor: items.map(x => x.color),
          radius: "95%",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "40%",
      interaction: { mode: "nearest", intersect: true },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex;
              const it = items[i];
              if (!it) return "";
              const share = ctx.datasetIndex === 0 ? dataBooths[i] : dataSales[i];
              return `${it.label}：${(share * 100).toFixed(1)}%`;
            },
          },
        },
      },
    },
  });
}

/* ===== render ===== */
export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;

  const mode = opts.mode || "normal";
  ensureDom_(mount, actions, mode);

  const axisKey = getAxisFromState_(state);

  if (mount.__w1_axis !== axisKey) {
    mount.__w1_axis = axisKey;
    if (mount.__w1_select) mount.__w1_select.value = axisKey;

    if (mount.__w1_chart) {
      mount.__w1_chart.destroy();
      mount.__w1_chart = null;
    }
  }

  const meta = axisMeta(axisKey);
  if (mount.__w1_title) {
    mount.__w1_title.textContent = `${meta.titleLabel}別 売上 / ステーション構成比`;
  }

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];
  const { items, totalSales, totalBooths } = buildAgg_(rows, axisKey);

  upsertChart_(mount, items, totalSales, totalBooths);
}
