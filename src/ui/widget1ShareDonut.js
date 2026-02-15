// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget①: Share Donut（2重ドーナツ）
 * - 外周: 売上構成比
 * - 内周: ステーション(=booth_id) 構成比（distinct booth_id）
 *
 * 追加（拡大時の遷移型）：
 * - 拡大時、カード/グラフクリックで「下層データがあるものだけ」内訳へ遷移
 * - state.focus.parentKey を利用（focusOverlay 側の既存設計に乗せる）
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

  // children -> widget1 item 形式に揃える（表示用）
  const items = children.map((c) => {
    const booths = Number(c?.machines ?? 0) || 0;
    const sales = Number(c?.sales ?? 0) || 0;
    const consume = Number(c?.consume ?? 0);
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
   pick / 集計
   ========================================================= */
function pickNum_(r, keys) {
  for (const k of keys) {
    const v = r?.[k];
    const n = toNumOrNull(v);
    if (n != null) return n;
  }
  return null;
}

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

function pickCostRate_(r) {
  const v = pickNum_(r, [
    "cost_rate",
    "costRate",
    "原価率",
    "cost_rate_pct",
    "cost_rate_percent",
  ]);
  if (v == null) return null;
  return v > 1.5 ? v / 100 : v;
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

  // header
  const header = el("div", { class: "widget1Header" });
  const title = el("div", {
    class: "widget1Title",
    text: "景品ジャンル別 売上 / ステーション構成比",
  });
  const left = el("div", { class: "widget1HeaderLeft" }, [title]);

  const btnExpand = el("button", {
    class: "btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  // 拡大時：上層に戻る（ドリルダウン用）
  const btnBack = el("button", {
    class: "btn ghost",
    text: "上層に戻る",
    onClick: () => actions.onSetFocusParentKey?.(null),
  });

  const selectWrap = el("div", { class: "widget1SelectWrap" });
  const select = el("select", { class: "widget1Select" });
  AXES.forEach((a) =>
    select.appendChild(el("option", { value: a.key, text: a.label }))
  );
  selectWrap.appendChild(select);

  const right = el("div", { class: "widget1HeaderRight" }, []);
  if (mode === "normal") {
    right.appendChild(btnExpand);
  } else {
    right.appendChild(btnBack);
  }
  right.appendChild(selectWrap);

  header.appendChild(left);
  header.appendChild(right);

  // body
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

  // change handler（1回だけ）
  select.addEventListener("change", () => {
    const axisKey = select.value;
    actions.onSetWidget1Axis?.(axisKey);
    actions.onSetFocusParentKey?.(null); // 軸変更時は上層に戻す
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

      ch.$w1 = { items, totalSales, totalBooths, dataSales, dataBooths, opt };

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

        // ✅ 拡大時：セグメントクリックでドリルダウン（子がある時だけ）
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

              const pseudoCtx = {
                chart,
                dataIndex: dp.dataIndex,
                datasetIndex: dp.datasetIndex,
              };
              const lines = tooltipLabelPhase3_(pseudoCtx);
              const arr = Array.isArray(lines)
                ? lines.filter(Boolean)
                : [String(lines || "")].filter(Boolean);

              tipEl.innerHTML =
                `<div class="w1TipTitle">${escapeHtml_(title)}</div>` +
                arr
                  .map((s) => `<div class="w1TipLine">${escapeHtml_(s)}</div>`)
                  .join("");

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
          onClick:
            opt.canDrill && it._hasChildren ? () => opt.onDrill?.(it.key) : null,
          style: opt.canDrill && it._hasChildren ? "cursor:pointer;" : null,
        },
        [
          el("div", { class: "w1LegendHead" }, [
            el("span", {
              class: "w1LegendSwatch",
              style: `background:${it.color};`,
            }),
            el("span", { class: "w1LegendLabel", text: it.label }),
          ]),
          el("div", { class: "w1LegendSales", text: fmtMaybeYen_(it.sales, "—") }),
          el("div", { class: "w1LegendShares" }, [
            el("span", {
              class: "w1LegendShare",
              text: `売上構成比：${fmtMaybePct_(salesShare, "—")}`,
            }),
            el("span", {
              class: "w1LegendShare",
              text: `マシン構成比：${fmtMaybePct_(boothShare, "—")}`,
            }),
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
      text:
        `台数は 1ステーション（ブースID）単位で集計` +
        (Number.isFinite(totalBooths) ? `（合計 ${totalBooths}）` : ""),
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

  // --- drilldown state（拡大時のみ） ---
  const focus = state?.focus || {};
  const parentKey =
    mode === "expanded" && focus?.kind === "shareDonut"
      ? focus.parentKey || null
      : null;

  // 子階層が取れるなら子を表示（取れない場合は上層のまま）
  const childView = parentKey ? pickChildrenFromState_(state, axisKey, parentKey) : null;

  let items, totalSales, totalBooths;
  if (childView) {
    ({ items, totalSales, totalBooths } = childView);
  } else {
    ({ items, totalSales, totalBooths } = buildAgg_(rows, axisKey));
  }

  // 上層に戻るボタン：子表示中だけ出す
  updateBackBtn_(mount, !!childView);

  // 上層（親）でのみ「子あり」をマーク（カード/グラフクリックで遷移）
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

  // 中央（合計売上のみ）
  updateCenter_(mount, totalSales);

  // chart / legend
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

// ✅ focusOverlay から呼ぶための統一I/F（中身は既存関数に委譲）
export function renderWidget1ShareDonutFocus(mount, state, actions) {
  // widget1 は自前でヘッダー/ナビも持ってるならそれでOK
  // ここは「拡大モードで描け」という指示だけ出す
  renderWidget1ShareDonut(mount, state, actions, { mode: "expanded" });
}
