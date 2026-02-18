// src/ui/widget3Scatter.js
import { el, clear } from "../utils/dom.js";
import { GENRES } from "../constants.js";

/* =========================================================
 * Utils
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
  return n > 1.5 ? n / 100 : n; // 31 or 0.31 両対応
}

function fmtYen(v) {
  return new Intl.NumberFormat("ja-JP").format(Math.round(Number(v) || 0));
}

function fmtPct01(v) {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function pickGenreKey(r) {
  // ※ジャンル値が key ではなく label の場合もあるため、後で normalize する
  return (
    r?.genre ??
    r?.["ジャンル"] ??
    r?.景品ジャンル ??
    r?.["景品ジャンル"] ??
    "未分類"
  );
}

function normalizeGenreKey(g) {
  const s = String(g || "").trim();
  if (!s) return "未分類";
  // すでに key の場合
  if (GENRES && Object.prototype.hasOwnProperty.call(GENRES, s)) return s;
  // label → key 変換
  if (GENRES) {
    const ent = Object.entries(GENRES).find(([, label]) => String(label) === s);
    if (ent) return ent[0];
  }
  return s; // 不明値はそのまま保持（後方互換）
}

function genreLabelFromKey(key) {
  if (!key) return "未分類";
  if (GENRES && Object.prototype.hasOwnProperty.call(GENRES, key)) return GENRES[key];
  return String(key);
}

function pickBoothId(r) {
  return r?.booth_id ?? r?.["ブースID"] ?? r?.boothId ?? "—";
}

function pickMachine(r) {
  return r?.machine_name ?? r?.["対応マシン名"] ?? r?.対応マシン名 ?? "—";
}

function pickPrize(r) {
  return r?.item_name ?? r?.["景品名"] ?? r?.景品名 ?? r?.name ?? "（名称なし）";
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

function computeAverageFromPoints(points) {
  if (!points.length) return { avgX: null, avgY: null };
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const p of points) {
    if (p?.x == null || p?.y == null) continue;
    sx += p.x;
    sy += p.y;
    n++;
  }
  if (!n) return { avgX: null, avgY: null };
  return { avgX: sx / n, avgY: sy / n };
}

function canvasReady(cv) {
  if (!cv) return false;
  const rect = cv.getBoundingClientRect?.();
  if (!rect) return false;
  return rect.width >= 40 && rect.height >= 80;
}

/* =========================================================
 * Average lines plugin (no external annotation dependency)
 * ========================================================= */

const AvgLinesPlugin = {
  id: "avgLinesPlugin",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const avgX = pluginOptions?.avgX;
    const avgY = pluginOptions?.avgY;
    if (avgX == null && avgY == null) return;

    const { ctx, chartArea, scales } = chart;
    const xScale = scales?.x;
    const yScale = scales?.y;
    if (!chartArea || !xScale || !yScale) return;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(148,163,184,.9)";

    // vertical avgX
    if (avgX != null) {
      const x = xScale.getPixelForValue(avgX);
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
    }

    // horizontal avgY
    if (avgY != null) {
      const y = yScale.getPixelForValue(avgY);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
    }

    ctx.restore();
  },
};

/* =========================================================
 * MID (拡大前) - export renderWidget3Scatter
 * ========================================================= */

let midChart = null;
let midCanvas = null;

function destroyMid() {
  if (midChart?.destroy) {
    try { midChart.destroy(); } catch {}
  }
  midChart = null;
  midCanvas = null;
}

function ensureMid(canvas) {
  const Chart = window.Chart;
  if (!Chart) return false;
  if (!canvasReady(canvas)) return false;

  if (midCanvas && midCanvas !== canvas) destroyMid();

  if (!midChart) {
    const ctx = canvas.getContext?.("2d");
    if (!ctx) return false;

    midChart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "points",
            data: [],
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        animation: false,
        scales: {
          x: {
            ticks: {
              callback: (v) => `${fmtYen(v)}円`,
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: {
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    });

    midCanvas = canvas;
    requestAnimationFrame(() => midChart?.resize?.());
  }

  return true;
}

function updateMid(rows) {
  if (!midChart) return;

  const pts = buildPoints(rows);
  // v0：過負荷保険（表示上限）
  const MAX = 2500;
  midChart.data.datasets[0].data = pts.length > MAX ? pts.slice(0, MAX) : pts;

  midChart.update();
}

/**
 * ✅ kpiMid.js が import している拡大前描画
 */
export function renderWidget3Scatter(body, state, actions) {
  if (!body) return;

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  if (!body.__w3_built) {
    clear(body);
    body.classList.add("chartBody");

    const cv = el("canvas", { id: "w3ScatterChart" });
    cv.style.width = "100%";
    cv.style.height = "100%";
    cv.style.display = "block";
    body.appendChild(cv);

    body.addEventListener("click", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "select" || tag === "option" || tag === "button") return;
      actions?.onOpenFocus?.("scatter");
    });

    body.__w3_built = true;
  }

  const canvas = body.querySelector?.("#w3ScatterChart");

  if (!ensureMid(canvas)) {
    const tries = (body.__w3_tryCount || 0);
    if (tries < 30) {
      body.__w3_tryCount = tries + 1;
      requestAnimationFrame(() => renderWidget3Scatter(body, state, actions));
    }
    return;
  }

  updateMid(rows);
}

/* =========================================================
 * FOCUS (拡大後)
 * ========================================================= */

let focusChart = null;

export function destroyWidget3ScatterFocus() {
  if (focusChart?.destroy) {
    try { focusChart.destroy(); } catch {}
  }
  focusChart = null;
}

export function renderWidget3ScatterFocus(mount, state) {
  if (!mount) return;

  const Chart = window.Chart;
  if (!Chart) {
    clear(mount);
    mount.appendChild(el("div", { class: "focusPlaceholder", text: "Chart.js が未ロードです" }));
    return;
  }

  destroyWidget3ScatterFocus();
  clear(mount);

  const rowsAll = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  // ===== tools =====
  const genreSel = el("select", { class: "select" }, [
    el("option", { value: "ALL", text: "ジャンル：ALL" }),
    ...Object.entries(GENRES || {}).map(([key, label]) =>
      el("option", { value: key, text: `ジャンル：${label}` })
    ),
  ]);

  const machineSet = new Set(rowsAll.map(pickMachine).filter(Boolean));
  const machineSel = el("select", { class: "select" }, [
    el("option", { value: "ALL", text: "マシン：ALL" }),
    ...Array.from(machineSet).sort().map((m) =>
      el("option", { value: m, text: `マシン：${m}` })
    ),
  ]);

  const toolsRow = el("div", { class: "w3ToolsRow" }, [genreSel, machineSel]);

  const header = el("div", { class: "focusPanelTop" }, [
    el("div", { class: "focusPanelTitle", text: "売上 × 原価率" }),
    el("div", { class: "focusPanelNote", text: "ジャンル・マシンで絞込 / 平均線表示 / 点クリックでカード1枚" }),
  ]);

  const panel = el("div", { class: "focusPanel w3Focus" }, [header, toolsRow]);

  // ===== layout =====
  const chartWrap = el("div", { class: "w3ChartWrap" });
  const canvas = el("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  chartWrap.appendChild(canvas);

  const titleArea = el("div", { class: "w3ListTitle", text: "選択中：—" });
  const cardArea = el("div", { class: "w3CardArea" }, [
    el("div", { class: "w3Hint", text: "点をクリックするとカードが表示されます" }),
  ]);

  const right = el("div", { class: "w3Right" }, [titleArea, cardArea]);

  const grid = el("div", { class: "focusDonutGrid w3Grid" }, [
    el("div", { class: "w3Left" }, [chartWrap]),
    right,
  ]);

  panel.appendChild(grid);
  mount.appendChild(panel);

  // ===== filtering =====
  function filteredRows() {
    const g = genreSel.value;
    const m = machineSel.value;

    return rowsAll.filter((r) => {
      const gk = normalizeGenreKey(pickGenreKey(r));
      const mk = pickMachine(r);

      if (g !== "ALL" && gk !== g) return false;
      if (m !== "ALL" && mk !== m) return false;
      return true;
    });
  }

  // ===== card (single) =====
  function renderCard(r) {
    clear(cardArea);

    const booth = String(pickBoothId(r));
    const machine = String(pickMachine(r));
    const prize = String(pickPrize(r));
    const gk = normalizeGenreKey(pickGenreKey(r));
    const genreLabel = genreLabelFromKey(gk);

    const sales = toNum(r?.sales) ?? 0;
    const claw = toNum(r?.claw) ?? 0;
    const rate01 = normRate01(r?.cost_rate ?? r?.原価率);

    titleArea.textContent = `選択中：${booth}`;

    cardArea.appendChild(
      el("div", { class: "w3Card" }, [
        el("div", { class: "w3CardTitle", text: prize }),
        el("div", { class: "w3CardSub", text: `ブース：${booth}` }),
        el("div", { class: "w3CardSub", text: `マシン：${machine}` }),
        el("div", { class: "w3Chip", text: `ジャンル：${genreLabel}` }),
        el("div", { class: "w3Chip", text: `売上：${fmtYen(sales)}円` }),
        el("div", { class: "w3Chip", text: `消化額：${fmtYen(claw)}円` }),
        el("div", { class: "w3Chip", text: `原価率：${rate01 == null ? "—" : fmtPct01(rate01)}` }),
      ])
    );
  }

  // ===== chart =====
  function renderChart() {
    const rows = filteredRows();
    const pts = buildPoints(rows);
    const { avgX, avgY } = computeAverageFromPoints(pts);

    // 表示過負荷保険
    const MAX = 6000;
    const data = pts.length > MAX ? pts.slice(0, MAX) : pts;

    if (focusChart?.destroy) {
      try { focusChart.destroy(); } catch {}
    }

    focusChart = new Chart(canvas.getContext("2d"), {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "points",
            data,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          avgLinesPlugin: { avgX, avgY }, // ← ここに渡す
        },
        scales: {
          x: {
            ticks: { callback: (v) => `${fmtYen(v)}円` },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: { callback: (v) => `${v}%` },
          },
        },
        onClick(evt) {
          const hit = focusChart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true);
          if (!hit || hit.length === 0) return;

          const idx = hit[0].index;
          const p = focusChart.data?.datasets?.[0]?.data?.[idx];
          const r = p?._row;
          if (!r) return;

          renderCard(r);
        },
      },
      plugins: [AvgLinesPlugin], // ← 内蔵プラグインを注入
    });

    // フィルタ変更で「選択中」表示はリセット
    titleArea.textContent = "選択中：—";
    clear(cardArea);
    cardArea.appendChild(el("div", { class: "w3Hint", text: "点をクリックするとカードが表示されます" }));
  }

  genreSel.addEventListener("change", renderChart);
  machineSel.addEventListener("change", renderChart);

  renderChart();
}
