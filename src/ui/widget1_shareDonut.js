// src/ui/widget1_shareDonut.js
// ウィジェット①：売上構成比（外）＋ブース構成比（内）2重ドーナツ
// - 左：ドーナツ、右：一覧
// - 全体表示：親レベルのみ、右は親マスタ順で全件
// - 拡大表示：親→子ドリル可、子でも2重ドーナツ維持、右は売上順TopN+その他
// - クリック：全体フィルタに追加（同一軸内OR想定）
//
// 依存：../utils/dom.js の el を使用（あなたの既存構成）
// ---------------------------------------------------------

import { el } from "../utils/dom.js";

/** ====== 列名マッピング（ここだけあなたのデータに合わせて編集） ====== */
const COLS = {
  sales: "総売上",         // 売上
  boothId: "ブースID",     // ブース数（ユニーク）

  // 階層：投入法
  methodParent: "投入法",  // 親：3本爪/2本爪
  methodChild: "記号",      // 子：各記号（3本爪/2本爪で辞書が違う想定でもOK。列は同じでOK）

  // 階層：景品ジャンル
  genreParent: "景品ジャンル",     // 親：食品/ぬいぐるみ/雑貨
  genreChild: "ジャンル下層",       // 子：各下層（例：食品下層/ぬいぐるみ下層/雑貨下層…をこの列にまとめている想定）

  // 階層：キャラ（親：キャラ/ノンキャラ）
  charName: "キャラ",      // 子：キャラ名（空ならノンキャラ扱い）
  // もし専用列があるなら使ってOK：charParent: "キャラ区分"（キャラ/ノンキャラ）
  charParent: null,

  // フラット：ターゲット/年代
  target: "ターゲット",
  age: "年代",

  // YES/NO（2値）
  movie: "映画",           // YES/NO
  reserve: "予約",         // YES/NO
  wlOriginal: "WLオリジナル" // YES/NO
};

/** ====== 親マスタの「定義順」 ====== */
const MASTER_PARENT_ORDER = {
  method: ["3本爪", "2本爪"],
  genre: ["食品", "ぬいぐるみ", "雑貨"],
  char: ["キャラ", "ノンキャラ"],
  yesno: ["YES", "NO"] // 2値は固定
};

/** ====== 軸定義（あなたが指定した10軸） ====== */
const AXES = [
  // ①料金（ここではフラット例：料金帯 列があるなら入れてください）
  // { id:"fee", label:"料金", type:"flat", key:"料金帯", parentOrder:null },

  // ②プレイ回数（ここではフラット例：回数帯 列があるなら入れてください）
  // { id:"plays", label:"プレイ回数", type:"flat", key:"回数帯", parentOrder:null },

  { id:"method", label:"投入法", type:"hier",
    parentKey: COLS.methodParent,
    childKey: COLS.methodChild,
    parentOrder: MASTER_PARENT_ORDER.method
  },
  { id:"genre", label:"景品ジャンル", type:"hier",
    parentKey: COLS.genreParent,
    childKey: COLS.genreChild,
    parentOrder: MASTER_PARENT_ORDER.genre
  },
  { id:"target", label:"ターゲット", type:"flat",
    key: COLS.target,
    parentOrder: null
  },
  { id:"age", label:"年代", type:"flat",
    key: COLS.age,
    parentOrder: null
  },
  { id:"char", label:"キャラ", type:"hier_custom",
    // 親：キャラ/ノンキャラ、子：キャラ名
    parentOrder: MASTER_PARENT_ORDER.char
  },
  { id:"movie", label:"映画", type:"yesno", key: COLS.movie, parentOrder: MASTER_PARENT_ORDER.yesno },
  { id:"reserve", label:"予約", type:"yesno", key: COLS.reserve, parentOrder: MASTER_PARENT_ORDER.yesno },
  { id:"wl", label:"WLオリジナル", type:"yesno", key: COLS.wlOriginal, parentOrder: MASTER_PARENT_ORDER.yesno },
];

/** ====== 公開API ======
 * mountWidget1ShareDonut(root, opts)
 *  opts:
 *   - getRows(): 現在のフィルタ後 rows を返す（配列）
 *   - onFilterAdd(filterObj): クリックでフィルタに追加（あなた側でOR/AND運用）
 *   - onFilterRemove(filterObj): クリックで解除（任意）
 *   - getFilterState(): 現在の選択状態を返す（任意）…ハイライト用
 *   - title?: 表示名
 *   - defaultAxisId?: 初期軸
 */
export function mountWidget1ShareDonut(root, opts) {
  const state = {
    axisId: opts.defaultAxisId || "method",
    level: "parent",        // "parent" | "child"
    parentValue: null,      // child時のみ
    expanded: false,
    topN: 10
  };

  const card = el("div", { class: "w1 card" });

  // Header (dropdown inside the window)
  const axisSelect = el("select", { class: "w1-axis" });
  AXES.forEach(a => axisSelect.appendChild(el("option", { value: a.id, text: a.label })));
  axisSelect.value = state.axisId;

  const btnExpand = el("button", { class: "w1-btn ghost", text: "拡大" });

  const header = el("div", { class: "w1-head" }, [
    el("div", { class: "w1-headLeft" }, [
      el("div", { class: "w1-title", text: opts.title || "売上構成比（外）/ ブース構成比（内）" }),
    ]),
    el("div", { class: "w1-headRight" }, [
      axisSelect,
      btnExpand
    ])
  ]);

  const left = el("div", { class: "w1-left" });
  const right = el("div", { class: "w1-right" });
  const body = el("div", { class: "w1-body" }, [left, right]);

  card.appendChild(header);
  card.appendChild(body);
  root.appendChild(card);

  // modal (expanded)
  const modal = el("div", { class: "w1-modal hidden" });
  const modalInner = el("div", { class: "w1-modalInner card" });
  modal.appendChild(modalInner);
  document.body.appendChild(modal);

  // Expanded header
  const axisSelect2 = el("select", { class: "w1-axis" });
  AXES.forEach(a => axisSelect2.appendChild(el("option", { value: a.id, text: a.label })));
  axisSelect2.value = state.axisId;

  const btnBackParent = el("button", { class: "w1-btn ghost hidden", text: "← 親に戻る" });
  const topNSelect = el("select", { class: "w1-topn" }, [
    el("option", { value: "10", text: "Top10" }),
    el("option", { value: "15", text: "Top15" }),
    el("option", { value: "999999", text: "All" }),
  ]);
  topNSelect.value = String(state.topN);

  const btnClose = el("button", { class: "w1-btn primary", text: "閉じる" });

  const modalHead = el("div", { class: "w1-head" }, [
    el("div", { class: "w1-headLeft" }, [
      el("div", { class: "w1-title", text: "売上構成比（外）/ ブース構成比（内）" }),
    ]),
    el("div", { class: "w1-headRight" }, [
      axisSelect2,
      btnBackParent,
      topNSelect,
      btnClose
    ])
  ]);

  const modalLeft = el("div", { class: "w1-left" });
  const modalRight = el("div", { class: "w1-right" });
  const modalBody = el("div", { class: "w1-body expanded" }, [modalLeft, modalRight]);

  modalInner.appendChild(modalHead);
  modalInner.appendChild(modalBody);

  /** ====== Events ====== */
  axisSelect.onchange = () => {
    state.axisId = axisSelect.value;
    axisSelect2.value = state.axisId;
    // 全体表示は常に親
    state.level = "parent";
    state.parentValue = null;
    renderAll();
  };
  axisSelect2.onchange = () => {
    state.axisId = axisSelect2.value;
    axisSelect.value = state.axisId;
    // 拡大表示は親に戻す
    state.level = "parent";
    state.parentValue = null;
    renderAll();
  };

  btnExpand.onclick = () => {
    state.expanded = true;
    modal.classList.remove("hidden");
    renderAll();
  };

  btnClose.onclick = () => {
    state.expanded = false;
    modal.classList.add("hidden");
    // 全体表示は親に固定
    state.level = "parent";
    state.parentValue = null;
    renderAll();
  };

  modal.onclick = (e) => {
    // 背景クリックで閉じる
    if (e.target === modal) btnClose.onclick();
  };

  btnBackParent.onclick = () => {
    state.level = "parent";
    state.parentValue = null;
    renderAll();
  };

  topNSelect.onchange = () => {
    state.topN = Number(topNSelect.value);
    renderAll();
  };

  /** ====== Render ====== */
  function renderAll() {
    // 全体表示：親のみ
    const rows = safeRows(opts.getRows?.() || []);
    const axis = AXES.find(a => a.id === state.axisId) || AXES[0];

    // --- Normal (parent only) ---
    const parentAgg = aggregate(rows, axis, "parent", null);
    renderPanel(left, right, axis, "parent", null, parentAgg, {
      mode: "normal",
      showBoothInList: false,
      listOrder: "master",
      enableDrill: false // 全体は親固定
    });

    // --- Expanded (parent or child) ---
    if (state.expanded) {
      const lvl = state.level;
      const pv = state.parentValue;
      const agg = aggregate(rows, axis, lvl, pv);

      btnBackParent.classList.toggle("hidden", !(axisHasChild(axis) && lvl === "child"));
      topNSelect.classList.toggle("hidden", !(lvl === "child")); // 子のときだけTopN切替見せる（仕様）
      renderPanel(modalLeft, modalRight, axis, lvl, pv, agg, {
        mode: "expanded",
        showBoothInList: true,
        listOrder: (lvl === "child") ? "salesDesc" : "master",
        enableDrill: axisHasChild(axis)
      });
    }
  }

  // 初回
  renderAll();

  /** ====== クリックでフィルタ反映 ====== */
  function handleClick(axis, level, parentValue, value) {
    // 親表示でクリック：拡大時のみドリル可能
    if (state.expanded && axisHasChild(axis) && level === "parent" && shouldDrillOnParent(axis)) {
      state.level = "child";
      state.parentValue = value;
      renderAll();
      return;
    }

    // フィルタ追加/解除（外部へ委譲）
    const f = buildFilter(axis, level, parentValue, value);
    const selected = isSelected(opts.getFilterState?.(), f);

    if (selected && opts.onFilterRemove) opts.onFilterRemove(f);
    else if (!selected && opts.onFilterAdd) opts.onFilterAdd(f);
  }

  /** 子に入れる軸は（投入法/景品ジャンル/キャラ）だけ想定 */
  function shouldDrillOnParent(axis) {
    return axis.type === "hier" || axis.type === "hier_custom";
  }

  /** ====== UI描画 ====== */
  function renderPanel(leftRoot, rightRoot, axis, level, parentValue, agg, ui) {
    leftRoot.innerHTML = "";
    rightRoot.innerHTML = "";

    if (!agg || agg.totalSales <= 0 || agg.totalBooths <= 0) {
      leftRoot.appendChild(el("div", { class: "w1-empty", text: "該当データなし" }));
      rightRoot.appendChild(el("div", { class: "w1-empty", text: "—" }));
      return;
    }

    // left: donut svg
    const donut = renderDoubleDonutSVG({
      items: agg.items,
      totalSales: agg.totalSales,
      totalBooths: agg.totalBooths,
      axis,
      level,
      parentValue,
      mode: ui.mode
    }, (value) => handleClick(axis, level, parentValue, value));
    leftRoot.appendChild(donut);

    // center text overlay
    const center = el("div", { class: "w1-center" });
    if (ui.mode === "expanded" && level === "child" && parentValue != null) {
      center.appendChild(el("div", { class: "w1-centerLine top", text: `${axis.label}：${parentValue}` }));
    }
    center.appendChild(el("div", { class: "w1-centerLine", text: `売上合計 ${fmtYen(agg.totalSales)}` }));
    center.appendChild(el("div", { class: "w1-centerLine", text: `ブース数 ${agg.totalBooths}` }));
    leftRoot.appendChild(center);

    // right: list
    const list = el("div", { class: "w1-list" });

    // 表示対象のitems（全体：親マスタ全件 / 拡大親：親マスタ全件 / 拡大子：TopN+その他）
    const displayItems = (ui.listOrder === "salesDesc")
      ? applyTopNAndOther(agg.items, ui.mode === "expanded" ? state.topN : 10)
      : agg.items;

    displayItems.forEach((it, idx) => {
      const row = el("button", { class: "w1-row", title: it.label });
      row.onclick = () => handleClick(axis, level, parentValue, it.key);

      const chip = el("span", { class: "w1-chip", style: `--c:${it.color}` });
      const name = el("span", { class: "w1-name", text: it.label });

      const v1 = el("span", { class: "w1-v", text: `${fmtYen(it.sales)}  ${fmtPct(it.salesShare)}` });

      row.appendChild(chip);
      row.appendChild(name);
      row.appendChild(v1);

      if (ui.showBoothInList) {
        const v2 = el("span", { class: "w1-v2", text: `${it.booths}B  ${fmtPct(it.boothShare)}` });
        row.appendChild(v2);
      }

      // selected highlight (optional)
      const f = buildFilter(axis, level, parentValue, it.key);
      if (isSelected(opts.getFilterState?.(), f)) row.classList.add("selected");

      list.appendChild(row);
    });

    rightRoot.appendChild(list);

    // （拡大・親表示時）説明ラベル
    if (ui.mode === "expanded" && level === "parent" && axisHasChild(axis)) {
      rightRoot.appendChild(el("div", { class: "w1-note", text: "※ 親カテゴリをクリックすると子階層へドリルダウンします" }));
    }
  }

  /** ====== 集計 ====== */
  function aggregate(rows, axis, level, parentValue) {
    // groupKey作成
    const groups = new Map(); // key -> {key,label,sales,boothSet:Set}
    const boothAll = new Set();
    let totalSales = 0;

    // 親マスタ順の全件表示のために、親レベルなら先に空グループを作る
    if (level === "parent") {
      const order = axis.parentOrder || null;
      if (order && order.length) {
        order.forEach(k => groups.set(k, { key: k, label: k, sales: 0, boothSet: new Set() }));
      }
    }

    for (const r of rows) {
      const sales = toNum(r[COLS.sales]);
      if (sales > 0) totalSales += sales;

      const boothId = safe(r[COLS.boothId]);
      if (boothId) boothAll.add(boothId);

      const { parentKey, childKey } = axisKeyOfRow(axis, r);

      // 親の値
      const p = safe(parentKey);

      // YES/NO正規化
      const pNorm = (axis.type === "yesno") ? normYesNo(p) : (p || "未分類");

      // キャラ軸特殊
      if (axis.type === "hier_custom") {
        const parentVal = deriveCharParent(r);
        const childVal = safe(r[COLS.charName]);
        const useParent = (level === "parent");
        const gKey = useParent ? parentVal : (childVal || "未分類");
        if (level === "child") {
          // childは parentValue（キャラ/ノンキャラ）で絞る
          if (parentValue && parentVal !== parentValue) continue;
        }
        upsertGroup(groups, gKey, gKey, sales, boothId);
        continue;
      }

      // hier/flat/yesno
      if (level === "parent") {
        const gKey = (axis.type === "flat") ? safe(r[axis.key]) : pNorm;
