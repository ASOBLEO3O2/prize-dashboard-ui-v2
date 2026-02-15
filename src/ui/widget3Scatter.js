// src/ui/widget3Scatter.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget③ v0：売上 × 原価率（散布図）
 * - v0はセレクト無し（X=売上固定）
 * - 点クリック → 右側に「同一ブースIDの行（カード）」を一覧表示
 * - mid：クリックで拡大（focus.kind="scatter"）
 */

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
  // 0.31 でも 31 でも入ってきてもOKにする
  if (n > 1.5) return n / 100;
  return n;
}

function fmtYen(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("ja-JP").format(Math.round(n));
}

function fmtPct01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function pickPrizeName_(r) {
  const v = r?.item_name ?? r?.["景品名"] ?? r?.景品名 ?? r?.name ?? r?.title ?? "";
  const s = String(v || "").trim();
  return s || "（景品名なし）";
}

function pickBoothId_(r) {
  const v = r?.booth_id ?? r?.["ブースID"] ?? r?.boothId ?? "";
  const s = String(v || "").trim();
  return s || "（ブースIDなし）";
}

function pickMachineName_(r) {
  const v = r?.machine_name ?? r?.["対応マシン名"] ?? r?.対応マシン名 ?? "";
  return String(v || "").trim();
}

const BOOTH_COLLATOR = new Intl.Collator("ja-JP", { numeric: true, sensitivity: "base" });

function getTheme_() {
  const cs = getComputedStyle(document.documentElement);
  return {
    text: (cs.getPropertyValue("--text") || "#e5e7eb").trim(),
    muted: (cs.getPropertyValue("--muted") || "#94a3b8").trim(),
  };
}

function buildPoints_(rows) {
  const pts = [];
  for (const r of rows) {
    const x = toNum(r?.sales);
    const rate01 = normRate01(r?.cost_rate ?? r?.原価率);
    if (x == null || rate01 == null) continue;

    pts.push({
      x,
      y: rate01 * 100, // yは%表記で統一
      _row: r,
    });
  }
  return pts;
}

function canvasReady_(cv) {
  if (!cv) return false;
  const rect = cv.getBoundingClientRect?.();
  if (!rect) return false;
  return rect.width >= 40 && rect.height >= 80;
}

/* =============================================================================
 * mid（拡大前）
 * ============================================================================= */

let midChart = null;
let midCanvas = null;

function destroyMid_() {
  if (midChart?.destroy) {
    try { midChart.destroy(); } catch (e) {}
  }
  midChart = null;
  midCanvas = null;
}

function ensureMid_(canvas) {
  const Chart = window.Chart;
  if (!Chart) return false;
  if (!canvasReady_(canvas)) return false;

  if (midCanvas && midCanvas !== canvas) destroyMid_();

  if (!midChart) {
    const ctx = canvas.getContext?.("2d");
    if (!ctx) return false;

    const { muted } = getTheme_();

    midChart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [{
          label: "points",
          data: [],
          pointRadius: 3,
          pointHoverRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = ctx.raw;
                const r = p?._row;
                const booth = pickBoothId_(r);
                const prize = pickPrizeName_(r);
                const sales = toNum(r?.sales) ?? 0;
                const rate01 = normRate01(r?.cost_rate ?? r?.原価率);
                return [
                  `${booth}`,
                  `${prize}`,
                  `売上: ${fmtYen(sales)}円`,
                  `原価率: ${rate01 == null ? "—" : fmtPct01(rate01)}`,
                ];
              },
            },
          },
        },
        layout: { padding: { top: 6, right: 10, bottom: 6, left: 6 } },
        scales: {
          x: {
            grid: { color: "rgba(148,163,184,.10)" },
            ticks: {
              color: muted,
              font: { size: 11, weight: "650" },
              callback: (v) => `${fmtYen(v)}円`,
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            grid: { color: "rgba(148,163,184,.16)" },
            ticks: {
              color: muted,
              font: { size: 11, weight: "650" },
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

function updateMid_(rows) {
  if (!midChart) return;

  const pts = buildPoints_(rows);

  // 店舗によっては点が多すぎて重くなるので v0 は上限つける（表示だけ）
  const MAX = 2500;
  const data = pts.length > MAX ? pts.slice(0, MAX) : pts;

  midChart.data.datasets[0].data = data;
  midChart.update();
}

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

    // カードクリックで拡大（select等はv0は無いが保険）
    body.addEventListener("click", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "select" || tag === "option" || tag === "button") return;
      actions?.onOpenFocus?.("scatter");
    });

    body.__w3_built = true;
  }

  const canvas = body.querySelector?.("#w3ScatterChart");

  if (!ensureMid_(canvas)) {
    const tries = (body.__w3_tryCount || 0);
    if (tries < 30) {
      body.__w3_tryCount = tries + 1;
      requestAnimationFrame(() => renderWidget3Scatter(body, state, actions));
    }
    return;
  }

  updateMid_(rows);
}

/* =============================================================================
 * focus（拡大後）
 * ============================================================================= */

let focusChart = null;

export function destroyWidget3ScatterFocus() {
  if (focusChart?.destroy) {
    try { focusChart.destroy(); } catch (e) {}
  }
  focusChart = null;
}

function renderCards_(listEl, listTitleEl, allRows, boothId) {
  const picked = allRows.filter((r) => pickBoothId_(r) === boothId);

  // 自然順 + 念のため売上降順も混ぜられるが、v0は自然順でOK
  picked.sort((a, b) => BOOTH_COLLATOR.compare(pickBoothId_(a), pickBoothId_(b)));

  listTitleEl.textContent = `選択中：${boothId}（${picked.length}件）`;
  clear(listEl);

  if (picked.length === 0) {
    listEl.appendChild(el("div", { class: "w3Empty", text: "該当なし" }));
    return;
  }

  const MAX = 120;
  const shown = picked.slice(0, MAX);

  for (const r of shown) {
    const prize = pickPrizeName_(r);
    const booth = pickBoothId_(r);
    const machine = pickMachineName_(r);
    const sales = toNum(r?.sales) ?? 0;
    const claw = toNum(r?.claw) ?? 0;
    const rate01 = normRate01(r?.cost_rate ?? r?.原価率);

    const showMachine = machine && machine.trim() && machine.trim() !== booth.trim();

    listEl.appendChild(
      el("div", { class: "w3Card" }, [
        el("div", { class: "w3CardTitle", text: prize }),
        el("div", { class: "w3CardSub", text: booth }),
        showMachine
          ? el("div", { class: "w3CardSub2", text: machine })
          : el("div", { class: "w3CardSub2 is-hidden", text: "" }),
        el("div", { class: "w3CardMetrics" }, [
          el("span", { class: "w3Chip", text: `売上: ${fmtYen(sales)}円` }),
          el("span", { class: "w3Chip", text: `消化額: ${fmtYen(claw)}円` }),
          el("span", { class: "w3Chip", text: `原価率: ${rate01 == null ? "—" : fmtPct01(rate01)}` }),
        ]),
      ])
    );
  }

  if (picked.length > MAX) {
    listEl.appendChild(el("div", { class: "w3Hint", text: `※表示は上位${MAX}件まで（全${picked.length}件）` }));
  }
}

export function renderWidget3ScatterFocus(mount, state, actions) {
  if (!mount) return;

  const Chart = window.Chart;
  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  clear(mount);

  if (!Chart) {
    mount.appendChild(el("div", { class: "focusPlaceholder", text: "Chart.js が未ロードです" }));
    return;
  }

  const { muted } = getTheme_();

  // 画面構造（Widget②の思想に合わせて、左右とも“ちゃんとカード”に）
  const hint = el("div", { class: "w3HintPill", text: "点クリックで右にカード" });

  const nav = el("div", { class: "focusNav" }, [
    el("div", { class: "focusCrumb", text: "売上 × 原価率（拡大）" }),
    el("div", { class: "w3ToolsRow" }, [hint]),
  ]);

  const panel = el("div", { class: "focusPanel w3Focus" }, [
    el("div", { class: "focusPanelTop" }, [
      el("div", { class: "focusPanelTitle", text: "売上 × 原価率" }),
      el("div", { class: "focusPanelNote", text: "※v0：X=売上固定。点クリックで同一ブースIDのカード一覧。" }),
    ]),
    nav,
  ]);

  // 左：チャート枠
  const chartWrap = el("div", { class: "w3ChartWrap" });
  const canvas = el("canvas", { id: "w3FocusScatterChart" });
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  chartWrap.appendChild(canvas);

  // 右：一覧
  const listTitle = el("div", { class: "w3ListTitle", text: "選択中：—" });
  const list = el("div", { class: "w3List" }, [
    el("div", { class: "w3Hint", text: "点をクリックすると一覧が出ます" }),
  ]);

  const grid = el("div", { class: "focusDonutGrid w3Grid" }, [
    el("div", { class: "w3Left" }, [chartWrap]),
    el("div", { class: "w3Right" }, [listTitle, list]),
  ]);

  panel.appendChild(grid);
  mount.appendChild(panel);

  // chart
  destroyWidget3ScatterFocus();

  const ctx = canvas.getContext("2d");
  const pts = buildPoints_(rows);
  const MAX = 6000;
  const data = pts.length > MAX ? pts.slice(0, MAX) : pts;

  focusChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "points",
        data,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw;
              const r = p?._row;
              const booth = pickBoothId_(r);
              const prize = pickPrizeName_(r);
              const sales = toNum(r?.sales) ?? 0;
              const rate01 = normRate01(r?.cost_rate ?? r?.原価率);
              return [
                `${booth}`,
                `${prize}`,
                `売上: ${fmtYen(sales)}円`,
                `原価率: ${rate01 == null ? "—" : fmtPct01(rate01)}`,
              ];
            },
          },
        },
      },
      layout: { padding: { top: 10, right: 14, bottom: 10, left: 10 } },
      scales: {
        x: {
          grid: { color: "rgba(148,163,184,.10)" },
          ticks: {
            color: muted,
            font: { size: 12, weight: "750" },
            callback: (v) => `${fmtYen(v)}円`,
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          grid: { color: "rgba(148,163,184,.16)" },
          ticks: {
            color: muted,
            font: { size: 12, weight: "750" },
            callback: (v) => `${v}%`,
          },
        },
      },
      onClick: (evt) => {
        if (!focusChart) return;
        const hit = focusChart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true);
        if (!hit || hit.length === 0) return;

        const idx = hit[0].index;
        const p = focusChart.data.datasets?.[0]?.data?.[idx];
        const r = p?._row;
        if (!r) return;

        const boothId = pickBoothId_(r);
        renderCards_(list, listTitle, rows, boothId);
      },
    },
  });

  requestAnimationFrame(() => focusChart?.resize?.());
}
