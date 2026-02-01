// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";

/**
 * Widget①: {軸}別 売上 / マシン構成比（2重ドーナツ）
 * - 外側リング：売上構成比（Σ総売上）
 * - 内側リング：マシン構成比（distinct(ブースID)）
 * - 右：ABC（売上の累積比で A/B/C）
 *
 * 重要：
 * - 台数は「1ステーション＝ブースID」で固定（ユーザー確定）
 * - 軸が変わってもロジックは同じ（破綻防止）
 */
export function renderWidget1ShareDonut(mount, state, actions, opt = {}) {
  const mode = opt.mode ?? "normal"; // "normal" | "focus"（今はnormalだけでもOK）

  // ---- 参照する行（フィルタ後の“実データ”が入っている配列を優先） ----
  const rows =
    (Array.isArray(state.filteredRows) ? state.filteredRows : null) ||
    (Array.isArray(state.rows) ? state.rows : null) ||
    (Array.isArray(state.dataRows) ? state.dataRows : null) ||
    [];

  // ---- 軸：デフォは「景品ジャンル」（ユーザー確定） ----
  // 既存stateに軸があれば尊重。無ければ mount に保持して継続。
  const defaultAxis = "景品ジャンル";
  const axisKey =
    state.widget1Axis ||
    state.midWidget1Axis ||
    mount.__w1_axis ||
    defaultAxis;

  // ---- 初回だけDOMを作る（以降は更新だけ） ----
  if (!mount.__w1_root) {
    clear(mount);

    const root = el("div", { class: "widget1" });

    // header
    const titleEl = el("div", { class: "widget1Title", text: "" });

    const headerLeft = el("div", { class: "widget1HeaderLeft" }, [titleEl]);

    const btnExpand = el("button", {
      class: "btn ghost midPanelBtn",
      text: "拡大",
      onClick: (e) => {
        e.preventDefault();
        actions.onOpenFocus?.("widget1"); // 既存に合わせて必要なら変更
      },
    });

    const sel = el("select", {
      class: "widget1Select",
      onChange: (e) => {
        const v = String(e.target.value || "").trim();
        mount.__w1_axis = v || defaultAxis;

        // もし state に保存するアクションがあるなら呼ぶ（無ければDOM保持だけで動く）
        actions.onSetWidget1Axis?.(mount.__w1_axis);
        actions.onPickWidget1Axis?.(mount.__w1_axis);

        // 再描画
        renderWidget1ShareDonut(mount, state, actions, opt);
      },
    });

    const selWrap = el("div", { class: "widget1SelectWrap" }, [sel]);

    const headerRight = el("div", { class: "widget1HeaderRight" }, [
      btnExpand,
      selWrap,
    ]);

    const header = el("div", { class: "widget1Header" }, [headerLeft, headerRight]);

    // body
    const chartWrap = el("div", { class: "widget1ChartWrap" }, [
      el("canvas", { class: "w1Canvas" }),
    ]);

    const abc = el("div", { class: "widget1ABC" });

    const body = el("div", { class: "widget1Body" }, [
      el("div", { class: "widget1ChartWrap" }, [chartWrap.firstChild]),
      abc,
    ]);

    root.appendChild(header);
    root.appendChild(body);
    mount.appendChild(root);

    mount.__w1_root = root;
    mount.__w1_title = titleEl;
    mount.__w1_select = sel;
    mount.__w1_canvas = root.querySelector("canvas.w1Canvas");
    mount.__w1_abc = abc;
  }

  // ---- 軸候補（現状は“選べる”前提。state側に候補があるならそれを使う） ----
  const axisOptions =
    (Array.isArray(state.widget1AxisOptions) && state.widget1AxisOptions.length
      ? state.widget1AxisOptions
      : ["景品ジャンル", "料金", "投入法", "性別", "年代"]);

  // select options 更新（初回だけじゃなく毎回整合させる）
  syncSelect_(mount.__w1_select, axisOptions, axisKey, defaultAxis);

  // タイトル（要望③）
  mount.__w1_title.textContent = `${axisKey}別 売上 / マシン構成比`;

  // ---- 集計（要望④：軸が変わっても壊れない） ----
  const vm = buildVM_(rows, axisKey);

  // ---- 色（要望②⑥：グラフと凡例で完全共通） ----
  const labels = vm.items.map((x) => x.label);
  const colors = buildPalette_(labels);

  // ---- ドーナツ描画（2重：外=売上, 内=台数） ----
  drawDoubleDonut_(mount.__w1_canvas, {
    outer: vm.items.map((x) => x.salesShare),
    inner: vm.items.map((x) => x.machineShare),
    colors,
  });

  // ---- 凡例（ABC）：swatch / rank / name / value（CSS差し替え前提） ----
  renderABC_(mount.__w1_abc, vm, colors);
}

/* =========================
   集計（破綻しない仕様）
   - 売上：Σ総売上
   - 台数：distinct(ブースID)
   ========================= */

function buildVM_(rows, axisKey) {
  const boothKey = "ブースID";
  const salesKey = "総売上";

  const safe = (v) => (v == null ? "" : String(v)).trim();
  const toNum = (v) => {
    const n = Number(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const allBooths = new Set();
  const map = new Map(); // label -> { salesSum, booths:Set }

  let salesTotal = 0;

  for (const r of rows) {
    const booth = safe(r[boothKey]);
    if (booth) allBooths.add(booth);

    const rawKey = safe(r[axisKey]);
    const k = rawKey ? rawKey : "未分類";

    const s = toNum(r[salesKey]);
    salesTotal += s;

    if (!map.has(k)) map.set(k, { salesSum: 0, booths: new Set() });
    const g = map.get(k);
    g.salesSum += s;
    if (booth) g.booths.add(booth);
  }

  const machineTotal = allBooths.size;

  let items = Array.from(map.entries()).map(([label, g]) => {
    const salesYen = g.salesSum;
    const machineCount = g.booths.size;
    return {
      label,
      salesYen,
      machineCount,
      salesShare: salesTotal > 0 ? salesYen / salesTotal : 0,
      machineShare: machineTotal > 0 ? machineCount / machineTotal : 0,
    };
  });

  // 売上降順
  items.sort((a, b) => b.salesYen - a.salesYen);

  // デフォは上位5 + その他はまだ無し（必要なら後で）
  const topN = 5;
  if (items.length > topN) items = items.slice(0, topN);

  // ABCランク（売上累積比：A=70%まで / B=次20% / C=残り）
  let cum = 0;
  for (const it of items) {
    cum += it.salesShare;
    it.rank = cum <= 0.7 ? "A" : (cum <= 0.9 ? "B" : "C");
  }

  return {
    items,
    meta: {
      axisKey,
      salesTotal,
      machineTotal,
      onlyUnclassified: items.length === 1 && items[0].label === "未分類" && (salesTotal > 0 || machineTotal > 0),
    },
  };
}

/* =========================
   凡例（ABC）
   ========================= */

function renderABC_(mount, vm, colors) {
  clear(mount);

  // （任意）未分類のみ警告をここに出すなら出せる（今は静かに）
  // if (vm.meta.onlyUnclassified) { ... }

  vm.items.forEach((x, i) => {
    const row = el("div", { class: `widget1ABCRow rank-${x.rank}` });

    // swatch（要望⑥：グラフと同一色）
    const sw = el("span", { class: "swatch" });
    sw.style.background = colors[i];

    const rank = el("span", { class: "rank", text: x.rank });

    const name = el("span", { class: "name", text: x.label });

    const valueText =
      `${fmtYen(x.salesYen)}  ` +
      `(${x.machineCount}/${vm.meta.machineTotal}=${fmtPct(x.machineShare, 1)})`;

    const value = el("span", { class: "value", text: valueText });

    row.appendChild(sw);
    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(value);

    mount.appendChild(row);
  });
}

/* =========================
   select同期
   ========================= */

function syncSelect_(sel, options, current, fallback) {
  const cur = current || fallback;

  // options を作り直す（数が少ないので毎回でOK）
  clear(sel);
  for (const opt of options) {
    sel.appendChild(el("option", { value: opt, text: opt }));
  }

  // 値が候補にないなら fallback
  if (!options.includes(cur)) {
    sel.value = fallback;
  } else {
    sel.value = cur;
  }
}

/* =========================
   見分けやすい配色（要望②）
   - 未分類はグレー固定
   ========================= */

function buildPalette_(labels) {
  const n = Math.max(1, labels.length);
  const out = [];

  for (let i = 0; i < n; i++) {
    const label = labels[i];

    if (label === "未分類") {
      out.push("rgba(148,163,184,0.95)"); // グレー固定
      continue;
    }

    // 色相を分散して識別性を上げる（ダーク背景前提）
    const hue = Math.round((360 * i) / n);
    out.push(`hsl(${hue} 85% 55%)`);
  }

  return out;
}

/* =========================
   Canvas: 2重ドーナツ描画
   - outer: 売上構成比
   - inner: マシン構成比
   ========================= */

function drawDoubleDonut_(canvas, { outer, inner, colors }) {
  if (!canvas) return;

  // CSSフィット前提なので、実pixelを合わせる
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.42;
  const outerW = R * 0.22;
  const innerW = R * 0.18;

  // 背景リング（薄く）
  drawRing_(ctx, cx, cy, R, outerW, "rgba(148,163,184,0.12)");
  drawRing_(ctx, cx, cy, R - outerW - 10 * (window.devicePixelRatio || 1), innerW, "rgba(148,163,184,0.08)");

  // 外側：売上
  drawSegments_(ctx, cx, cy, R, outerW, outer, colors);

  // 内側：台数
  const innerR = R - outerW - 10 * (window.devicePixelRatio || 1);
  drawSegments_(ctx, cx, cy, innerR, innerW, inner, colors);
}

function drawRing_(ctx, cx, cy, r, w, stroke) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = w;
  ctx.lineCap = "butt";
  ctx.stroke();
}

function drawSegments_(ctx, cx, cy, r, w, shares, colors) {
  let a = -Math.PI / 2;
  for (let i = 0; i < shares.length; i++) {
    const p = Number(shares[i]) || 0;
    const da = p * Math.PI * 2;
    if (da <= 0) continue;

    ctx.beginPath();
    ctx.arc(cx, cy, r, a, a + da);
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = w;
    ctx.lineCap = "butt";
    ctx.stroke();

    a += da;
  }
}
