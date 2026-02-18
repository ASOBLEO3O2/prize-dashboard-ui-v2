// src/ui/widget3Scatter.js
import { el, clear } from "../utils/dom.js";
import { GENRES } from "../constants.js";

/**
 * Widget③：売上 × 原価率（散布）
 * - B案：state.normRows（正規化済み）だけを見る（raw列へ戻らない）
 *
 * 表示：
 * - X軸：売上（円）
 * - Y軸：原価率（%）= costRate01 * 100
 *
 * 2026-02（調整）
 * - tooltip：重なり多数でも「1行 + (+n件)」にして大量列挙を抑止
 * - midでもID（ブースID等）を出す
 * - focus：右カードのみスクロール、縦長/狭幅は縦積み（CSS側）
 * - カード情報を normRows 情報で濃くする
 * - 点/軸/グリッドのコントラストを上げる
 * - ✅ Y軸は常に 0〜100% 固定
 */

/* =========================================================
 * 表示IDの方針（どれか1つ）
 * ========================================================= */
const W3_ID_MODE = "booth"; // "booth" | "machine" | "label"

function asStr(v) {
  return String(v ?? "").trim();
}
function fmtYen(v) {
  return new Intl.NumberFormat("ja-JP").format(Math.round(Number(v) || 0));
}
function fmtPct01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
function fmtPct100(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}
function canvasReady(cv) {
  if (!cv) return false;
  const rect = cv.getBoundingClientRect?.();
  if (!rect) return false;
  return rect.width >= 40 && rect.height >= 80;
}

// machineName は本来「対応マシン名」由来で左右が付かない想定。
// 万一の混入に備え、表示だけ末尾の左右を落とす（データは変えない）
function stripSideSuffix_(s) {
  const t = asStr(s);
  if (!t) return "";
  return t.replace(/[ 　]*([左右上下])\s*$/u, "").trim();
}

function pickIdText_(r) {
  if (W3_ID_MODE === "label") return asStr(r?.labelId) || "—";
  if (W3_ID_MODE === "machine") return stripSideSuffix_(r?.machineName) || "—";
  return asStr(r?.boothId) || "—";
}

function genresList_() {
  if (!Array.isArray(GENRES)) return [];
  return GENRES.map((g) => ({ key: asStr(g?.key), label: asStr(g?.label) })).filter(
    (g) => g.key
  );
}
function buildGenreSelectOptions_() {
  const list = genresList_();
  return [
    el("option", { value: "ALL", text: "ジャンル：ALL" }),
    ...list.map((g) =>
      el("option", { value: g.key, text: `ジャンル：${g.label || g.key}` })
    ),
  ];
}

function buildPoints(normRows) {
  const pts = [];
  for (const r of normRows || []) {
    const sales = Number(r?.sales);
    const rate01 = Number(r?.costRate01);
    if (!Number.isFinite(sales)) continue;
    if (!Number.isFinite(rate01)) continue;
    pts.push({ x: sales, y: rate01 * 100, _row: r });
  }
  return pts;
}

function computeAverageFromPoints(points) {
  if (!points.length) return { avgX: null, avgY: null };
  let sx = 0,
    sy = 0,
    n = 0;
  for (const p of points) {
    if (p?.x == null || p?.y == null) continue;
    sx += p.x;
    sy += p.y;
    n++;
  }
  if (!n) return { avgX: null, avgY: null };
  return { avgX: sx / n, avgY: sy / n };
}

/* =========================================================
 * ✅ Y軸固定スケール（共通）
 * ========================================================= */
function fixedYAxis100_() {
  return {
    min: 0,
    max: 100, // ✅ 100% 固定
    ticks: {
      stepSize: 10,
      callback: (v) => `${v}%`,
    },
    grid: { color: "rgba(148,163,184,.18)" },
  };
}

/* =========================================================
 * 平均線プラグイン
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
    ctx.strokeStyle = "rgba(148,163,184,.85)";

    if (avgX != null) {
      const x = xScale.getPixelForValue(avgX);
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
    }
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
 * Tooltip（大量列挙抑止）
 * ========================================================= */
function tooltipTitleOneLine_(items) {
  if (!items?.length) return "";
  const p0 = items[0]?.raw;
  const r = p0?._row;
  const id = r ? pickIdText_(r) : "—";
  const x = fmtYen(p0?.x);
  const y = fmtPct100(p0?.y);
  const extra = items.length > 1 ? `（+${items.length - 1}件）` : "";
  return `${id} ｜ 売上 ${x}円 / 原価率 ${y}${extra}`;
}
function tooltipLabelPrize_(item) {
  const r = item?.raw?._row;
  if (!r) return "";
  const prize = asStr(r?.prizeName) || "—";
  return `景品：${prize}`;
}

/* =========================================================
 * MID（拡大前）
 * ========================================================= */
let midChart = null;
let midCanvas = null;

function destroyMid() {
  if (midChart?.destroy) {
    try {
      midChart.destroy();
    } catch {}
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
            pointRadius: 3.5,
            pointHoverRadius: 6,
            pointBorderWidth: 1,
            pointBackgroundColor: "rgba(96, 165, 250, 0.85)",
            pointBorderColor: "rgba(226, 232, 240, 0.9)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: tooltipTitleOneLine_,
              label: () => "",
            },
          },
        },
        scales: {
          x: {
            ticks: { callback: (v) => `${fmtYen(v)}円` },
            grid: { color: "rgba(148,163,184,.18)" },
          },
          y: fixedYAxis100_(), // ✅ ここで固定
        },
      },
    });

    midCanvas = canvas;
    requestAnimationFrame(() => midChart?.resize?.());
  }

  return true;
}

function updateMid(normRows) {
  if (!midChart) return;

  const pts = buildPoints(normRows);

  // 過負荷保険
  const MAX = 2500;
  midChart.data.datasets[0].data = pts.length > MAX ? pts.slice(0, MAX) : pts;

  midChart.update();
}

/**
 * kpiMid.js から呼ばれる
 */
export function renderWidget3Scatter(body, state, actions) {
  if (!body) return;

  const rows = Array.isArray(state?.normRows) ? state.normRows : [];

  if (!body.__w3_built) {
    clear(body);
    body.classList.add("chartBody");

    // 軸説明（mid）
    body.appendChild(
      el("div", {
        class: "w3AxisHint",
        text: "X軸=売上（円） / Y軸=原価率（%）",
      })
    );

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
    const tries = body.__w3_tryCount || 0;
    if (tries < 30) {
      body.__w3_tryCount = tries + 1;
      requestAnimationFrame(() => renderWidget3Scatter(body, state, actions));
    }
    return;
  }

  updateMid(rows);
}

/* =========================================================
 * FOCUS（拡大後）
 * ========================================================= */
let focusChart = null;

export function destroyWidget3ScatterFocus() {
  if (focusChart?.destroy) {
    try {
      focusChart.destroy();
    } catch {}
  }
  focusChart = null;
}

export function renderWidget3ScatterFocus(mount, state) {
  if (!mount) return;

  const Chart = window.Chart;
  if (!Chart) {
    clear(mount);
    mount.appendChild(
      el("div", { class: "focusPlaceholder", text: "Chart.js が未ロードです" })
    );
    return;
  }

  destroyWidget3ScatterFocus();
  clear(mount);

  const rowsAll = Array.isArray(state?.normRows) ? state.normRows : [];

  // ===== tools =====
  const genreSel = el("select", { class: "select" }, buildGenreSelectOptions_());

  const machineSet = new Set(
    (rowsAll || []).map((r) => stripSideSuffix_(r?.machineName)).filter(Boolean)
  );
  const machineSel = el("select", { class: "select" }, [
    el("option", { value: "ALL", text: "マシン：ALL" }),
    ...Array.from(machineSet)
      .sort()
      .map((m) => el("option", { value: m, text: `マシン：${m}` })),
  ]);

  const toolsRow = el("div", { class: "w3ToolsRow" }, [genreSel, machineSel]);

  const header = el("div", { class: "focusPanelTop" }, [
    el("div", { class: "focusPanelTitle", text: "売上 × 原価率" }),
    el("div", {
      class: "focusPanelNote",
      text: "X軸=売上（円） / Y軸=原価率（%）｜ジャンル・マシンで絞込｜平均線｜点クリックでカード",
    }),
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

    return (rowsAll || []).filter((r) => {
      const gk = asStr(r?.prizeGenreKey) || "other";
      const mk = stripSideSuffix_(r?.machineName);

      if (g !== "ALL" && gk !== g) return false;
      if (m !== "ALL" && mk !== m) return false;
      return true;
    });
  }

  function pickSubGenreLabel_(r) {
    const parent = asStr(r?.prizeGenreLabel);
    if (parent === "食品") return asStr(r?.foodLabel) || "未分類";
    if (parent === "ぬいぐるみ") return asStr(r?.plushLabel) || "未分類";
    if (parent === "雑貨") return asStr(r?.goodsLabel) || "未分類";
    return (
      asStr(r?.plushLabel) ||
      asStr(r?.foodLabel) ||
      asStr(r?.goodsLabel) ||
      "未分類"
    );
  }

  function flagsText_(r) {
    const f = [];
    if (r?.isMovie) f.push("映画");
    if (r?.isReserve) f.push("予約");
    if (r?.isWlOriginal) f.push("WL");
    return f.length ? f.join(" / ") : "—";
  }

  function chip(text) {
    return el("div", { class: "w3Chip", text });
  }
  function chipRow(items) {
    return el("div", { class: "w3ChipRow" }, items);
  }

  // ===== card =====
  function renderCard(r) {
    clear(cardArea);

    const prize = asStr(r?.prizeName) || "（名称なし）";
    const updated = asStr(r?.updatedDate) || "—";

    const idText = pickIdText_(r);
    titleArea.textContent = `選択中：${idText}`;

    const genreLabel = asStr(r?.prizeGenreLabel) || "その他";
    const subGenre = pickSubGenreLabel_(r);

    const sales = Number(r?.sales) || 0;
    const claw = Number(r?.claw) || 0;
    const rate01 = Number.isFinite(Number(r?.costRate01)) ? Number(r.costRate01) : null;

    const fee = asStr(r?.feeLabel) || "—";
    const plays = asStr(r?.playsLabel) || "—";

    const method = asStr(r?.methodLabel) || "—";
    const clawDetail =
      method === "3本爪"
        ? asStr(r?.claw3Label) || "未分類"
        : method === "2本爪"
        ? asStr(r?.claw2Label) || "未分類"
        : "—";

    const age = asStr(r?.ageLabel) || "—";
    const target = asStr(r?.targetLabel) || "—";

    const chara = asStr(r?.charaLabel) || "—";
    const charaGenre =
      chara === "ノンキャラ"
        ? asStr(r?.nonCharaGenreLabel) || "未分類"
        : asStr(r?.charaGenreLabel) || "未分類";

    cardArea.appendChild(
      el("div", { class: "w3Card" }, [
        el("div", { class: "w3CardTitle", text: prize }),
        el("div", { class: "w3CardSub", text: `ID：${idText} / 更新：${updated}` }),

        chipRow([chip(`ジャンル：${genreLabel}`), chip(`サブ：${subGenre}`)]),
        chipRow([chip(`料金：${fee}`), chip(`回数：${plays}`)]),
        chipRow([chip(`投入法：${method}`), chip(`内訳：${clawDetail}`)]),
        chipRow([chip(`年代：${age}`), chip(`ターゲット：${target}`)]),
        chipRow([chip(`キャラ：${chara}`), chip(`分類：${charaGenre}`)]),
        chipRow([chip(`フラグ：${flagsText_(r)}`)]),

        chipRow([chip(`売上：${fmtYen(sales)}円`), chip(`消化額：${fmtYen(claw)}円`)]),
        chipRow([chip(`原価率：${rate01 == null ? "—" : fmtPct01(rate01)}`)]),
      ])
    );
  }

  // ===== chart =====
  function renderChart() {
    const rows = filteredRows();
    const pts = buildPoints(rows);
    const { avgX, avgY } = computeAverageFromPoints(pts);

    const MAX = 6000;
    const data = pts.length > MAX ? pts.slice(0, MAX) : pts;

    if (focusChart?.destroy) {
      try {
        focusChart.destroy();
      } catch {}
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
            pointBorderWidth: 1,
            pointBackgroundColor: "rgba(96, 165, 250, 0.85)",
            pointBorderColor: "rgba(226, 232, 240, 0.9)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: false },
          avgLinesPlugin: { avgX, avgY },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: tooltipTitleOneLine_,
              label: tooltipLabelPrize_,
            },
          },
        },
        scales: {
          x: {
            ticks: { callback: (v) => `${fmtYen(v)}円` },
            grid: { color: "rgba(148,163,184,.18)" },
          },
          y: fixedYAxis100_(), // ✅ ここで固定
        },
        onClick(evt) {
          const hit = focusChart.getElementsAtEventForMode(
            evt,
            "nearest",
            { intersect: true },
            true
          );
          if (!hit || hit.length === 0) return;

          const idx = hit[0].index;
          const p = focusChart.data?.datasets?.[0]?.data?.[idx];
          const r = p?._row;
          if (!r) return;

          renderCard(r);
        },
      },
      plugins: [AvgLinesPlugin],
    });

    titleArea.textContent = "選択中：—";
    clear(cardArea);
    cardArea.appendChild(
      el("div", { class: "w3Hint", text: "点をクリックするとカードが表示されます" })
    );
  }

  genreSel.addEventListener("change", renderChart);
  machineSel.addEventListener("change", renderChart);

  renderChart();
}
