// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: 売上 / ステーション(=booth_id) 構成比（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: ステーション構成比（distinct booth_id）
 *
 * 集計母集団：state.filteredRows（＝フィルタ後）
 * ステーション数：distinct booth_id
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
  if (raw === "ジャンル") return "景品ジャンル";
  return raw;
}

/** 色：カテゴリkeyから安定生成 */
function hashHue_(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}
function colorSolid_(key) {
  const hue = hashHue_(String(key));
  return `hsl(${hue}, 80%, 55%)`;
}
function colorSoft_(key) {
  const hue = hashHue_(String(key));
  return `hsl(${hue}, 75%, 70%)`;
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

    // 1ステーション = booth_id
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
    const prev = totalSales ? (cum / totalSales) : 0; // ✅ 加算前
    const rank = (prev < 0.7) ? "A" : (prev < 0.9) ? "B" : "C";
    cum += x.sales;
    return { rank, label: x.label, sales: x.sales, color: x.color };
  });
}


function ensureDom_(mount, actions, mode) {
  // mode が変わったら作り直し（normal→expanded などで事故らないように）
  if (mount.__w1_root) {
    const curMode = mount.__w1_mode || "normal";
    if (curMode === mode) return mount.__w1_root;

    // 既存 Chart を破棄してから作り直す
    if (mount.__w1_chart) {
      try { mount.__w1_chart.destroy(); } catch (e) {}
      mount.__w1_chart = null;
    }
    mount.__w1_root = null;
  }

  mount.__w1_mode = mode;

  const root = el("div", { class: `widget1 widget1-${mode}` });

  // header
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

  // body
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

  // change handler（1回だけ）
  if (!select.__bound) {
    select.addEventListener("change", () => {
      const axisKey = select.value;
      actions.onSetWidget1Axis?.(axisKey);
      actions.requestRender?.();
    });
    select.__bound = true;
  }

  return root;
}

function updateTitle_(mount, axisKey) {
  const meta = axisMeta(axisKey);
  const title = mount.__w1_title;
  if (!title) return;
  title.textContent = `${meta.titleLabel}別 売上 / ステーション構成比`;
}

function updateSelect_(mount, axisKey) {
  const sel = mount.__w1_select;
  if (!sel) return;
  if (sel.value !== axisKey) sel.value = axisKey;
}

function pct(v) {
  if (!Number.isFinite(v)) return "0.0%";
  return (v * 100).toFixed(1) + "%";
}

/**
 * ✅ 修正版：
 * - tooltip が items[i] 前提で落ちない（ガード）
 * - update でも tooltip callback を差し替える（stale参照を作らない）
 */
function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;
  if (!Chart || !canvas) return;

  const labels = items.map(x => x.label);

  const dataBooths = items.map(x => (totalBooths ? x.booths / totalBooths : 0));
  const dataSales  = items.map(x => (totalSales ? x.sales / totalSales : 0));

  const colorsInner = items.map(x => x.colorSoft || "#93c5fd");
  const colorsOuter = items.map(x => x.color || "#2563eb");

  // ✅ 落ちない tooltip（items が取れない場合もフォールバック）
  const tooltipLabel = (ctx) => {
    const i = ctx?.dataIndex ?? -1;
    const it = (i >= 0 && i < items.length) ? items[i] : null;

    const isInner = (ctx?.datasetIndex === 0);
    const shareArr = isInner ? dataBooths : dataSales;
    const share = (i >= 0 && i < shareArr.length) ? shareArr[i] : 0;

    const label = it?.label ?? String(ctx?.label ?? "—");
    const booths = it?.booths ?? 0;

    return `${label} / 台数 ${booths}台（ブース） / 構成比 ${pct(share)}`;
  };

  // 既存が別canvasなら破棄
  if (mount.__w1_chart && mount.__w1_chart.canvas !== canvas) {
    try { mount.__w1_chart.destroy(); } catch (e) {}
    mount.__w1_chart = null;
  }

  // update（落ちたら recreate）
  if (mount.__w1_chart) {
    const ch = mount.__w1_chart;
    try {
      ch.data.labels = labels;

      ch.data.datasets[0].data = dataBooths;
      ch.data.datasets[0].backgroundColor = colorsInner;

      ch.data.datasets[1].data = dataSales;
      ch.data.datasets[1].backgroundColor = colorsOuter;

      // ✅ ここが必須：tooltip callback を “最新items” に差し替える
      ch.options.plugins = ch.options.plugins || {};
      ch.options.plugins.tooltip = ch.options.plugins.tooltip || {};
      ch.options.plugins.tooltip.enabled = true;
      ch.options.plugins.tooltip.callbacks = ch.options.plugins.tooltip.callbacks || {};
      ch.options.plugins.tooltip.callbacks.label = tooltipLabel;

      // 当たり判定は少し緩める（任意だが体感が良くなる）
      ch.options.interaction = { mode: "nearest", intersect: false };

      ch.update("none");
      return;
    } catch (e) {
      try { ch.destroy(); } catch (_) {}
      mount.__w1_chart = null;
    }
  }

  // create
  try {
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
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: { label: tooltipLabel },
          },
        },
      },
    });
  } catch (e) {
    console.error("[W1] Chart create failed:", e);
  }
}

function renderABC_(mount, abcRows, totalBooths) {
  const box = mount.__w1_abc;
  if (!box) return;

  clear(box);

  abcRows.forEach(r => {
    box.appendChild(
      el("div", { class: `widget1ABCRow rank-${r.rank}` }, [
        el("span", { class: "rank", text: r.rank }),
        el("span", { class: "label" }, [
          el("span", { class: "w1chip", style: `background:${r.color};` }),
          el("span", { text: r.label }),
        ]),
        el("span", { class: "value", text: yen(r.sales) }),
      ])
    );
  });

  box.appendChild(
    el("div", {
      class: "widget1Note",
      text: `台数は 1ステーション（ブースID）単位で集計` + (Number.isFinite(totalBooths) ? `（合計 ${totalBooths}）` : "")
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
