// src/ui/widget3Scatter.js
import { el, clear } from "../utils/dom.js";
import { GENRES } from "../constants.js";

/**
 * Widget③：売上 × 原価率（散布）
 * - B案：state.normRows（正規化済み）だけを見る
 *   - x: r.sales
 *   - y: r.costRate01（0..1）→ 表示は %
 *   - card: normRows の情報をできるだけ出す（薄さ解消）
 *
 * 修正（2026-02-18）
 * - tooltip の「points:(x,y)大量列挙」を抑止
 * - focus（全画面）レイアウト：左最大化・右カードだけスクロール
 * - カード内容を normRows 情報で増やす
 */

/* =========================================================
 * Utils
 * ========================================================= */

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

function genresList_() {
  // GENRES: [{key,label}, ...] 前提。念のため壊れてても落ちないように。
  if (Array.isArray(GENRES)) {
    return GENRES
      .map((g) => ({
        key: asStr(g?.key),
        label: asStr(g?.label),
      }))
      .filter((g) => g.key);
  }
  return [];
}

function buildGenreSelectOptions_() {
  const list = genresList_();
  if (!list.length) {
    return [el("option", { value: "ALL", text: "ジャンル：ALL" })];
  }
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

    // Chartは y を % 表示したいので *100
    pts.push({ x: sales, y: rate01 * 100, _row: r });
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

/* =========================================================
 * Average lines plugin
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
 * Tooltip builders
 * ========================================================= */

function tooltipTitleOneLine_(items) {
  if (!items?.length) return "";
  const p0 = items[0]?.raw;
  const x = fmtYen(p0?.x);
  const y = fmtPct100(p0?.y);
  const extra = items.length > 1 ? `（+${items.length - 1}件）` : "";
  return `${x}円 / ${y} ${extra}`;
}

function tooltipLabelOneRow_(item) {
  const r = item?.raw?._row;
  if (!r) return "";
  const booth = asStr(r?.boothId) || "—";
  const prize = asStr(r?.prizeName) || "—";
  return `${booth} / ${prize}`;
}

/* =========================================================
 * MID (拡大前)
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
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,

        // ✅ tooltip 大量列挙抑止 + 最近傍で安定
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: tooltipTitleOneLine_,
              label: () => "", // 複数行列挙を抑止
            },
          },
        },

        scales: {
          x: { ticks: { callback: (v) => `${fmtYen(v)}円` } },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: { callback: (v) => `${v}%` },
          },
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

  // 過負荷保険（表示上限）
  const MAX = 2500;
  midChart.data.datasets[0].data = pts.length > MAX ? pts.slice(0, MAX) : pts;

  midChart.update();
}

/**
 * ✅ kpiMid.js が import している拡大前描画
 */
export function renderWidget3Scatter(body, state, actions) {
  if (!body) return;

  // ✅ B案：normRows に統一
  const rows = Array.isArray(state?.normRows) ? state.normRows : [];

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
 * FOCUS (拡大後)
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

  // ✅ B案：normRows に統一
  const rowsAll = Array.isArray(state?.normRows) ? state.normRows : [];

  // ===== tools =====
  const genreSel = el("select", { class: "select" }, buildGenreSelectOptions_());

  const machineSet = new Set(
    (rowsAll || []).map((r) => asStr(r?.machineName)).filter(Boolean)
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
      text: "ジャンル・マシンで絞込 / 平均線表示 / 点クリックでカード1枚",
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
      const mk = asStr(r?.machineName);

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
    // その他は空にせず、拾えるものを拾う
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

  // ===== card (single) =====
  function renderCard(r) {
    clear(cardArea);

    const booth = asStr(r?.boothId) || "—";
    const machine = asStr(r?.machineName) || "—";
    const prize = asStr(r?.prizeName) || "（名称なし）";
    const labelId = asStr(r?.labelId) || "—";
    const updated = asStr(r?.updatedDate) || "—";

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

    titleArea.textContent = `選択中：${booth}`;

    cardArea.appendChild(
      el("div", { class: "w3Card" }, [
        el("div", { class: "w3CardTitle", text: prize }),
        el("div", { class: "w3CardSub", text: `ブース：${booth}` }),
        el("div", { class: "w3CardSub", text: `マシン：${machine}` }),
        el("div", { class: "w3CardSub", text: `ラベルID：${labelId} / 更新：${updated}` }),

        chipRow([
          chip(`ジャンル：${genreLabel}`),
          chip(`サブ：${subGenre}`),
        ]),

        chipRow([
          chip(`料金：${fee || "—"}`),
          chip(`回数：${plays || "—"}`),
        ]),

        chipRow([
          chip(`投入法：${method}`),
          chip(`内訳：${clawDetail}`),
        ]),

        chipRow([
          chip(`年代：${age}`),
          chip(`ターゲット：${target}`),
        ]),

        chipRow([
          chip(`キャラ：${chara}`),
          chip(`分類：${charaGenre}`),
        ]),

        chipRow([chip(`フラグ：${flagsText_(r)}`)]),

        // KPI
        chipRow([
          chip(`売上：${fmtYen(sales)}円`),
          chip(`消化額：${fmtYen(claw)}円`),
        ]),
        chipRow([chip(`原価率：${rate01 == null ? "—" : fmtPct01(rate01)}`)]),
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
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,

        // ✅ tooltip 大量列挙抑止 + 最近傍で安定
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: false },
          avgLinesPlugin: { avgX, avgY },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: tooltipTitleOneLine_,
              label: tooltipLabelOneRow_, // 先頭点だけ補足（薄さ対策）
            },
          },
        },

        scales: {
          x: { ticks: { callback: (v) => `${fmtYen(v)}円` } },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: { callback: (v) => `${v}%` },
          },
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

    // フィルタ変更で「選択中」表示はリセット
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
