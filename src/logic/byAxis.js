// src/logic/byAxis.js
// rows（1行=1台）から「中段KPIの軸別カード用データ」を作る

export function buildByAxis(rows) {
  return {
    // フラット軸
    年代: buildFlatAxis(rows, r => r["年代"]),
    マシン: buildFlatAxis(rows, r => r["machine_key"] || r["machine_name"] || r["booth_id"]),

    // 階層軸（カード内展開）
    投入法: buildHierAxis(rows, {
      parent: r => r["投入法"],            // "2本爪" / "3本爪"
      child:  r => pickTounyuuChild(r),   // "3本爪"列 or "2本爪"列
    }),

    ジャンル: buildHierAxis(rows, {
      parent: r => r["景品ジャンル"],      // 食品/ぬいぐるみ/雑貨...
      child:  r => pickGenreChild(r),      // 食品ジャンル/ぬいぐるみジャンル/雑貨ジャンル
    }),

    キャラ: buildHierAxis(rows, {
      parent: r => r["キャラ"],            // ノンキャラ/ポケモン...
      child:  r => pickCharaChild(r),      // キャラジャンル or ノンキャラジャンル
    }),
  };
}

/* =========================
   共通集計
   ========================= */

function buildFlatAxis(rows, getKey) {
  const m = new Map();
  for (const r of rows) {
    const key = safeKey(getKey(r));
    if (!key) continue;
    const a = ensureAgg(m, key, key);
    addRowAgg(a, r);
  }
  return finalizeAggList(Array.from(m.values()));
}

function buildHierAxis(rows, { parent, child }) {
  const parents = new Map();

  for (const r of rows) {
    const pKey = safeKey(parent(r));
    if (!pKey) continue;

    const p = ensureAgg(parents, pKey, pKey);
    addRowAgg(p, r);

    const cLabel = safeKey(child(r));
    if (cLabel) {
      if (!p._children) p._children = new Map();
      const cKey = `${pKey}|${cLabel}`;
      const c = ensureAgg(p._children, cKey, cLabel);
      addRowAgg(c, r);
    }
  }

  return Array.from(parents.values()).map(p => {
    const out = finalizeAggOne(p);
    if (p._children) {
      const children = finalizeAggList(Array.from(p._children.values()));
      if (children.length) out.children = children;
    }
    delete out._children;
    return out;
  });
}

function ensureAgg(map, key, label) {
  if (!map.has(key)) {
    map.set(key, {
      key,
      label,
      machines: 0,
      sales: 0,
      consume: 0,
      _costNum: 0, // consume*1.1 を積む
      _costDen: 0, // sales を積む
    });
  }
  return map.get(key);
}

function addRowAgg(a, r) {
  const sales = Number(r?.sales) || 0;
  const consume = Number(r?.claw) || 0; // あなたのデータでは claw が消化額

  a.machines += 1;
  a.sales += sales;
  a.consume += consume;

  a._costNum += consume * 1.1;
  a._costDen += sales;
}

function finalizeAggOne(a) {
  return {
    key: a.key,
    label: a.label,
    machines: a.machines,
    sales: a.sales,
    consume: a.consume,
    costRate: (a._costDen > 0) ? (a._costNum / a._costDen) : 0,
  };
}

function finalizeAggList(list) {
  return list.map(finalizeAggOne);
}

function safeKey(v) {
  const s = (v == null) ? "" : String(v).trim();
  return s || "";
}

/* =========================
   下層の選び方（あなたの列仕様）
   ========================= */

function pickTounyuuChild(r) {
  const p = safeKey(r["投入法"]);
  if (p === "3本爪") return safeKey(r["3本爪"]);
  if (p === "2本爪") return safeKey(r["2本爪"]);
  return "";
}

function pickGenreChild(r) {
  const p = safeKey(r["景品ジャンル"]);

  let v = "";
  if (p === "食品") v = safeKey(r["食品ジャンル"]);
  else if (p === "ぬいぐるみ") v = safeKey(r["ぬいぐるみジャンル"]);
  else if (p === "雑貨") v = safeKey(r["雑貨ジャンル"]);
  else v = "";

  return v || "未分類";
}

function pickCharaChild(r) {
  const p = safeKey(r["キャラ"]);
  if (p === "ノンキャラ") return safeKey(r["ノンキャラジャンル"]);
  return safeKey(r["キャラジャンル"]);
}
