// src/ui/widget3Scatter.js
import { el, clear } from "../utils/dom.js";
import { GENRES } from "../constants.js";

/* =========================================================
 * Utilities
 * ========================================================= */

function toNum(v) {
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

function normRate01(v) {
  const n = toNum(v);
  if (n == null) return null;
  return n > 1.5 ? n / 100 : n;
}

function fmtYen(v) {
  return new Intl.NumberFormat("ja-JP").format(Math.round(Number(v) || 0));
}

function fmtPct01(v) {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function pickGenre(r) {
  return (
    r?.genre ??
    r?.["ジャンル"] ??
    r?.景品ジャンル ??
    r?.["景品ジャンル"] ??
    "未分類"
  );
}

function pickBoothId(r) {
  return (
    r?.booth_id ??
    r?.["ブースID"] ??
    r?.boothId ??
    "—"
  );
}

function pickMachine(r) {
  return (
    r?.machine_name ??
    r?.["対応マシン名"] ??
    r?.対応マシン名 ??
    "—"
  );
}

function pickPrize(r) {
  return (
    r?.item_name ??
    r?.["景品名"] ??
    r?.景品名 ??
    r?.name ??
    "（名称なし）"
  );
}

/* =========================================================
 * Core
 * ========================================================= */

let focusChart = null;

export function destroyWidget3ScatterFocus() {
  if (focusChart?.destroy) {
    try { focusChart.destroy(); } catch {}
  }
  focusChart = null;
}

function buildPoints(rows) {
  const pts = [];
  for (const r of rows) {
    const sales = toNum(r?.sales);
    const rate = normRate01(r?.cost_rate ?? r?.原価率);
    if (sales == null || rate == null) continue;
    pts.push({ x: sales, y: rate * 100, _row: r });
  }
  return pts;
}

function computeAverage(rows) {
  if (!rows.length) return { avgX: 0, avgY: 0 };

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const r of rows) {
    const x = toNum(r?.sales);
    const y = normRate01(r?.cost_rate ?? r?.原価率);
    if (x == null || y == null) continue;
    sumX += x;
    sumY += y;
    count++;
  }

  if (!count) return { avgX: 0, avgY: 0 };

  return {
    avgX: sumX / count,
    avgY: (sumY / count) * 100,
  };
}

/* =========================================================
 * Focus Render
 * ========================================================= */

export function renderWidget3ScatterFocus(mount, state) {
  if (!mount) return;

  destroyWidget3ScatterFocus();
  clear(mount);

  const rowsAll = Array.isArray(state?.filteredRows)
    ? state.filteredRows
    : [];

  /* -------------------------
   * UI Controls
   * ------------------------- */

  const genreSel = el("select", { class: "select" }, [
    el("option", { value: "ALL", text: "ジャンル：ALL" }),
    ...Object.entries(GENRES || {}).map(([key, label]) =>
      el("option", { value: key, text: `ジャンル：${label}` })
    ),
  ]);

  const machineSet = new Set(
    rowsAll.map(pickMachine).filter(Boolean)
  );

  const machineSel = el("select", { class: "select" }, [
    el("option", { value: "ALL", text: "マシン：ALL" }),
    ...Array.from(machineSet).sort().map(m =>
      el("option", { value: m, text: `マシン：${m}` })
    ),
  ]);

  const toolsRow = el("div", { class: "w3ToolsRow" }, [
    genreSel,
    machineSel,
  ]);

  const header = el("div", { class: "focusPanelTop" }, [
    el("div", { class: "focusPanelTitle", text: "売上 × 原価率" }),
    el("div", {
      class: "focusPanelNote",
      text: "ジャンル・マシンで絞込可能 / 平均線表示",
    }),
  ]);

  const panel = el("div", { class: "focusPanel w3Focus" }, [
    header,
    toolsRow,
  ]);

  /* -------------------------
   * Layout
   * ------------------------- */

  const chartWrap = el("div", { class: "w3ChartWrap" });
  const canvas = el("canvas");
  chartWrap.appendChild(canvas);

  const cardWrap = el("div", { class: "w3Right" }, [
    el("div", { class: "w3ListTitle", text: "選択中：—" }),
    el("div", { class: "w3CardArea" }),
  ]);

  const grid = el("div", { class: "focusDonutGrid w3Grid" }, [
    el("div", { class: "w3Left" }, [chartWrap]),
    cardWrap,
  ]);

  panel.appendChild(grid);
  mount.appendChild(panel);

  const cardArea = cardWrap.querySelector(".w3CardArea");
  const titleArea = cardWrap.querySelector(".w3ListTitle");

  /* -------------------------
   * Filtering
   * ------------------------- */

  function getFiltered() {
    return rowsAll.filter(r => {
      const g = genreSel.value;
      const m = machineSel.value;

      if (g !== "ALL" && pickGenre(r) !== g) return false;
      if (m !== "ALL" && pickMachine(r) !== m) return false;
      return true;
    });
  }

  /* -------------------------
   * Render Chart
   * ------------------------- */

  function renderChart() {
    const rows = getFiltered();
    const pts = buildPoints(rows);
    const { avgX, avgY } = computeAverage(rows);

    if (focusChart?.destroy) focusChart.destroy();

    focusChart = new window.Chart(canvas.getContext("2d"), {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "points",
            data: pts,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: {
              callback: v => `${fmtYen(v)}円`,
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: {
              callback: v => `${v}%`,
            },
          },
        },
        animation: false,
        plugins: {
          annotation: {
            annotations: {
              avgX: {
                type: "line",
                xMin: avgX,
                xMax: avgX,
                borderColor: "#94a3b8",
                borderWidth: 1,
              },
              avgY: {
                type: "line",
                yMin: avgY,
                yMax: avgY,
                borderColor: "#94a3b8",
                borderWidth: 1,
              },
            },
          },
        },
        onClick(evt) {
          const points = focusChart.getElementsAtEventForMode(
            evt,
            "nearest",
            { intersect: true },
            true
          );
          if (!points.length) return;

          const r = points[0].element.$context.raw._row;
          renderCard(r);
        },
      },
    });
  }

  /* -------------------------
   * Card (single)
   * ------------------------- */

  function renderCard(r) {
    clear(cardArea);
    titleArea.textContent = `選択中：${pickBoothId(r)}`;

    cardArea.appendChild(
      el("div", { class: "w3Card" }, [
        el("div", { class: "w3CardTitle", text: pickPrize(r) }),
        el("div", { class: "w3CardSub", text: `ブース：${pickBoothId(r)}` }),
        el("div", { class: "w3CardSub", text: `マシン：${pickMachine(r)}` }),
        el("div", { class: "w3Chip", text: `ジャンル：${pickGenre(r)}` }),
        el("div", { class: "w3Chip", text: `売上：${fmtYen(r.sales)}円` }),
        el("div", { class: "w3Chip", text: `消化額：${fmtYen(r.claw)}円` }),
        el("div", {
          class: "w3Chip",
          text: `原価率：${fmtPct01(normRate01(r.cost_rate ?? r.原価率))}`,
        }),
      ])
    );
  }

  genreSel.addEventListener("change", renderChart);
  machineSel.addEventListener("change", renderChart);

  renderChart();
}
