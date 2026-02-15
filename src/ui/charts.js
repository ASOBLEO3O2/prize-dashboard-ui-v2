// src/ui/charts.js

let costHistChart = null;
let salesCostScatter = null;

let __roCost = null;
let __roScatter = null;

// ✅ ウィジェット②と同じ “自然区切り”
const COST_BINS = [
  { label: "0–10%",  min: 0.0,  max: 0.10, incMin: true,  incMax: true },
  { label: "11–25%", min: 0.10, max: 0.25, incMin: false, incMax: true },
  { label: "26–32%", min: 0.25, max: 0.32, incMin: false, incMax: true },
  { label: "33–40%", min: 0.32, max: 0.40, incMin: false, incMax: false },
  { label: "40%〜",   min: 0.40, max: Infinity, incMin: true,  incMax: true },
];

function toNum(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim().replace(/,/g, "");
    if (!s) return null;
    if (s.endsWith("%")) {
      const n = Number(s.slice(0, -1));
      return Number.isFinite(n) ? n / 100 : null;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function inBin_(rate01, b) {
  if (!b) return false;
  const r = Number(rate01);
  if (!Number.isFinite(r) || r < 0) return false;

  const geMin = b.incMin ? r >= b.min : r > b.min;
  const ltMax = (b.max === Infinity) ? true : (b.incMax ? r <= b.max : r < b.max);
  return geMin && ltMax;
}

function findCanvasAndMode() {
  const costCanvas = document.getElementById("costHistChart");
  const scatterCanvas = document.getElementById("salesCostScatter");
  const modeSelect = document.getElementById("costHistMode");
  return { costCanvas, scatterCanvas, modeSelect };
}

function attachResizeObserver_(canvas, chart, kind) {
  const host = canvas?.parentElement;
  if (!host || !window.ResizeObserver) return;

  const ro = new ResizeObserver(() => {
    try {
      chart?.resize?.();
      chart?.update?.("none");
    } catch (e) {}
  });

  ro.observe(host);

  if (kind === "cost") {
    if (__roCost) try { __roCost.disconnect(); } catch (e) {}
    __roCost = ro;
  } else {
    if (__roScatter) try { __roScatter.disconnect(); } catch (e) {}
    __roScatter = ro;
  }
}

function ensureCostHist(costCanvas) {
  const Chart = window.Chart;
  if (!Chart || !costCanvas) return false;

  const ctx = costCanvas.getContext?.("2d");
  if (!ctx) return false;

  if (!costHistChart) {
    costHistChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: COST_BINS.map((b) => b.label),
        datasets: [{ label: "台数", data: COST_BINS.map(() => 0) }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true },
        },
      },
    });

    // ✅ 初回0pxでも作る → サイズ確定後に追従
    attachResizeObserver_(costCanvas, costHistChart, "cost");

    // 念のため次フレームでも1回だけ追い打ち
    requestAnimationFrame(() => {
      try {
        costHistChart?.resize?.();
        costHistChart?.update?.();
      } catch (e) {}
    });
  }

  return true;
}

function ensureScatter(scatterCanvas) {
  const Chart = window.Chart;
  if (!Chart || !scatterCanvas) return false;

  const ctx = scatterCanvas.getContext?.("2d");
  if (!ctx) return false;

  if (!salesCostScatter) {
    const quadLines = {
      id: "quadLines",
      afterDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;

        const x = scales.x.getPixelForValue(10000);
        const y = scales.y.getPixelForValue(0.05);

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();

        ctx.restore();
      },
    };

    salesCostScatter = new Chart(ctx, {
      type: "scatter",
      data: { datasets: [{ label: "マシン", data: [] }] },
      plugins: [quadLines],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const p = c.raw;
                const yen = new Intl.NumberFormat("ja-JP").format(Math.round(p.x));
                const pct = (p.y * 100).toFixed(1);
                const name = p._name ? ` ${p._name}` : "";
                return `${yen}円 / ${pct}%${name}`;
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: "売上（円）" }, beginAtZero: true },
          y: {
            title: { display: true, text: "原価率" },
            beginAtZero: true,
            suggestedMax: 0.8,
            ticks: { callback: (v) => `${Math.round(v * 100)}%` },
          },
        },
      },
    });

    attachResizeObserver_(scatterCanvas, salesCostScatter, "scatter");

    requestAnimationFrame(() => {
      try {
        salesCostScatter?.resize?.();
        salesCostScatter?.update?.();
      } catch (e) {}
    });
  }

  return true;
}

function computeCostHistogram(rows, mode) {
  const arr = COST_BINS.map(() => 0);

  for (const r of rows) {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    const sales = toNum(r?.sales ?? r?.総売上) ?? 0;
    if (rate == null) continue;

    const idx = COST_BINS.findIndex((b) => inBin_(rate, b));
    if (idx < 0) continue;

    arr[idx] += mode === "sales" ? sales : 1;
  }
  return arr;
}

function computeScatter(rows) {
  const pts = [];
  for (const r of rows) {
    const x = toNum(r?.sales ?? r?.総売上);
    const y = toNum(r?.cost_rate ?? r?.原価率);
    if (x == null || y == null) continue;

    pts.push({
      x,
      y,
      _name: r?.machine_ref ?? r?.対応マシン名 ?? r?.booth_id ?? "",
    });
  }
  return pts;
}

export function renderCharts(mounts, state) {
  const { costCanvas, scatterCanvas, modeSelect } = findCanvasAndMode();

  ensureCostHist(costCanvas);
  ensureScatter(scatterCanvas);

  const rows = Array.isArray(state.filteredRows) ? state.filteredRows : [];
  const mode = modeSelect?.value || "count";

  if (costHistChart) {
    const hist = computeCostHistogram(rows, mode);
    costHistChart.data.labels = COST_BINS.map((b) => b.label);
    costHistChart.data.datasets[0].data = hist;
    costHistChart.data.datasets[0].label = mode === "sales" ? "売上" : "台数";
    costHistChart.update();
  }

  if (salesCostScatter) {
    const pts = computeScatter(rows);
    salesCostScatter.data.datasets[0].data = pts;
    salesCostScatter.update();
  }

  if (modeSelect && !modeSelect.__bound) {
    modeSelect.addEventListener("change", () => renderCharts(mounts, state));
    modeSelect.__bound = true;
  }
}
