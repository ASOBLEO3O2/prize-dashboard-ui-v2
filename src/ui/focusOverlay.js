// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";

/**
 * Widget②：原価率 分布（ヒストグラム）
 *
 * 役割分担（あなたの方針Aに沿う）
 * - 拡大前（mid）：このファイルは「器（canvas + select）」だけ作る
 *   └ 実描画は src/ui/charts.js（renderCharts）が担当
 *
 * - 拡大後（focus）：このファイルが「Chart生成 + 棒クリックでカード表示」まで担当
 *   └ 並び替え（ブースID自然順 / 売上 / 原価率）もここ
 */

// ===== bins（自然レンジ）=====
const COST_BINS = [
  { label: "0–10%" },
  { label: "11–25%" },
  { label: "26–32%" },
  { label: "33–40%" },
  { label: "40%〜" },
];

function pickCostBinIndex_(rate01) {
  const r = Number(rate01);
  if (!Number.isFinite(r) || r < 0) return -1;

  if (r <= 0.10) return 0;
  if (r <= 0.25) return 1;
  if (r <= 0.32) return 2;
  if (r < 0.40) return 3;
  return 4;
}
function inBin_(rate01, idx) {
  const r = Number(rate01);
  if (!Number.isFinite(r) || r < 0) return false;

  if (idx === 0) return r <= 0.10;
  if (idx === 1) return r > 0.10 && r <= 0.25;
  if (idx === 2) return r > 0.25 && r <= 0.32;
  if (idx === 3) return r > 0.32 && r < 0.40;
  if (idx === 4) return r >= 0.40;
  return false;
}

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

function fmtYen(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("ja-JP").format(Math.round(n));
}
function fmtPct01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function computeHistogram_(rows, mode) {
  const arr = COST_BINS.map(() => 0);
  for (const r of rows) {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    const sales = toNum(r?.sales ?? r?.総売上) ?? 0;
    if (rate == null) continue;

    const idx = pickCostBinIndex_(rate);
    if (idx < 0) continue;

    arr[idx] += mode === "sales" ? sales : 1;
  }
  return arr;
}

function rowsInBin_(rows, idx) {
  return rows.filter((r) => {
    const rate = toNum(r?.cost_rate ?? r?.原価率);
    return rate != null && inBin_(rate, idx);
  });
}

function pickPrizeName_(r) {
  if (!r) return "";

  const direct =
    r.prize_name ??
    r.prizeName ??
    r.prize ??
    r.item_name ??
    r.itemName ??
    r.name ??
    r.title ??
    r.景品名 ??
    r["景品名"] ??
    r.景品 ??
    r["景品"] ??
    "";

  const s1 = String(direct || "").trim();
  if (s1) return s1;

  // 取りこぼし救済
  const norm = (k) =>
    String(k || "")
      .trim()
      .toLowerCase()
      .replace(/[ \t\r\n\u3000]/g, "")
      .replace(/[・_\-]/g, "");

  const want = new Set([
    "景品名",
    "景品",
    "prizename",
    "prize",
    "itemname",
    "item",
    "name",
    "title",
  ]);

  for (const [k, v] of Object.entries(r)) {
    if (!want.has(norm(k))) continue;
    const sv = String(v || "").trim();
    if (sv) return sv;
  }
  return "";
}

function pickBoothId_(r) {
  return (
    r?.booth_id ??
    r?.["ブースID"] ??
    r?.boothId ??
    r?.["boothId"] ??
    r?.machine_key ??
    r?.machine_name ??
    r?.machine_ref ??
    r?.対応マシン名 ??
    r?.["対応マシン名"] ??
    ""
  );
}

function pickMachineName_(r) {
  return (
    r?.machine_name ??
    r?.machine_ref ??
    r?.対応マシン名 ??
    r?.["対応マシン名"] ??
    ""
  );
}

// ブースID自然順用（数字を数値として比較）
const BOOTH_COLLATOR = new Intl.Collator("ja-JP", {
  numeric: true,
  sensitivity: "base",
});

// ===== mid（拡大前）：器だけ =====
export function buildWidget2CostHistTools(actions, opts = {}) {
  const id = String(opts.modeSelectId || "costHistMode").trim() || "costHistMode";
  const sel = el("select", { class: "select", id }, [
    el("option", { value: "count", text: "台数" }),
    el("option", { value: "sales", text: "売上" }),
  ]);

  // mode変更時は charts.js が参照するので、軽く再描画を促す
  if (!sel.__bound) {
    sel.addEventListener("change", () => {
      actions?.requestRender?.();
    });
    sel.__bound = true;
  }

  return el("div", { class: "chartTools" }, [sel]);
}

export function renderWidget2CostHist(body, actions) {
  if (!body) return;

  // 同一type中は canvas を生かす（chart崩れ防止）
  if (!body.__w2_built) {
    clear(body);
    body.classList.add("chartBody");

    const canvas = el("canvas", { id: "costHistChart" });
    body.appendChild(canvas);

    // bodyクリックで拡大
    body.addEventListener("click", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "select" || tag === "option" || tag === "button") return;
      actions?.onOpenFocus?.("costHist");
    });

    body.__w2_built = true;
  }
}

// ===== focus（拡大後）：Chart + 棒クリック→カード =====
let focusCostHistChart = null;

export function renderWidget2CostHistFocus(mount, state, actions) {
  if (!mount) return;

  const Chart = window.Chart;
  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];

  clear(mount);

  if (!Chart) {
    mount.appendChild(el("div", { class: "focusPlaceholder", text: "Chart.js が未ロードです" }));
    return;
  }

  // --- UI ---
  const topBar = el("div", { class: "focusNav" }, []);

  const modeSel = el("select", { class: "select", id: "w2FocusCostHistMode" }, [
    el("option", { value: "count", text: "台数" }),
    el("option", { value: "sales", text: "売上" }),
  ]);

  // ✅ 並び替え：ブースID自然順 / 売上 / 原価率
  const sortKeySel = el("select", { class: "select", id: "w2FocusSortKey" }, [
    el("option", { value: "booth", text: "ブースID（自然順）" }),
    el("option", { value: "sales", text: "売上" }),
    el("option", { value: "rate", text: "原価率" }),
  ]);

  const sortDirSel = el("select", { class: "select", id: "w2FocusSortDir" }, [
    el("option", { value: "asc", text: "昇順" }),
    el("option", { value: "desc", text: "降順" }),
  ]);

  // 初期：ブース自然順（昇順）
  sortKeySel.value = "booth";
  sortDirSel.value = "asc";

  const hint = el("div", { class: "focusHint", text: "棒をクリックすると該当アイテムを表示します" });

  topBar.appendChild(el("div", { class: "focusCrumb", text: "原価率 分布（拡大）" }));
  topBar.appendChild(
    el("div", { style: "display:flex; gap:10px; align-items:center; flex-wrap:wrap;" }, [
      modeSel,
      sortKeySel,
      sortDirSel,
      hint,
    ])
  );

  const panel = el("div", { class: "focusPanel" }, [
    el("div", { class: "focusPanelTop" }, [
      el("div", { class: "focusPanelTitle", text: "原価率 分布" }),
      el("div", { class: "focusPanelNote", text: "棒クリックでアイテム一覧（拡大後のみ）" }),
    ]),
    topBar,
  ]);

  const chartWrap = el("div", { class: "focusDonutWrap" });
  chartWrap.style.height = "360px";
  chartWrap.style.minHeight = "360px";

  const canvas = el("canvas", { id: "w2FocusCostHistChart" });
  chartWrap.appendChild(canvas);

  const listTitle = el("div", { class: "focusCrumb", text: "選択中：—" });
  const list = el("div", { class: "focusLegend" });

  // ✅ 確実にスクロールさせる（CSS依存を断つ）
  list.style.overflow = "auto";
  list.style.maxHeight = "360px";
  list.style.minHeight = "360px";

  const grid = el("div", { class: "focusDonutGrid" }, [
    el("div", { style: "min-width:0;" }, [chartWrap]),
    el("div", { style: "min-width:0; display:flex; flex-direction:column; gap:10px;" }, [
      listTitle,
      list,
    ]),
  ]);

  panel.appendChild(grid);
  mount.appendChild(panel);

  // --- sorting ---
  let lastBinIndex = null;

  function sortPicked_(arr) {
    const key = sortKeySel.value || "booth";
    const dir = sortDirSel.value || "asc";
    const sign = dir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      if (key === "booth") {
        const aa = String(pickBoothId_(a) || "");
        const bb = String(pickBoothId_(b) || "");
        const c = BOOTH_COLLATOR.compare(aa, bb);
        return c * sign;
      }
      if (key === "rate") {
        const ra = toNum(a?.cost_rate ?? a?.原価率);
        const rb = toNum(b?.cost_rate ?? b?.原価率);
        const na = ra == null ? (dir === "asc" ? Infinity : -Infinity) : ra;
        const nb = rb == null ? (dir === "asc" ? Infinity : -Infinity) : rb;
        return (na - nb) * sign;
      }
      // sales
      const sa = toNum(a?.sales ?? a?.総売上);
      const sb = toNum(b?.sales ?? b?.総売上);
      const na = sa == null ? (dir === "asc" ? Infinity : -Infinity) : sa;
      const nb = sb == null ? (dir === "asc" ? Infinity : -Infinity) : sb;
      return (na - nb) * sign;
    });
  }

  function renderList(idx) {
    lastBinIndex = idx;

    const bin = COST_BINS[idx];
    if (!bin) return;

    const picked = rowsInBin_(rows, idx);

    // ✅ 並び替え（ブース自然順 / 売上 / 原価率）
    sortPicked_(picked);

    listTitle.textContent = `選択中：${bin.label}（${picked.length}件）`;

    clear(list);
    if (picked.length === 0) {
      list.appendChild(el("div", { class: "focusPlaceholder", text: "該当アイテムがありません" }));
      return;
    }

    const MAX = 80;
    const shown = picked.slice(0, MAX);

    shown.forEach((r) => {
      const prize = pickPrizeName_(r) || "（景品名なし）";
      const booth = pickBoothId_(r) || "（ブースIDなし）";
      const machine = pickMachineName_(r) || "";
      const sales = toNum(r?.sales ?? r?.総売上) ?? 0;
      const rate = toNum(r?.cost_rate ?? r?.原価率);

      list.appendChild(
        el("div", { class: "focusLegendItem", style: "display:block; text-align:left;" }, [
          el("div", { style: "font-weight:900; margin-bottom:4px;", text: prize }),
          el("div", { style: "opacity:.95; margin-bottom:4px;", text: booth }),
          machine
            ? el("div", { style: "opacity:.85; margin-bottom:4px;", text: machine })
            : el("div", { style: "display:none;" }),
          el("div", { style: "display:flex; gap:12px; flex-wrap:wrap; opacity:.95;" }, [
            el("span", { text: `売上: ${fmtYen(sales)}円` }),
            el("span", { text: `原価率: ${rate == null ? "—" : fmtPct01(rate)}` }),
          ]),
        ])
      );
    });

    if (picked.length > MAX) {
      list.appendChild(
        el("div", { class: "focusHint", text: `※表示は上位${MAX}件まで（全${picked.length}件）` })
      );
    }
  }

  function applyChart() {
    const mode = modeSel.value || "count";
    const hist = computeHistogram_(rows, mode);

    // 既存破棄（開き直し以外でも安全に）
    if (focusCostHistChart && typeof focusCostHistChart.destroy === "function") {
      try {
        focusCostHistChart.destroy();
      } catch (e) {}
    }
    focusCostHistChart = null;

    const ctx = canvas.getContext("2d");
    focusCostHistChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: COST_BINS.map((b) => b.label),
        datasets: [{ label: mode === "sales" ? "売上" : "台数", data: hist }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true },
        },
        onClick: (evt) => {
          if (!focusCostHistChart) return;
          const pts = focusCostHistChart.getElementsAtEventForMode(
            evt,
            "nearest",
            { intersect: true },
            true
          );
          if (!pts || pts.length === 0) return;
          const idx = pts[0].index;
          renderList(idx);
        },
      },
    });

    requestAnimationFrame(() => focusCostHistChart?.resize?.());

    // 未選択状態
    listTitle.textContent = "選択中：—";
    clear(list);
    list.appendChild(el("div", { class: "focusHint", text: "棒をクリックすると一覧が出ます" }));
    lastBinIndex = null;
  }

  function refreshListIfAny() {
    if (lastBinIndex == null) return;
    renderList(lastBinIndex);
  }

  modeSel.addEventListener("change", applyChart);
  sortKeySel.addEventListener("change", refreshListIfAny);
  sortDirSel.addEventListener("change", refreshListIfAny);

  applyChart();
}
