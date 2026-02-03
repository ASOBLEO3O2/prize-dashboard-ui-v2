// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: 売上 / ステーション(=booth_id) 構成比（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: 台数構成比（distinct booth_id）
 *
 * 集計母集団：
 * - state.filteredRows（= フィルタ後）
 *
 * 重要：
 * - booth_id は「ブースIDがそのキー」というあなたの前提に従う
 * - 台数 = distinct booth_id（ただし「カテゴリ内の台数」はカテゴリ内 distinct）
 */

const AXES = [
  { key: "料金", label: "① 料金", titleLabel: "料金" },
  { key: "回数", label: "② プレイ回数", titleLabel: "プレイ回数" }, // 実列名は「回数」
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
  const x = Number(v);
  if (!Number.isFinite(x)) return "0.0%";
  return (x * 100).toFixed(1) + "%";
}

function axisMeta(axisKey) {
  return AXES.find(a => a.key === axisKey) || AXES[3]; // default: 景品ジャンル
}

function getAxisFromState_(state) {
  // app.js 初期値 "ジャンル" を吸収
  const raw = safeStr(state?.widget1Axis, "景品ジャンル");
  if (raw === "ジャンル") return "景品ジャンル";
  return raw;
}

/** 色：カテゴリkeyから安定生成（同じkeyは常に同色） */
function hashHue_(str) {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
function colorSolid_(key) {
  const hue = hashHue_(key);
  return `hsl(${hue} 80% 55%)`;
}
function colorSoft_(key) {
  const hue = hashHue_(key);
  return `hsl(${hue} 70% 70%)`;
}

/**
 * 集計：
 * - sales は行の sales 合計
 * - booths は「そのカテゴリ内」の distinct booth_id 数
 */
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

    // booth_id が無ければ upstream の問題。ここでは空はカウントしない。
    const bid = String(r?.booth_id ?? "").trim();
    if (bid) o.booths.add(bid);
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

  const totalSales = items.reduce((a, x) => a + (Number(x.sales) || 0), 0);
  const totalBooths = items.reduce((a, x) => a + (Number(x.booths) || 0), 0);

  return { items, totalSales, totalBooths };
}

function buildABC_(items, totalSales) {
  let cum = 0;
  return items.map(x => {
    cum += x.sales;
    const r = totalSales ? (cum / totalSales) : 0;
    const rank = (r <= 0.7) ? "A" : (r <= 0.9) ? "B" : "C";
    return { rank, label: x.label, sales: x.sales, color: x.color, booths: x.booths };
  });
}

/* =========================
   DOM（初回のみ生成）
   ========================= */

function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return mount.__w1_root;

  const root = el("div", { class: `w1 card ${mode === "expanded" ? "expanded" : ""}` });

  // head
  const head = el("div", { class: "w1-head" });
  const title = el("div", { class: "w1-title", text: "景品ジャンル別 売上 / ステーション構成比" });

  const headRight = el("div", { class: "w1-headRight" });

  const btnExpand = el("button", {
    class: "w1-btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  const select = el("select", { class: "w1-axis" });
  AXES.forEach(a => select.appendChild(el("option", { value: a.key, text: a.label })));

  if (mode === "normal") headRight.appendChild(btnExpand);
  headRight.appendChild(select);

  head.appendChild(title);
  head.appendChild(headRight);

  // body
  const body = el("div", { class: `w1-body ${mode === "expanded" ? "expanded" : ""}` });

  // left: canvas
  const left = el("div", { class: "w1-left" });
  const canvasWrap = el("div", { class: "w1-donutWrap", style: "width:100%; height:100%; max-width:360px; aspect-ratio:1/1;" });
  const canvas = el("canvas", { class: "w1-canvas", style: "width:100%; height:100%;" });
  canvasWrap.appendChild(canvas);
  left.appendChild(canvasWrap);

  // right: list
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
    actions.onSetWidget1Axis?.(axisKey);
    // store.set で render が回るなら不要だが保険
    actions.requestRender?.();
  });

  return root;
}

function updateTitle_(mount, axisKey) {
  const meta = axisMeta(axisKey);
  const t = mount.__w1_title;
  if (!t) return;
  t.textContent = `${meta.titleLabel}別 売上 / ステーション構成比`;
}

function updateSelect_(mount, axisKey) {
  const sel = mount.__w1_select;
  if (!sel) return;
  if (sel.value !== axisKey) sel.value = axisKey;
}

/* =========================
   Chart（落ちない tooltip / 更新）
   ========================= */

function destroyChart_(mount) {
  if (mount.__w1_chart) {
    try { mount.__w1_chart.destroy(); } catch (_) {}
    mount.__w1_chart = null;
  }
}

function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;

  if (!Chart || !canvas) return;

  // items が無いならチャートも潰す（古いのが残って誤表示になるのを防ぐ）
  if (!items || items.length === 0) {
    destroyChart_(mount);
    return;
  }

  const labels = items.map(x => x.label);
  const dataBooths = items.map(x => (totalBooths ? x.booths / totalBooths : 0));
  const dataSales  = items.map(x => (totalSales  ? x.sales  / totalSales  : 0));

  const colorsInner = items.map(x => x.colorSoft);
  const colorsOuter = items.map(x => x.color);

  // ✅ 落ちない tooltip（items[i] が無いケースをガード）
  const tooltipLabel = (ctx) => {
    const i = ctx?.dataIndex ?? -1;
    const dsi = ctx?.datasetIndex ?? 0;

    const it = (i >= 0 && i < items.length) ? items[i] : null;
    if (!it) return "";

    const share = (dsi === 0) ? (dataBooths[i] ?? 0) : (dataSales[i] ?? 0);

    // 要望：台数〇台（ブース数） / 構成比〇%
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

        // hover/tooltip を安定化
        interaction: { mode: "nearest", intersect: true },

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

  // ✅ update のたびに tooltip を再セット（他で options 上書きされても戻す）
  ch.options.plugins = ch.options.plugins || {};
  ch.options.plugins.tooltip = { enabled: true, callbacks: { label: tooltipLabel } };
  ch.options.interaction = { mode: "nearest", intersect: true };

  ch.update("none");
}

/* =========================
   右側リスト（あなたの画面に合わせた表示）
   - 行：売上 / 台数 / 構成比（台数ベース）
   ========================= */

function renderList_(mount, items, totalBooths) {
  const list = mount.__w1_list;
  if (!list) return;

  clear(list);

  if (!items || items.length === 0) {
    list.appendChild(el("div", { class: "w1-empty", text: "データなし" }));
    return;
  }

  for (const it of items) {
    const share = totalBooths ? (it.booths / totalBooths) : 0;

    list.appendChild(
      el("button", { class: "w1-row", type: "button" }, [
        el("span", { class: "w1-chip", style: `--c:${it.color};` }),
        el("span", { class: "w1-name", text: it.label }),
        el("span", { class: "w1-v", text: yen(it.sales) }),
        el("div", { class: "w1-v2", text: `(${it.booths}台 / ${pct(share)})` }),
      ])
    );
  }
}

function renderNote_(mount, totalBooths) {
  const note = mount.__w1_note;
  if (!note) return;
  note.textContent = `台数は 1ステーション（ブースID）単位で集計` + (Number.isFinite(totalBooths) ? `（合計 ${totalBooths}）` : "");
}

/* =========================
   public
   ========================= */

export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;

  const mode = opts.mode || "normal";
  ensureDom_(mount, actions, mode);

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  const axisKey = getAxisFromState_(state);
  updateSelect_(mount, axisKey);
  updateTitle_(mount, axisKey);

  const { items, totalSales, totalBooths } = buildAgg_(rows, axisKey);

  // ✅ ドーナツ復旧
  upsertChart_(mount, items, totalSales, totalBooths);

  // 右側リスト
  renderList_(mount, items, totalBooths);
  renderNote_(mount, totalBooths);
}
