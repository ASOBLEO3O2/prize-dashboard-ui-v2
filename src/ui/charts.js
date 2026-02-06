// src/ui/charts.js
// 役割：
// - 中段の canvas（costHistChart / salesCostScatter）に Chart.js を描画する
// - 初回描画で「親の高さが未確定(=0)」だと Chart.js が 0px 確定して崩れるので、
//   ①canvasの実寸が十分になるまで init しない
//   ②init 後も resize を1回かけて確定させる
//   ③render は何度呼ばれても安全（無限ループしない）
// - mounts を信用しすぎず DOM から拾う

let costHistChart = null;
let salesCostScatter = null;

// init再試行を無限にしないためのガード
let _initTryCount = 0;
const INIT_TRY_MAX = 60; // 60フレーム(≒1秒)程度で打ち切り

const COST_BINS = [
  { label: "〜3%",   min: 0.00, max: 0.03 },
  { label: "3–5%",  min: 0.03, max: 0.05 },
  { label: "5–8%",  min: 0.05, max: 0.08 },
  { label: "8–10%", min: 0.08, max: 0.10 },
  { label: "10%〜", min: 0.10, max: Infinity },
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

function findCanvasAndMode() {
  const costCanvas = document.getElementById("costHistChart");
  const scatterCanvas = document.getElementById("salesCostScatter");
  const modeSelect = document.getElementById("costHistMode");
  return { costCanvas, scatterCanvas, modeSelect };
}

// 「canvasが存在」ではなく、「描画できる実寸が確定」しているかを見る
function isCanvasReady(canvas) {
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  // 初回崩れの典型：height 0 / 1 / 極小
  return rect.width >= 160 && rect.height >= 160;
}

function computeCostHistogram(rows, mode) {
  const arr = COST_BINS.map(() => 0);

  for (const r of rows) {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    const sales = toNum(r?.sales ?? r?.総売上) ?? 0;
    if (rate == null) continue;

    const idx = COST_BINS.findIndex((b) => rate >= b.min && rate < b.max);
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

function tryInitCharts() {
  const Chart = window.Chart;
  if (!Chart) return false;

  const { costCanvas, scatterCanvas } = findCanvasAndMode();

  // サイズ未確定なら init しない
  if (!isCanvasReady(costCanvas) || !isCanvasReady(scatterCanvas)) return false;

  const c1 = costCanvas.getContext("2d");
  const c2 = scatterCanvas.getContext("2d");
  if (!c1 || !c2) return false;

  if (!costHistChart) {
    costHistChart = new Chart(c1, {
      type: "bar",
      data: {
        labels: COST_BINS.map((b) => b.label),
        datasets: [{ label: "台数", data: [0, 0, 0, 0, 0] }],
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
  }

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

    salesCostScatter = new Chart(c2, {
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
            suggestedMax: 0.2,
            ticks: { callback: (v) => `${Math.round(v * 100)}%` },
          },
        },
      },
    });
  }

  // init直後に「確定リサイズ」を1回入れる（ここが効く）
  // ※Chart.js は非表示/0サイズで init すると以後ズレが残ることがあるため
  try { costHistChart?.resize(); } catch (_) {}
  try { salesCostScatter?.resize(); } catch (_) {}

  return true;
}

function bindModeOnce(renderFn) {
  const { modeSelect } = findCanvasAndMode();
  if (!modeSelect || modeSelect.__bound) return;

  modeSelect.addEventListener("change", () => renderFn());
  modeSelect.__bound = true;
}

function updateCharts(state) {
  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];
  const { modeSelect } = findCanvasAndMode();
  const mode = modeSelect?.value || "count";

  const hist = computeCostHistogram(rows, mode);
  costHistChart.data.datasets[0].data = hist;
  costHistChart.data.datasets[0].label = mode === "sales" ? "売上" : "台数";
  costHistChart.update();

  const pts = computeScatter(rows);
  salesCostScatter.data.datasets[0].data = pts;
  salesCostScatter.update();
}

export function renderCharts(mounts, state) {
  // mounts は使わない（DOMから拾う方式に統一）

  // 既に init 済みなら更新だけ
  if (costHistChart && salesCostScatter) {
    bindModeOnce(() => updateCharts(state));
    updateCharts(state);
    return;
  }

  // 未init：サイズ確定を待って init → 更新
  const ok = tryInitCharts();
  if (ok) {
    bindModeOnce(() => updateCharts(state));
    updateCharts(state);
    return;
  }

  // まだダメ：無限に回さない（最大回数まで）
  if (_initTryCount < INIT_TRY_MAX) {
    _initTryCount++;
    requestAnimationFrame(() => renderCharts(mounts, state));
  } else {
    // ここに来る＝CSS/DOM 側で canvas の高さが確定していない可能性が高い
    // 以後は静かに諦める（ログだけ）
    // eslint-disable-next-line no-console
    console.warn("[charts] init skipped: canvas size not ready", {
      cost: document.getElementById("costHistChart")?.getBoundingClientRect?.(),
      scatter: document.getElementById("salesCostScatter")?.getBoundingClientRect?.(),
    });
  }
}
