// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: Share Donut（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: ステーション(=booth_id) 構成比（distinct booth_id）
 *
 * 進行プラン（非破壊・段階確定）
 * Phase1: 右側凡例のみを「判断ユニット」に（最優先）
 * Phase2: ドーナツ中央の空白を「合計売上」だけで埋める（状態追加なし）
 * Phase3: tooltip の“中身だけ”整理（挙動は一切変えない）
 *
 * 追加（見た目）
 * - 左右1:1（CSS側）
 * - tooltip は「ドーナツ描画領域内の下部固定」（external tooltip）
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

/* =========================
   utils（数値/文字列/表示）
   ========================= */
function toNum(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function toNumOrNull(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/,/g, "");
  if (!s) return null;
  if (s.endsWith("%")) {
    const n = Number(s.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function yen(n) {
  return new Intl.NumberFormat("ja-JP").format(Math.round(n || 0)) + "円";
}
function pct(v) {
  if (!Number.isFinite(v)) return "0.0%";
  return (v * 100).toFixed(1) + "%";
}
function safeStr(v, fallback = "未分類") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}
function fmtMaybeYen_(n, fallback = "—") {
  if (n == null || !Number.isFinite(n)) return fallback;
  return yen(n);
}
function fmtMaybePct_(v, fallback = "—") {
  if (v == null || !Number.isFinite(v)) return fallback;
  return pct(v);
}
function escapeHtml_(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function axisMeta(axisKey) {
  return AXES.find((a) => a.key === axisKey) || AXES[3];
}
function getAxisFromState_(state) {
  const raw = safeStr(state?.widget1Axis, "景品ジャンル");
  if (raw === "ジャンル") return "景品ジャンル";
  return raw;
}

/* =========================
   色（カテゴリkeyから安定生成）
   ========================= */
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

/* =========================================================
   Phase1（凡例の判断ユニット化）に必要な pick / 集計
   ========================================================= */
function pickNum_(r, keys) {
  for (const k of keys) {
    const v = r?.[k];
    const n = toNumOrNull(v);
    if (n != null) return n;
  }
  return null;
}

// 消化額（consume が正規化で生えている前提。claw も許容）
function pickConsume_(r) {
  return pickNum_(r, [
    "consume",
    "claw",
    "消化額",
    "消化額合計",
    "総消化額",
    "消化",
    "consume_yen",
    "consume_amount",
    "consumption",
    "spent",
    "cost",
    "cost_yen",
  ]);
}

// 原価率（charts.js 互換: cost_rate / 原価率、detail互換: costRate も）
function pickCostRate_(r) {
  const v = pickNum_(r, ["cost_rate", "costRate", "原価率", "cost_rate_pct", "cost_rate_percent"]);
  if (v == null) return null;
  return v > 1.5 ? v / 100 : v; // 0-100%が来ても0-1へ
}

function buildAgg_(rows, axisKey) {
  const map = new Map();

  for (const r of rows) {
    const k = safeStr(r?.[axisKey], "未分類");

    let o = map.get(k);
    if (!o) {
      o = {
        key: k,
        label: k,
        sales: 0,
        booths: new Set(),

        consumeSum: 0,
        consumeSeen: false,

        costRateSum: 0,
        costRateCount: 0,
      };
      map.set(k, o);
    }

    o.sales += toNum(r?.sales);

    // 1ステーション = booth_id
    if (r?.booth_id != null && String(r.booth_id).trim() !== "") {
      o.booths.add(String(r.booth_id));
    }

    const cons = pickConsume_(r);
    if (cons != null) {
      o.consumeSum += cons;
      o.consumeSeen = true;
    }

    const cr = pickCostRate_(r);
    if (cr != null) {
      o.costRateSum += cr;
      o.costRateCount += 1;
    }
  }

  const items = Array.from(map.values()).map((x) => {
    const booths = x.booths.size;
    const consume = x.consumeSeen ? x.consumeSum : null;
    const avgSales = booths > 0 ? x.sales / booths : null;

    // 原価率：優先：行平均 / 次点：消化額×1.1 / 売上
    let costRate = null;
    if (x.costRateCount > 0) {
      costRate = x.costRateSum / x.costRateCount;
    } else if (consume != null && x.sales > 0) {
      costRate = (consume * 1.1) / x.sales;
    }

    return {
      key: x.key,
      label: x.label,
      sales: x.sales,
      booths,
      consume,
      avgSales,
      costRate,
      color: colorSolid_(x.key),
      colorSoft: colorSoft_(x.key),
    };
  });

  items.sort((a, b) => b.sales - a.sales);

  const totalSales = items.reduce((a, x) => a + x.sales, 0);
  const totalBooths = items.reduce((a, x) => a + x.booths, 0);

  return { items, totalSales, totalBooths };
}

/* =========================
   DOM（器の確保）
   ========================= */
function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return mount.__w1_root;

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
  AXES.forEach((a) => select.appendChild(el("option", { value: a.key, text: a.label })));
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

  // =========================================================
  // Phase2（中央の空白を埋める）：DOMを重ねるだけ（状態追加なし）
  // =========================================================
  const center = el("div", { class: "w1Center" }, [
    el("div", { class: "w1CenterLabel", text: "合計売上" }),
    el("div", { class: "w1CenterValue", text: "—" }),
  ]);

  // ✅ tooltip box（ドーナツ領域内・下部固定）
  const tip = el("div", { class: "w1Tip" });

  chartWrap.appendChild(canvas);
  chartWrap.appendChild(center);
  chartWrap.appendChild(tip);

  const legendWrap = el("div", { class: "widget1ABC" }); // 既存CSS名を維持（中身は凡例として使う）

  body.appendChild(chartWrap);
  body.appendChild(legendWrap);

  root.appendChild(header);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_canvas = canvas;
  mount.__w1_legend = legendWrap;

  // Phase2 refs
  mount.__w1_center = center;
  mount.__w1_centerValue = center.querySelector(".w1CenterValue");

  // tooltip ref
  mount.__w1_tip = tip;

  // change handler（1回だけ）
  select.addEventListener("change", () => {
    const axisKey = select.value;
    actions.onSetWidget1Axis?.(axisKey);
    actions.requestRender?.();
  });

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

/* =========================================================
   Phase2（中央表示）：合計売上のみ（状態追加なし）
   ========================================================= */
function updateCenter_(mount, totalSales) {
  const v = mount.__w1_centerValue;
  if (!v) return;

  const n = Number(totalSales);
  v.textContent = Number.isFinite(n) && n > 0 ? yen(n) : "—";
}

/* =========================================================
   Phase3（ツールチップ中身だけ整理）：挙動は一切変えない
   ========================================================= */
function tooltipLabelPhase3_(ctx) {
  const meta = ctx?.chart?.$w1;
  if (!meta) return "";

  const i = ctx.dataIndex;
  const it = meta.items?.[i];
  if (!it) return "";

  const boothsShare = meta.dataBooths?.[i] ?? 0;
  const salesShare = meta.dataSales?.[i] ?? 0;

  // datasetIndex 0=内（台数/マシン構成比）, 1=外（売上/売上構成比）
  if (ctx.datasetIndex === 0) {
    return [`台数: ${it.booths}`, `マシン構成比: ${pct(boothsShare)}`];
  }
  return [`売上: ${yen(it.sales)}`, `売上構成比: ${pct(salesShare)}`];
}

/* =========================
   Chart（作成/更新）
   ========================= */
function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;
  if (!Chart || !canvas) return;

  const labels = items.map((x) => x.label);
  const dataBooths = items.map((x) => (totalBooths ? x.booths / totalBooths : 0));
  const dataSales = items.map((x) => (totalSales ? x.sales / totalSales : 0));

  const colorsInner = items.map((x) => x.colorSoft || "#93c5fd");
  const colorsOuter = items.map((x) => x.color || "#2563eb");

  // 既存が別canvasなら破棄
  if (mount.__w1_chart && mount.__w1_chart.canvas !== canvas) {
    try {
      mount.__w1_chart.destroy();
    } catch (_) {}
    mount.__w1_chart = null;
  }

  // update
  if (mount.__w1_chart) {
    const ch = mount.__w1_chart;
    try {
      ch.data.labels = labels;

      ch.data.datasets[0].data = dataBooths;
      ch.data.datasets[0].backgroundColor = colorsInner;

      ch.data.datasets[1].data = dataSales;
      ch.data.datasets[1].backgroundColor = colorsOuter;

      // ✅ 最新参照（“ステーション0化”対策）
      ch.$w1 = { items, totalSales, totalBooths, dataSales, dataBooths };

      // tooltip（external）更新：Chart.js が afterEvent で external を呼ぶが、
      // update("none") でも十分。念のため消しておく。
      const tipEl = mount.__w1_tip;
      if (tipEl && !tipEl.matches(":hover")) {
        // 何もしない（hover判定は不要。外部tooltipは tooltip.opacity で制御）
      }

      ch.update("none");
      return;
    } catch (e) {
      try {
        ch.destroy();
      } catch (_) {}
      mount.__w1_chart = null;
    }
  }

  // create
  try {
    const ch = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            label: "ステーション構成比",
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
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false, // ✅ 標準tooltip無効（はみ出し禁止を確実に）
            external: (context) => {
              const { chart, tooltip } = context;
              const tipEl = mount.__w1_tip;
              if (!tipEl) return;

              // 非表示
              if (!tooltip || tooltip.opacity === 0) {
                tipEl.classList.remove("show");
                tipEl.innerHTML = "";
                return;
              }

              const dp = tooltip.dataPoints?.[0];
              if (!dp) {
                tipEl.classList.remove("show");
                tipEl.innerHTML = "";
                return;
              }

              // タイトル（カテゴリ名）
              const meta = chart.$w1;
              const idx = dp.dataIndex;
              const item = meta?.items?.[idx];
              const title = item?.label ?? dp.label ?? "";

              // Phase3中身（外=売上、内=台数）
              const pseudoCtx = { chart, dataIndex: dp.dataIndex, datasetIndex: dp.datasetIndex };
              const lines = tooltipLabelPhase3_(pseudoCtx);
              const arr = Array.isArray(lines)
                ? lines.filter(Boolean)
                : [String(lines || "")].filter(Boolean);

              tipEl.innerHTML =
                `<div class="w1TipTitle">${escapeHtml_(title)}</div>` +
                arr.map((s) => `<div class="w1TipLine">${escapeHtml_(s)}</div>`).join("");

              tipEl.classList.add("show");
            },
          },
        },
      },
    });

    ch.$w1 = { items, totalSales, totalBooths, dataSales, dataBooths };
    mount.__w1_chart = ch;
  } catch (e) {
    console.error("[W1] Chart create failed:", e);
  }
}

/* =========================================================
   Phase1（凡例：判断ユニット）描画
   ========================================================= */
function renderLegend_(mount, items, totalSales, totalBooths) {
  const box = mount.__w1_legend;
  if (!box) return;

  clear(box);

  items.forEach((it) => {
    const salesShare = totalSales ? it.sales / totalSales : null;
    const boothShare = totalBooths ? it.booths / totalBooths : null;

    box.appendChild(
      el("div", { class: "w1LegendItem" }, [
        el("div", { class: "w1LegendHead" }, [
          el("span", { class: "w1LegendSwatch", style: `background:${it.color};` }),
          el("span", { class: "w1LegendLabel", text: it.label }),
        ]),
        el("div", { class: "w1LegendSales", text: fmtMaybeYen_(it.sales, "—") }),
        el("div", { class: "w1LegendShares" }, [
          el("span", { class: "w1LegendShare", text: `売上構成比：${fmtMaybePct_(salesShare, "—")}` }),
          el("span", { class: "w1LegendShareSep", text: "｜" }),
          el("span", { class: "w1LegendShare", text: `マシン構成比：${fmtMaybePct_(boothShare, "—")}` }),
        ]),
        el("div", { class: "w1LegendMeta" }, [
          el("div", { class: "w1LegendMetaRow" }, [
            el("span", { class: "k", text: "平均売上：" }),
            el("span", { class: "v", text: fmtMaybeYen_(it.avgSales, "—") }),
          ]),
          el("div", { class: "w1LegendMetaRow" }, [
            el("span", { class: "k", text: "消化額合計：" }),
            el("span", { class: "v", text: fmtMaybeYen_(it.consume, "—") }),
          ]),
          el("div", { class: "w1LegendMetaRow" }, [
            el("span", { class: "k", text: "原価率：" }),
            el("span", { class: "v", text: fmtMaybePct_(it.costRate, "—") }),
          ]),
        ]),
      ])
    );
  });

  box.appendChild(
    el("div", {
      class: "widget1Note",
      text: `台数は 1ステーション（ブースID）単位で集計` + (Number.isFinite(totalBooths) ? `（合計 ${totalBooths}）` : ""),
    })
  );
}

/* =========================
   entry
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

  // Phase2: 中央（合計売上のみ）
  updateCenter_(mount, totalSales);

  // chart / legend
  upsertChart_(mount, items, totalSales, totalBooths);
  renderLegend_(mount, items, totalSales, totalBooths);
}
