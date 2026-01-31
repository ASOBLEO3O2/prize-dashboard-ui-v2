// src/ui/widget1ShareDonut.js
import { el } from "../utils/dom.js";

/** ====== あなたの normalizedRows のキーに合わせてここだけ調整 ====== */
const COL = {
  sales: "sales",          // 数値
  boothId: "booth_id",     // 文字列（ユニークブース）
  methodParent: "claw",    // "3本爪"/"2本爪"
  methodChild: "symbol",   // 記号
  genreParent: "genre",    // "食品"/"ぬいぐるみ"/"雑貨"
  genreChild: "genre_sub", // 下層
  target: "target",
  age: "age",
  charName: "character",
  movie: "movie",          // YES/NO
  reserve: "reserve",      // YES/NO
  wl: "wl_original"        // YES/NO
};

const MASTER = {
  method: ["3本爪", "2本爪"],
  genre: ["食品", "ぬいぐるみ", "雑貨"],
  char: ["キャラ", "ノンキャラ"],
  yesno: ["YES", "NO"]
};

const AXES = [
  { id:"method", label:"投入法", type:"hier", parentKey: COL.methodParent, childKey: COL.methodChild, parentOrder: MASTER.method },
  { id:"genre", label:"景品ジャンル", type:"hier", parentKey: COL.genreParent, childKey: COL.genreChild, parentOrder: MASTER.genre },
  { id:"target", label:"ターゲット", type:"flat", key: COL.target },
  { id:"age", label:"年代", type:"flat", key: COL.age },
  { id:"char", label:"キャラ", type:"char" },
  { id:"movie", label:"映画", type:"yesno", key: COL.movie, parentOrder: MASTER.yesno },
  { id:"reserve", label:"予約", type:"yesno", key: COL.reserve, parentOrder: MASTER.yesno },
  { id:"wl", label:"WLオリジナル", type:"yesno", key: COL.wl, parentOrder: MASTER.yesno },
];

export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;

  const mode = opts.mode || "normal"; // "normal" | "expanded"
  const rows = Array.isArray(state.filteredRows) ? state.filteredRows : [];

  // ウィジェット状態（storeに入れずローカルで保持：要求がウィジェット①のみなので簡潔に）
  // ※ページ再描画が多いので mount にぶら下げて保持
  const local = mount.__w1 || (mount.__w1 = {
    axisId: "method",
    level: "parent",      // expanded only
    parentValue: null,    // expanded only
    topN: 10
  });

  // expanded開始時は親に戻す（仕様：全体表示は親固定）
  if (mode === "normal") {
    local.level = "parent";
    local.parentValue = null;
  }

  const axis = AXES.find(a => a.id === local.axisId) || AXES[0];

  mount.innerHTML = "";

  const axisSel = el("select", { class: "w1-axis" });
  AXES.forEach(a => axisSel.appendChild(el("option", { value: a.id, text: a.label })));
  axisSel.value = local.axisId;

  const headRight = [axisSel];

  if (mode === "normal") {
    // 拡大ボタン（既存FocusOverlayを使う）
    const btn = el("button", { class: "w1-btn ghost", text: "拡大", onClick: () => actions.onOpenFocus("shareDonut") });
    headRight.push(btn);
  } else {
    // expanded: 戻る・TopN
    const back = el("button", {
      class: "w1-btn ghost" + ((axisHasChild(axis) && local.level === "child") ? "" : " hidden"),
      text: "← 親に戻る",
      onClick: () => { local.level = "parent"; local.parentValue = null; renderWidget1ShareDonut(mount, state, actions, opts); }
    });

    const topN = el("select", { class: "w1-axis" }, [
      el("option", { value: "10", text: "Top10" }),
      el("option", { value: "15", text: "Top15" }),
      el("option", { value: "999999", text: "All" }),
    ]);
    topN.value = String(local.topN);

    headRight.push(back, topN);

    topN.onchange = () => {
      local.topN = Number(topN.value);
      renderWidget1ShareDonut(mount, state, actions, opts);
    };
  }

  const header = el("div", { class: "w1-head" }, [
    el("div", { class: "w1-title", text: "売上構成比（外）/ ブース構成比（内）" }),
    el("div", { class: "w1-headRight" }, headRight)
  ]);

  const left = el("div", { class: "w1-left" });
  const right = el("div", { class: "w1-right" });
  const body = el("div", { class: "w1-body" + (mode === "expanded" ? " expanded" : "") }, [left, right]);

  mount.appendChild(header);
  mount.appendChild(body);

  axisSel.onchange = () => {
    local.axisId = axisSel.value;
    local.level = "parent";
    local.parentValue = null;
    renderWidget1ShareDonut(mount, state, actions, opts);
  };

  const lvl = (mode === "expanded") ? local.level : "parent";
  const pv = (mode === "expanded") ? local.parentValue : null;

  const agg = aggregate(rows, axis, lvl, pv);

  if (!agg || agg.totalSales <= 0) {
    left.appendChild(el("div", { class: "w1-empty", text: "該当データなし" }));
    return;
  }

  // left: donut
  const donut = renderDoubleDonutSVG({
    items: agg.items,
    totalSales: agg.totalSales,
    totalBooths: agg.totalBooths,
    size: (mode === "expanded") ? 320 : 220,
    expanded: (mode === "expanded"),
  }, (key) => {
    // expanded時：親クリックで子へ
    if (mode === "expanded" && axisHasChild(axis) && local.level === "parent") {
      local.level = "child";
      local.parentValue = key;
      renderWidget1ShareDonut(mount, state, actions, opts);
      return;
    }

    // フィルタ連動（まずは「この軸の値で絞る」だけを外へ）
    // ※あなたの applyFilters の仕様に合わせてここを拡張してOK
    actions.onPickMidParent?.(null); // 既存との衝突を避ける（必要なければ削除OK）
    // TODO: filtersへ追加するアクションがあるならここで呼ぶ
  });

  left.appendChild(donut);

  // center text
  const center = el("div", { class: "w1-center" });
  if (mode === "expanded" && lvl === "child" && pv) {
    center.appendChild(el("div", { class: "w1-centerLine top", text: `${axis.label}：${pv}` }));
  }
  center.appendChild(el("div", { class: "w1-centerLine", text: `売上合計 ${fmtYen(agg.totalSales)}` }));
  center.appendChild(el("div", { class: "w1-centerLine", text: `ブース数 ${agg.totalBooths}` }));
  left.appendChild(center);

  // right list
  const list = el("div", { class: "w1-list" });

  let items = agg.items.slice();

  if (mode === "expanded" && lvl === "child") {
    items = topNAndOther(items, local.topN);
  }

  items.forEach((it, i) => {
    const row = el("button", { class: "w1-row", title: it.label });
    row.onclick = () => {
      if (mode === "expanded" && axisHasChild(axis) && lvl === "parent") {
        local.level = "child";
        local.parentValue = it.key;
        renderWidget1ShareDonut(mount, state, actions, opts);
        return;
      }
      // TODO: フィルタ追加へ（あなたの store.filters 方式に合わせて）
    };

    row.appendChild(el("span", { class: "w1-chip", style: `--c:${it.color}` }));
    row.appendChild(el("span", { class: "w1-name", text: it.label }));
    row.appendChild(el("span", { class: "w1-v", text: `${fmtYen(it.sales)}  ${fmtPct(it.salesShare)}` }));

    if (mode === "expanded") {
      row.appendChild(el("span", { class: "w1-v2", text: `${it.booths}B  ${fmtPct(it.boothShare)}` }));
    }

    list.appendChild(row);
  });

  right.appendChild(list);

  if (mode === "expanded" && lvl === "parent" && axisHasChild(axis)) {
    right.appendChild(el("div", { class: "w1-note", text: "※ 親カテゴリをクリックすると子階層へドリルダウン" }));
  }
}

/* ===== aggregation ===== */

function aggregate(rows, axis, level, parentValue) {
  const groups = new Map();
  const boothAll = new Set();
  let totalSales = 0;

  // 親レベル：マスタ順に全件表示（空でも出す）
  if (level === "parent" && axis.parentOrder?.length) {
    axis.parentOrder.forEach(k => groups.set(k, { key:k, label:k, sales:0, boothSet:new Set() }));
  }

  for (const r of rows) {
    const sales = toNum(r[COL.sales]);
    totalSales += sales;

    const boothId = safe(r[COL.boothId]);
    if (boothId) boothAll.add(boothId);

    let key = null;

    if (axis.type === "flat") {
      key = safe(r[axis.key]) || "未分類";
      upsert(groups, key, sales, boothId);
      continue;
    }

    if (axis.type === "yesno") {
      key = normYesNo(safe(r[axis.key]));
      upsert(groups, key, sales, boothId);
      continue;
    }

    if (axis.type === "char") {
      const parent = safe(r[COL.charName]) ? "キャラ" : "ノンキャラ";
      if (level === "parent") {
        upsert(groups, parent, sales, boothId);
      } else {
        if (parentValue && parent !== parentValue) continue;
        const child = safe(r[COL.charName]) || "未分類";
        upsert(groups, child, sales, boothId);
      }
      continue;
    }

    // hier
    const p = safe(r[axis.parentKey]) || "未分類";
    if (level === "parent") {
      upsert(groups, p, sales, boothId);
    } else {
      if (parentValue && p !== parentValue) continue;
      const c = safe(r[axis.childKey]) || "未分類";
      upsert(groups, c, sales, boothId);
    }
  }

  const totalBooths = boothAll.size;

  let items = Array.from(groups.values()).map((g, i) => ({
    key: g.key,
    label: g.label,
    sales: g.sales,
    booths: g.boothSet.size,
    salesShare: totalSales > 0 ? g.sales / totalSales : 0,
    boothShare: totalBooths > 0 ? g.boothSet.size / totalBooths : 0,
    color: colorByIndex(i),
  }));

  // 親：マスタ順を維持
  if (level === "parent" && axis.parentOrder?.length) {
    const order = axis.parentOrder;
    const map = new Map(items.map(x => [x.key, x]));
    items = order.map(k => map.get(k) || ({
      key:k, label:k, sales:0, booths:0, salesShare:0, boothShare:0, color:"#94a3b8"
    }));
    // マスタ外があれば最後に（本来出ない想定）
    for (const x of map.values()) if (!order.includes(x.key)) items.push(x);
  }

  // 子：売上降順（TopN処理は後段）
  if (level === "child") items.sort((a,b) => b.sales - a.sales);

  return { items, totalSales, totalBooths };
}

function upsert(map, key, sales, boothId) {
  if (!map.has(key)) map.set(key, { key, label:key, sales:0, boothSet:new Set() });
  const g = map.get(key);
  g.sales += toNum(sales);
  if (boothId) g.boothSet.add(boothId);
}

function axisHasChild(axis) {
  return axis.type === "hier" || axis.type === "char";
}

function topNAndOther(items, topN) {
  if (!Number.isFinite(topN) || topN >= 999999) return items.slice();

  const head = items.slice(0, topN);
  const tail = items.slice(topN);

  const otherSales = tail.reduce((s,x)=>s+x.sales,0);
  const otherBooths = tail.reduce((s,x)=>s+x.booths,0);

  const totalSales = items.reduce((s,x)=>s+x.sales,0);
  const totalBooths = items.reduce((s,x)=>s+x.booths,0);

  if (otherSales <= 0 && otherBooths <= 0) return head;

  head.forEach((it,i)=>{
    it.salesShare = totalSales>0 ? it.sales/totalSales : 0;
    it.boothShare = totalBooths>0 ? it.booths/totalBooths : 0;
    it.color = colorByIndex(i);
  });

  head.push({
    key:"__other__",
    label:"その他",
    sales:otherSales,
    booths:otherBooths,
    salesShare: totalSales>0 ? otherSales/totalSales : 0,
    boothShare: totalBooths>0 ? otherBooths/totalBooths : 0,
    color:"#94a3b8",
  });

  return head;
}

/* ===== SVG donut ===== */

function renderDoubleDonutSVG(model, onPick) {
  const size = model.size;
  const cx = size/2, cy = size/2;
  const outerR = model.expanded ? 150 : 102;
  const outerW = model.expanded ? 34 : 26;
  const innerR = outerR - outerW - 10;
  const innerW = model.expanded ? 26 : 20;

  const svg = el("svg", { class:"w1-svg", width:size, height:size, viewBox:`0 0 ${size} ${size}` });

  svg.appendChild(ringBase(cx,cy,outerR,outerW));
  svg.appendChild(ringBase(cx,cy,innerR,innerW));

  drawRing(svg, model.items, cx,cy, outerR, outerW, "salesShare", onPick);
  drawRing(svg, model.items, cx,cy, innerR, innerW, "boothShare", onPick);

  return el("div", { class:"w1-donutWrap" }, [svg]);
}

function ringBase(cx,cy,r,w) {
  return el("path", { d: arcPath(cx,cy,r,r-w,0,Math.PI*2), fill:"rgba(148,163,184,.15)" });
}

function drawRing(svg, items, cx,cy, rOuter, w, shareKey, onPick) {
  let angle = -Math.PI/2;
  const eps = 0.00001;

  items.forEach(it=>{
    const share = Math.max(0, it[shareKey]||0);
    if (share<=0) return;

    const span = Math.max(eps, share*Math.PI*2);
    const a0 = angle;
    const a1 = angle + span;

    const path = el("path", {
      d: arcPath(cx,cy,rOuter,rOuter-w,a0,a1),
      fill: it.color,
      class: "w1-seg"
    });

    path.onmouseenter = ()=> {
      path.classList.add("hover");
      path.setAttribute("title",
        `${it.label}\n売上: ${fmtYen(it.sales)} (${fmtPct(it.salesShare)})\nブース: ${it.booths} (${fmtPct(it.boothShare)})`
      );
    };
    path.onmouseleave = ()=> path.classList.remove("hover");
    path.onclick = ()=> onPick(it.key);

    svg.appendChild(path);
    angle = a1;
  });
}

function arcPath(cx,cy,r1,r0,a0,a1) {
  const large = (a1-a0)>Math.PI ? 1 : 0;

  const x0 = cx + r1*Math.cos(a0);
  const y0 = cy + r1*Math.sin(a0);
  const x1 = cx + r1*Math.cos(a1);
  const y1 = cy + r1*Math.sin(a1);

  const x2 = cx + r0*Math.cos(a1);
  const y2 = cy + r0*Math.sin(a1);
  const x3 = cx + r0*Math.cos(a0);
  const y3 = cy + r0*Math.sin(a0);

  return [
    `M ${x0} ${y0}`,
    `A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3}`,
    "Z"
  ].join(" ");
}

/* ===== helpers ===== */

function safe(v){ return (v==null) ? "" : String(v).trim(); }
function toNum(v){
  const n = Number(String(v??"").replace(/,/g,""));
  return Number.isFinite(n) ? n : 0;
}
function normYesNo(v){
  const s = safe(v).toUpperCase();
  if (["Y","YES","TRUE","1","〇","○"].includes(s)) return "YES";
  if (["N","NO","FALSE","0","×","✕"].includes(s)) return "NO";
  return s || "NO";
}
function fmtYen(n){
  const v = Math.round(toNum(n));
  return new Intl.NumberFormat("ja-JP").format(v) + "円";
}
function fmtPct(v){
  const x = (Number(v)||0)*100;
  return x.toFixed(1) + "%";
}
function colorByIndex(i){
  const h = (i*47)%360;
  return `hsl(${h} 70% 55%)`;
}
