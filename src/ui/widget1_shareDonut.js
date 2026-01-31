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
