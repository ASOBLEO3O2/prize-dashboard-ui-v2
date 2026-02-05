// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: 売上 / ステーション(=booth_id) 構成比（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: ステーション構成比（distinct booth_id）
 *
 * ✅ A/B/C ランクは削除（右側は「凡例リスト」として維持）
 * ✅ tooltip は「そのチャートの最新集計」を必ず参照する（ステーション0化を潰す）
 *
 * === Phase 1 (Legend only / Non-breaking) ===
 * ✅ 右側凡例を「1カテゴリ=判断ブロック」へ拡張
 *    - ■(グラフ同色), カテゴリ名
 *    - 売上（大）
 *    - 売上構成比 / マシン(ステーション)構成比
 *    - 平均売上 / 消化額合計 / 原価率
 * ✅ グラフ本体/軸切替/色/tooltipは触らない
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

function pct(v) {
  if (!Number.isFinite(v)) return "0.0%";
  return (v * 100).toFixed(1) + "%";
}

function axisMeta(axisKey) {
  return AXES.find(a => a.key === axisKey) || AXES[3];
}

function getAxisFromState_(state) {
  const raw = safeStr(state?.widget1Axis, "景品ジャンル");
  if (raw === "ジャンル") return "景品ジャンル";
  return raw;
}

/** 色：カテゴリkeyから安定生成（Chart.js が確実に解釈できる hsl） */
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

/** ===== Phase1: Legend用の数値ピック（存在する列だけ使う / 無ければnull） ===== */
function pickNum_(r, keys) {
  for (const k of keys) {
    const v = r?.[k];
    if (v == null || v === "") continue;
    const n = Number(String(v).replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// 消化額っぽい候補（必要ならここは後であなたの実データに合わせて絞る）
function pickConsume_(r) {
  return pickNum_(r, [
    "consume", "consume_yen", "consume_amount", "consumption", "spent",
    "消化額", "消化額合計", "総消化額", "消化",
    "cost", "cost_yen",
  ]);
}

// 行に原価率があれば拾う（0-1 / 0-100 どちらも許容）
function pickCostRate_(r) {
  const v = pickNum_(r, ["costRate", "cost_rate", "原価率"]);
  if (v == null) return null;
  return v > 1.5 ? (v / 100) : v;
}

function fmtMaybeYen_(n, fallback = "—") {
  if (n == null || !Number.isFinite(n)) return fallback;
  return yen(n);
}
function fmtMaybePct_(v, fallback = "—") {
  if (v == null || !Number.isFinite(v)) return fallback;
  return pct(v);
}

/**
 * 集計：
 * - sales（必須）
 * - booths（distinct booth_id）
 * - consume（取れた時だけ）
 * - avgSales（sales/booths）
 * - costRate（優先：行の原価率平均 / 次点：consume*1.1/sales）
 */
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

    // 消化額（あれば）
    const c = pickConsume_(r);
    if (c != null) {
      o.consumeSum += c;
      o.consumeSeen = true;
    }

    // 原価率（あれば）
    const cr = pickCostRate_(r);
    if (cr != null) {
      o.costRateSum += cr;
      o.costRateCount += 1;
    }
  }

  const items = Array.from(map.values()).map(x => {
    const booths = x.booths.size;

    const consume = x.consumeSeen ? x.consumeSum : null;
    const avgSales = (booths > 0) ? (x.sales / booths) : null;

    let costRate = null;
    if (x.costRateCount > 0) {
      costRate = x.costRateSum / x.costRateCount; // 行の原価率平均（安全）
    } else if (consume != null && x.sales > 0) {
      costRate = (consume * 1.1) / x.sales; // 次点：消化額から推定（あなたの定義に寄せる）
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

/**
 * ✅ 重要：tooltip の参照先を「そのチャート自身」に固定する
 * - ch.$w1 = { items, totalSales, totalBooths, dataSales, dataBooths }
 * - callback は ctx.chart.$w1 を見る（closureでitemsを掴まない）
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

  // 既存が別canvasなら破棄
  if (mount.__w1_chart && mount.__w1_chart.canvas !== canvas) {
    try { mount.__w1_chart.destroy(); } catch (_) {}
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

      // ✅ 最新の参照をチャートに載せる（これが “ステーション0化” の対策）
      ch.$w1 = { items, totalSales, totalBooths, dataSales, dataBooths };

      ch.update("none");
      return;
    } catch (e) {
      try { ch.destroy(); } catch (_) {}
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
            enabled: true,
            callbacks: {
              title: (itemsArr) => {
                const it0 = itemsArr?.[0];
                const idx = it0?.dataIndex;
                const meta = it0?.chart?.$w1;
                const item = meta?.items?.[idx];
                return item?.label ?? "";
              },
              label: (ctx) => {
                const meta = ctx?.chart?.$w1;
                if (!meta) return "";
                const i = ctx.dataIndex;
                const it = meta.items?.[i];
                if (!it) return "";

                const boothsShare = meta.dataBooths?.[i] ?? 0;
                const salesShare  = meta.dataSales?.[i] ?? 0;

                // datasetIndex 0=内（ステーション）, 1=外（売上）
                if (ctx.datasetIndex === 0) {
                  return [
                    `ステーション: ${it.booths}（${pct(boothsShare)}）`,
                    `売上: ${yen(it.sales)}（${pct(salesShare)}）`,
                  ];
                } else {
                  return [
                    `売上: ${yen(it.sales)}（${pct(salesShare)}）`,
                    `ステーション: ${it.booths}（${pct(boothsShare)}）`,
                  ];
                }
              },
            },
          },
        },
      },
    });

    // ✅ 最新参照を載せる（create直後）
    ch.$w1 = { items, totalSales, totalBooths, dataSales, dataBooths };

    mount.__w1_chart = ch;
  } catch (e) {
    console.error("[W1] Chart create failed:", e);
  }
}

/**
 * Phase1: 右側凡例を「判断ブロック」形式で描画
 * - ■(同色) + カテゴリ名
 * - 売上（大）
 * - 売上構成比 / マシン(ステーション)構成比
 * - 平均売上 / 消化額合計 / 原価率
 */
function renderLegend_(mount, items, totalSales, totalBooths) {
  const box = mount.__w1_legend;
  if (!box) return;

  clear(box);

  items.forEach((it) => {
    const salesShare = totalSales ? (it.sales / totalSales) : null;
    const boothShare = totalBooths ? (it.booths / totalBooths) : null;

    box.appendChild(
      el("div", { class: "w1LegendItem" }, [
        // head: ■ + name
        el("div", { class: "w1LegendHead" }, [
          el("span", { class: "w1LegendSwatch", style: `background:${it.color};` }),
          el("span", { class: "w1LegendLabel", text: it.label }),
        ]),

        // sales big
        el("div", { class: "w1LegendSales", text: fmtMaybeYen_(it.sales, "—") }),

        // shares
        el("div", { class: "w1LegendShares" }, [
          el("span", { class: "w1LegendShare", text: `売上構成比：${fmtMaybePct_(salesShare, "—")}` }),
          el("span", { class: "w1LegendShareSep", text: "｜" }),
          el("span", { class: "w1LegendShare", text: `マシン構成比：${fmtMaybePct_(boothShare, "—")}` }),
        ]),

        // meta rows
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

  // 末尾ノート（既存維持）
  box.appendChild(
    el("div", {
      class: "widget1Note",
      text:
        `台数は 1ステーション（ブースID）単位で集計` +
        (Number.isFinite(totalBooths) ? `（合計 ${totalBooths}）` : ""),
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
  renderLegend_(mount, items, totalSales, totalBooths);
}
