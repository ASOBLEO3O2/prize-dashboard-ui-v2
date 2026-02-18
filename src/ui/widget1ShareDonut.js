// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: Share Donut（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: ステーション(=boothId) 構成比（distinct boothId）
 *
 * B案：
 * - state.normRows（固定キー）だけを見る
 * - 列名揺れ吸収は normalizeRow が責務
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

// =========================
// Drilldown（拡大時のみ）
// - 景品ジャンル/投入法/キャラ は byAxis に階層がある
// =========================
function drillAxisKey_(axisKey) {
  if (axisKey === "景品ジャンル") return "ジャンル";
  if (axisKey === "投入法") return "投入法";
  if (axisKey === "キャラ") return "キャラ";
  return null;
}

function pickChildrenFromState_(state, axisKey, parentKey) {
  if (!parentKey) return null;
  const hKey = drillAxisKey_(axisKey);
  if (!hKey) return null;

  const parents = state?.byAxis?.[hKey];
  if (!Array.isArray(parents) || parents.length === 0) return null;

  const p =
    parents.find((x) => x?.key === parentKey || x?.label === parentKey) || null;

  const children = p?.children;
  if (!Array.isArray(children) || children.length === 0) return null;

  const items = children.map((c) => {
    const booths = Number(c?.machines ?? 0) || 0;
    const sales = Number(c?.sales ?? 0) || 0;
    const consume = Number(c?.consume ?? c?.claw ?? 0);
    const costRate = (typeof c?.costRate === "number") ? c.costRate : null;

    const k = String(c?.label ?? c?.key ?? "").trim();

    return {
      key: k,
      label: k,
      sales,
      booths,
      consume: Number.isFinite(consume) ? consume : null,
      avgSales: booths > 0 ? (sales / booths) : null,
      costRate,
      color: colorSolid_(k),
      colorSoft: colorSoft_(k),
      _hasChildren: false,
    };
  });

  items.sort((a, b) => b.sales - a.sales);

  const totalSales = items.reduce((a, x) => a + x.sales, 0);
  const totalBooths = items.reduce((a, x) => a + x.booths, 0);

  return { parentLabel: p?.label ?? parentKey, items, totalSales, totalBooths };
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
   固定キー：軸ごとの label を取り出す
   ========================================================= */
function axisLabelFromNorm_(r, axisKey) {
  if (!r) return "未分類";
  switch (axisKey) {
    case "料金": return safeStr(r.feeLabel, "その他");
    case "回数": return safeStr(r.playsLabel, "その他");
    case "投入法": return safeStr(r.methodLabel, "その他");
    case "景品ジャンル": return safeStr(r.prizeGenreLabel, "その他");
    case "ターゲット": return safeStr(r.targetLabel, "その他");
    case "年代": return safeStr(r.ageLabel, "その他");
    case "キャラ": return safeStr(r.charaLabel, "その他");
    case "映画": return (r.isMovie === true) ? "〇" : (r.isMovie === false ? "×" : "未分類");
    case "予約": return (r.isReserve === true) ? "〇" : (r.isReserve === false ? "×" : "未分類");
    case "WLオリジナル": return (r.isWlOriginal === true) ? "〇" : (r.isWlOriginal === false ? "×" : "未分類");
    default: return "未分類";
  }
}

/* =========================================================
   集計（normRows専用）
   ========================================================= */
function buildAgg_(rows, axisKey) {
  const map = new Map();

  for (const r of rows) {
    const k = axisLabelFromNorm_(r, axisKey);

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

    // 1ステーション = boothId
    if (r?.boothId) o.booths.add(String(r.boothId));

    // 消化額は claw（正規化済み）
    if (Number.isFinite(r?.claw)) {
      o.consumeSum += toNum(r.claw);
      o.consumeSeen = true;
    }

    // 原価率は costRate01（正規化済み）
    if (typeof r?.costRate01 === "number" && Number.isFinite(r.costRate01)) {
      o.costRateSum += r.costRate01;
      o.costRateCount += 1;
    }
  }

  let items = Array.from(map.values()).map((x) => {
    const booths = x.booths.size;
    const consume = x.consumeSeen ? x.consumeSum : null;
    const avgSales = booths > 0 ? x.sales / booths : null;

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
      _hasChildren: false,
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

  const header = el("div", { class: "widget1Header" });
  const title = el("div", { class: "widget1Title", text: "景品ジャンル別 売上 / ステーション構成比" });
  const left = el("div", { class: "widget1HeaderLeft" }, [title]);

  const btnExpand = el("button", {
    class: "btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  const btnBack = el("button", {
    class: "btn ghost",
    text: "上層に戻る",
    onClick: () => actions.onSetFocusParentKey?.(null),
  });

  const selectWrap = el("div", { class: "widget1SelectWrap" });
  const select = el("select", { class: "widget1Select" });
  AXES.forEach((a) => select.appendChild(el("option", { value: a.key, text: a.label })));
  selectWrap.appendChild(select);

  const right = el("div", { class: "widget1HeaderRight" }, []);
  if (mode === "normal") right.appendChild(btnExpand);
  else right.appendChild(btnBack);
  right.appendChild(selectWrap);

  header.appendChild(left);
  header.appendChild(right);

  const body = el("div", { class: "widget1Body" });

  const chartWrap = el("div", { class: "widget1ChartWrap" });
  const canvas = el("canvas", { class: "widget1Canvas" });

  const center = el("div", { class: "w1Center" }, [
    el("div", { class: "w1CenterLabel", text: "合計売上" }),
    el("div", { class: "w1CenterValue", text: "—" }),
  ]);

  const tip = el("div", { class: "w1Tip" });

  chartWrap.appendChild(canvas);
  chartWrap.appendChild(center);
  chartWrap.appendChild(tip);

  const legendWrap = el("div", { class: "widget1ABC" });

  body.appendChild(chartWrap);
  body.appendChild(legendWrap);

  root.appendChild(header);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_back = btnBack;
  mount.__w1_canvas = canvas;
  mount.__w1_legend = legendWrap;

  mount.__w1_center = center;
  mount.__w1_centerValue = center.querySelector(".w1CenterValue");
  mount.__w1_tip = tip;

  select.addEventListener("change", () => {
    const axisKey = select.value;
    actions.onSetWidget1Axis?.(axisKey);
    actions.onSetFocusParentKey?.(null);
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
function updateBackBtn_(mount, show) {
  const b = mount.__w1_back;
  if (!b) return;
  b.style.display = show ? "" : "none";
}
function updateCenter_(mount, totalSales) {
  const v = mount.__w1_centerValue;
  if (!v) return;
  const n = Number(totalSales);
  v.textContent = Number.isFinite(n) && n > 0 ? yen(n) : "—";
}

/* =========================================================
   tooltip（中身）
   ========================================================= */
function tooltipLabelPhase3_(ctx) {
  const meta = ctx?.chart?.$w1;
  if (!meta) return "";

  const i = ctx.dataIndex;
  const it = meta.items?.[i];
  if (!it) return "";

  const boothsShare = meta.dataBooths?.[i] ?? 0;
  const salesShare = meta.dataSales?.[i] ?? 0;

  if (ctx.datasetIndex === 0) {
    return [`台数: ${it.booths}`, `マシン構成比: ${pct(boothsShare)}`];
  }
  return [`売上: ${yen(it.sales)}`, `売上構成比: ${pct(salesShare)}`];
}

/* =========================
   Chart（作成/更新）
   ========================= */
function upsertChart_(mount, items, totalSales, totalBooths, opt = {}) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;
  if (!Chart || !canvas) return;

  const labels = items.map((x) => x.label);
  const dataBooths = items.map((x) => (totalBooths ? x.booths / totalBooths : 0));
  const dataSales = items.map((x) => (totalSales ? x.sales / totalSales : 0));

  const colorsInner = items.map((x) => x.colorSoft || "#93c5fd");
  const colorsOuter = items.map((x) => x.color || "#2563eb");

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

      ch.$w1 = { items, totalSales, totalBooths, dataSales, dataBooths, opt };

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

        onClick: (evt, els, chart) => {
          try {
            const meta = chart?.$w1;
            const canDrill = !!meta?.opt?.canDrill;
            if (!canDrill) return;

            const el0 = (els && els[0]) ? els[0] : null;
            const idx = el0?.index;
            if (idx == null) return;

            const it = meta?.items?.[idx];
            if (!it || !it._hasChildren) return;

            meta.opt.onDrill?.(it.key);
          } catch (_) {}
        },

        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: (context) => {
              const { chart, tooltip } = context;
              const tipEl = mount.__w1_tip;
              if (!tipEl) return;

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

              const meta = chart.$w1;
              const idx = dp.dataIndex;
              const item = meta?.items?.[idx];
              const title = item?.label ?? dp.label ?? "";

              const pseudoCtx = { chart, dataIndex: dp.dataIndex, datasetIndex: dp.datasetIndex };
              const lines = tooltipLabelPhase3_(pseudoCtx);
              const arr = Array.isArray(lines) ? lines.filter(Boolean) : [String(lines || "")].filter(Boolean);

              tipEl.innerHTML =
                `<div class="w1TipTitle">${escapeHtml_(title)}</div>` +
                arr.map((s) => `<div class="w1TipLine">${escapeHtml_(s)}</div>`).join("");

              tipEl.classList.add("show");
            },
          },
        },
      },
    });

    ch.$w1 = { items, totalSales, totalBooths, dataSales, dataBooths, opt };
    mount.__w1_chart = ch;
  } catch (e) {
    console.error("[W1] Chart create failed:", e);
  }
}

/* =========================================================
   Legend（カード）
   ========================================================= */
function renderLegend_(mount, items, totalSales, totalBooths, opt = {}) {
  const box = mount.__w1_legend;
  if (!box) return;

  clear(box);

  items.forEach((it) => {
    const salesShare = totalSales ? it.sales / totalSales : null;
    const boothShare = totalBooths ? it.booths / totalBooths : null;

    box.appendChild(
      el(
        "div",
        {
          class: "w1LegendItem",
          onClick: opt.canDrill && it._hasChildren ? () => opt.onDrill?.(it.key) : null,
          style: opt.canDrill && it._hasChildren ? "cursor:pointer;" : null,
        },
        [
          el("div", { class: "w1LegendHead" }, [
            el("span", { class: "w1LegendSwatch", style: `background:${it.color};` }),
            el("span", { class: "w1LegendLabel", text: it.label }),
          ]),
          el("div", { class: "w1LegendSales", text: fmtMaybeYen_(it.sales, "—") }),
          el("div", { class: "w1LegendShares" }, [
            el("span", { class: "w1LegendShare", text: `売上構成比：${fmtMaybePct_(salesShare, "—")}` }),
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
        ]
      )
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

  // ✅ B案：ここは normRows に統一
  const rows = Array.isArray(state?.normRows) ? state.normRows : [];

  const axisKey = getAxisFromState_(state);
  updateSelect_(mount, axisKey);
  updateTitle_(mount, axisKey);

  const focus = state?.focus || {};
  const parentKey =
    mode === "expanded" && focus?.kind === "shareDonut"
      ? focus.parentKey || null
      : null;

  const childView = parentKey ? pickChildrenFromState_(state, axisKey, parentKey) : null;

  let items, totalSales, totalBooths;
  if (childView) {
    ({ items, totalSales, totalBooths } = childView);
  } else {
    ({ items, totalSales, totalBooths } = buildAgg_(rows, axisKey));
  }

  updateBackBtn_(mount, !!childView);

  if (!childView) {
    const hKey = drillAxisKey_(axisKey);
    const parents = hKey ? state?.byAxis?.[hKey] : null;

    if (Array.isArray(parents) && parents.length) {
      const hasChildrenSet = new Set(
        parents
          .filter((p) => Array.isArray(p?.children) && p.children.length > 0)
          .map((p) => p?.key ?? p?.label)
          .filter(Boolean)
      );
      items = items.map((it) => ({
        ...it,
        _hasChildren: hasChildrenSet.has(it.key) || hasChildrenSet.has(it.label),
      }));
    } else {
      items = items.map((it) => ({ ...it, _hasChildren: false }));
    }
  }

  updateCenter_(mount, totalSales);

  const canDrill = mode === "expanded" && !childView;
  const onDrill = (key) => {
    if (!canDrill) return;
    if (!key) return;
    actions.onSetFocusParentKey?.(key);
    actions.requestRender?.();
  };

  upsertChart_(mount, items, totalSales, totalBooths, { canDrill, onDrill });
  renderLegend_(mount, items, totalSales, totalBooths, { canDrill, onDrill });
}

export function renderWidget1ShareDonutFocus(mount, state, actions) {
  renderWidget1ShareDonut(mount, state, actions, { mode: "expanded" });
}
