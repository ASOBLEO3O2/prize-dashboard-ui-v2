// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: 売上 / ブースID(=booth_id) 構成比（2重ドーナツ）
 * - 内周: 台数（= distinct booth_id の比率）
 * - 外周: 売上（sales の比率）
 *
 * 重要：
 * - 集計母集団は state.filteredRows（= フィルタ後）
 * - render中に state/store を絶対に更新しない（Maximum call stack の原因）
 * - state更新は select change の「ユーザー操作」からのみ行う
 */

/** 軸キー（rowsの実列名に合わせる） */
const AXES = [
  { key: "料金", label: "① 料金", titleLabel: "料金" },
  { key: "回数", label: "② プレイ回数", titleLabel: "プレイ回数" }, // 実列は「回数」
  { key: "投入法", label: "③ 投入法", titleLabel: "投入法" },
  { key: "景品ジャンル", label: "④ 景品ジャンル", titleLabel: "景品ジャンル" },
  { key: "ターゲット", label: "⑤ ターゲット", titleLabel: "ターゲット" },
  { key: "年代", label: "⑥ 年代", titleLabel: "年代" },
  { key: "キャラ", label: "⑦ キャラ", titleLabel: "キャラ" },
  { key: "映画", label: "⑧ 映画", titleLabel: "映画" },
  { key: "予約", label: "⑨ 予約", titleLabel: "予約" },
  { key: "WLオリジナル", label: "⑩ WLオリジナル", titleLabel: "WLオリジナル" },
];

function axisMeta(axisKey) {
  return AXES.find(a => a.key === axisKey) || AXES[3]; // default: 景品ジャンル
}

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

function pct01(v) {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= 0) return "0.0%";
  return (x * 100).toFixed(1) + "%";
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

/**
 * app.js 由来の揺れ吸収：
 * - 初期値が "ジャンル" の場合 → 実列 "景品ジャンル" に寄せる
 */
function getAxisFromState_(state) {
  const raw = safeStr(state?.widget1Axis, "景品ジャンル");
  if (raw === "ジャンル") return "景品ジャンル";
  return raw;
}

/** 軸別に sales 合計と distinct booth_id を集計 */
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

    // ブース数（台数）の根拠は booth_id（あなたの定義）
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

/** ABC（見た目用） */
function buildABC_(items, totalSales) {
  let cum = 0;
  return items.map(x => {
    cum += x.sales;
    const r = totalSales ? (cum / totalSales) : 0;
    const rank = (r <= 0.7) ? "A" : (r <= 0.9) ? "B" : "C";
    return { rank, label: x.label, sales: x.sales, color: x.color };
  });
}

/** DOM生成（初回のみ） */
function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return mount.__w1_root;

  // --- wrapper（既存CSSの w1- と widget1- の両方に合わせる） ---
  const root = el("div", { class: `w1 card widget1 widget1-${mode}` });

  // header
  const head = el("div", { class: "w1-head widget1Header" });
  const title = el("div", { class: "w1-title widget1Title", text: "景品ジャンル別 売上 / ブース構成比" });
  const headRight = el("div", { class: "w1-headRight widget1HeaderRight" });

  const btnExpand = el("button", {
    class: "w1-btn btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  const select = el("select", { class: "w1-axis widget1Select" });
  AXES.forEach(a => select.appendChild(el("option", { value: a.key, text: a.label })));

  if (mode === "normal") headRight.appendChild(btnExpand);
  headRight.appendChild(select);

  head.appendChild(title);
  head.appendChild(headRight);

  // body
  const body = el("div", { class: "w1-body widget1Body" });

  const left = el("div", { class: "w1-left widget1ChartWrap" });
  const canvas = el("canvas", { class: "w1-canvas widget1Canvas" });
  left.appendChild(canvas);

  const right = el("div", { class: "w1-right widget1ABC" }); // 右側リスト

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
  mount.__w1_right = right;

  /**
   * ✅ 重要：state更新は「ユーザー操作（change）」からのみ
   * render中に set を呼ぶと Maximum call stack の原因になる
   */
  select.addEventListener("change", () => {
    const axisKey = select.value;
    actions.onSetWidget1Axis?.(axisKey);
    // store.subscribe で render が回るなら不要だが、保険で残す
    actions.requestRender?.();
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

/** Chart.js（2重ドーナツ） */
function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;
  if (!Chart || !canvas) return;

  const labels = items.map(x => x.label);

  // 0..1 の比率
  const shareBooths = items.map(x => (totalBooths ? x.booths / totalBooths : 0));
  const shareSales  = items.map(x => (totalSales ? x.sales / totalSales : 0));

  const colorsInner = items.map(x => x.colorSoft || "#93c5fd");
  const colorsOuter = items.map(x => x.color || "#2563eb");

  const tooltipLabel = (ctx) => {
    const i = ctx.dataIndex;
    const it = items[i];
    const isInner = (ctx.datasetIndex === 0); // 0=台数, 1=売上
    const share = isInner ? shareBooths[i] : shareSales[i];

    // ✅ 要望：台数〇台（ブース数）/ 構成比〇%
    return `${it.label} / 台数 ${it.booths}台（ブース） / 構成比 ${pct01(share)}`;
  };

  if (!mount.__w1_chart) {
    mount.__w1_chart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            label: "台数（ブース）構成比",
            data: shareBooths,
            backgroundColor: colorsInner,
            borderColor: "rgba(10,15,20,.65)",
            borderWidth: 1,
            radius: "55%",
          },
          {
            label: "売上構成比",
            data: shareSales,
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
        resizeDelay: 120,
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

  ch.data.datasets[0].data = shareBooths;
  ch.data.datasets[0].backgroundColor = colorsInner;

  ch.data.datasets[1].data = shareSales;
  ch.data.datasets[1].backgroundColor = colorsOuter;

  // tooltip維持
  ch.options.plugins = ch.options.plugins || {};
  ch.options.plugins.tooltip = ch.options.plugins.tooltip || {};
  ch.options.plugins.tooltip.enabled = true;
  ch.options.plugins.tooltip.callbacks = { label: tooltipLabel };

  /**
   * ✅ 重要：ここで store.set / requestRender を呼ばない
   * ✅ "none" 指定が環境によってイベント連鎖→再帰の引き金になることがあるので避ける
   */
  ch.update();
}

/** 右側リスト描画 */
function renderRightList_(mount, items, totalSales, totalBooths) {
  const box = mount.__w1_right;
  if (!box) return;

  clear(box);

  // リスト（itemsは売上降順）
  const list = el("div", { class: "w1-list" });

  for (const it of items) {
    const share = totalBooths ? (it.booths / totalBooths) : 0;

    list.appendChild(
      el("div", { class: "w1-row" }, [
        el("span", { class: "w1-chip widget1Chip", style: `background:${it.color};` }),
        el("div", { class: "w1-name" }, [
          el("span", { text: it.label }),
        ]),
        el("div", { class: "w1-v", text: `${yen(it.sales)}（${it.booths}台 / ${pct01(share)}）` }),
      ])
    );
  }

  box.appendChild(list);

  // 注記
  const note = el("div", {
    class: "w1-note widget1Note",
    text: `台数は ブースID（=booth_id）単位で集計（合計 ${Number.isFinite(totalBooths) ? totalBooths : 0}）`,
  });
  box.appendChild(note);
}

export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;
  const mode = opts.mode || "normal";

  ensureDom_(mount, actions, mode);

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  // 軸
  const axisKey = getAxisFromState_(state);
  updateSelect_(mount, axisKey);
  updateTitle_(mount, axisKey);

  // 集計
  const { items, totalSales, totalBooths } = buildAgg_(rows, axisKey);

  // ドーナツ
  upsertChart_(mount, items, totalSales, totalBooths);

  // 右側
  renderRightList_(mount, items, totalSales, totalBooths);
}
