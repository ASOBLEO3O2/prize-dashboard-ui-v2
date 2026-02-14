/* eslint-disable */
// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";
import { fmtYen } from "../utils/format.js";

/**
 * Widget1（売上構成比 / shareDonut）
 * - 中段2×2枠（.midPanelBody）内に完結して描画
 * - 軸切替は actions.onSetWidget1Axis に委譲
 */

const AXES = [
  { key: "genre", label: "ジャンル", titleLabel: "ジャンル" },
  { key: "machine", label: "マシン", titleLabel: "マシン" },
  { key: "method", label: "投入法", titleLabel: "投入法" },
  { key: "target", label: "ターゲット", titleLabel: "ターゲット" },
  { key: "age", label: "年代", titleLabel: "年代" },
];

function axisMeta(axisKey) {
  const k = String(axisKey || "").trim();
  return AXES.find((a) => a.key === k) || AXES[0];
}

const yen = (n) =>
  fmtYen ? fmtYen(n) : (Number(n) || 0).toLocaleString();

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function renderWidget1ShareDonut(mount, state, actions) {
  if (!mount) return;

  if (!mount.__w1_root) {
    buildRoot_(mount, actions);
  }

  const axisKey = String(state?.widget1Axis || "genre").trim() || "genre";
  updateTitle_(mount, axisKey);
  updateSelect_(mount, axisKey);

  const byAxis = state?.byAxis || {};
  const pack = byAxis?.[axisKey] || null;
  const items = Array.isArray(pack?.items) ? pack.items : [];

  const labels = items.map((x) =>
    String(x?.label ?? x?.name ?? "—")
  );
  const sales = items.map((x) =>
    safeNum(x?.sales ?? x?.value ?? 0)
  );

  const totalSales = sales.reduce((a, b) => a + safeNum(b), 0);
  updateCenter_(mount, totalSales);

  upsertChart_(mount, labels, sales);
  renderLegend_(mount, labels, sales);
}

/* =========================
   Root build
========================= */

function buildRoot_(mount, actions) {
  const root = el("div", { class: "widget1" });

  const header = el("div", { class: "widget1Header" });
  const title = el("div", { class: "widget1Title", text: "—" });

  const select = el("select", { class: "widget1Select" });
  AXES.forEach((a) =>
    select.appendChild(
      el("option", { value: a.key, text: a.label })
    )
  );

  if (select && !select.__bound) {
    select.addEventListener("change", () => {
      const axisKey = select.value;
      actions?.onSetWidget1Axis?.(axisKey);
      actions?.requestRender?.();
    });
    select.__bound = true;
  }

  header.appendChild(title);
  header.appendChild(select);

  const body = el("div", { class: "widget1Body" });

  const chartWrap = el("div", {
    class: "widget1ChartWrap",
  });
  const canvas = el("canvas", {
    class: "widget1Canvas",
  });

  const center = el("div", { class: "w1Center" }, [
    el("div", {
      class: "w1CenterLabel",
      text: "合計売上",
    }),
    el("div", {
      class: "w1CenterValue",
      text: "—",
    }),
  ]);

  chartWrap.appendChild(canvas);
  chartWrap.appendChild(center);

  const legend = el("div", { class: "widget1ABC" });

  body.appendChild(chartWrap);
  body.appendChild(legend);

  root.appendChild(header);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_canvas = canvas;
  mount.__w1_centerValue =
    center.querySelector(".w1CenterValue");
  mount.__w1_legend = legend;
}

/* ========================= */

function updateTitle_(mount, axisKey) {
  const meta = axisMeta(axisKey);
  const title = mount.__w1_title;
  if (!title) return;
  title.textContent =
    `${meta.titleLabel}別 売上構成比`;
}

function updateSelect_(mount, axisKey) {
  const sel = mount.__w1_select;
  if (!sel) return;
  if (sel.value !== axisKey)
    sel.value = axisKey;
}

function updateCenter_(mount, total) {
  const elv = mount.__w1_centerValue;
  if (!elv) return;
  elv.textContent =
    Number(total) > 0 ? yen(total) : "—";
}

/* =========================
   Chart (with resize fix)
========================= */

function upsertChart_(mount, labels, values) {
  const canvas = mount.__w1_canvas;
  if (!canvas) return;

  const ChartCtor =
    window.Chart ||
    (typeof Chart !== "undefined" ? Chart : null);
  if (!ChartCtor) return;

  const ctx = canvas.getContext("2d");

  if (mount.__w1_chart) {
    const ch = mount.__w1_chart;
    ch.data.labels = labels;
    ch.data.datasets[0].data = values;

    ch.update("none");

    // 🔵 初回レイアウト確定後に強制resize
    requestAnimationFrame(() => {
      try {
        ch.resize();
        ch.update("none");
      } catch (_) {}
    });

    return;
  }

  const chart = new ChartCtor(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      cutout: "62%",
    },
  });

  mount.__w1_chart = chart;

  // 🔵 生成直後も強制resize
  requestAnimationFrame(() => {
    try {
      chart.resize();
      chart.update("none");
    } catch (_) {}
  });
}

/* =========================
   Legend
========================= */

function renderLegend_(mount, labels, values) {
  const legend = mount.__w1_legend;
  if (!legend) return;

  clear(legend);

  const sum = values.reduce(
    (a, b) => a + safeNum(b),
    0
  );

  labels.forEach((label, i) => {
    const v = safeNum(values[i]);
    const pct = sum ? (v / sum) * 100 : 0;

    const item = el("div", {
      class: "w1LegendItem",
    });

    const labelEl = el("div", {
      class: "w1LegendLabel",
      text: label,
    });

    const salesEl = el("div", {
      class: "w1LegendSales",
      text: yen(v),
    });

    const shareEl = el("div", {
      class: "w1LegendShare",
      text: `${pct.toFixed(1)}%`,
    });

    item.appendChild(labelEl);
    item.appendChild(salesEl);
    item.appendChild(shareEl);

    legend.appendChild(item);
  });
}
