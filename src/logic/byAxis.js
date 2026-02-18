// src/logic/byAxis.js
// rows（1行=1台）から「中段KPIの軸別カード用データ」を作る
//
// ✅ 修正方針（重要）
// - 入力は normRows（正規化済み）前提。raw列（r["景品ジャンル"] 等）を参照しない。
// - 親→子のドリルダウンは「親値に応じた子列」を必ず使う（列混在を避ける）
// - 子カテゴリは "label" を優先し、code へ逃げず「未分類」に寄せる
// - 親・子ともに売上降順で安定ソート（描画差分で「違う」に見えるのを防ぐ）

export function buildByAxis(rows) {
  console.log("[BYAXIS] LOADED v2026-02-18", rows?.length);

  const safeRows = Array.isArray(rows) ? rows : [];

  return {
    // フラット軸
    年代: buildFlatAxis(safeRows, (r) => r?.ageLabel),
    マシン: buildFlatAxis(safeRows, (r) => r?.machineName || r?.boothId),

    // 階層軸（カード内展開）
    投入法: buildHierAxis(safeRows, {
      parent: (r) => r?.methodLabel,       // "2本爪" / "3本爪"
      child: (r) => pickTounyuuChild(r),   // claw3Label / claw2Label
    }),

    ジャンル: buildHierAxis(safeRows, {
      parent: (r) => r?.prizeGenreLabel,   // 食品/ぬいぐるみ/雑貨...
      child: (r) => pickGenreChild(r),     // foodLabel/plushLabel/goodsLabel
    }),

    キャラ: buildHierAxis(safeRows, {
      parent: (r) => r?.charaLabel,        // ノンキャラ/ポケモン...
      child: (r) => pickCharaChild(r),     // charaGenreLabel / nonCharaGenreLabel
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
    const pLabel = safeKey(parent(r));
    if (!pLabel) continue;

    // 親（例：食品）
    const p = ensureAgg(parents, pLabel, pLabel);
    addRowAgg(p, r);

    // 子（例：スナック）
    const cLabel = safeKey(child(r));
    if (cLabel) {
      if (!p._children) p._children = new Map();
      const cKey = `${pLabel}|${cLabel}`; // 親ごとに必ず分離
      const c = ensureAgg(p._children, cKey, cLabel);
      addRowAgg(c, r);
    }
  }

  // 親リスト化 → 子も同様に finalize + ソート
  const outParents = Array.from(parents.values()).map((p) => {
    const out = finalizeAggOne(p);

    if (p._children) {
      const children = finalizeAggList(Array.from(p._children.values()));
      if (children.length) out.children = children;
    }

    delete out._children;
    return out;
  });

  // 親も売上降順で安定化
  outParents.sort(
    (a, b) =>
      b.sales - a.sales ||
      b.machines - a.machines ||
      a.label.localeCompare(b.label, "ja")
  );
  return outParents;
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
    // sales=0 の場合は 0 固定にせず null にして「計算不能」を区別（UIで "-" にできる）
    costRate: a._costDen > 0 ? a._costNum / a._costDen : null,
  };
}

function finalizeAggList(list) {
  const out = list.map(finalizeAggOne);
  // 売上降順→台数→ラベルで安定ソート（表示がブレない）
  out.sort(
    (a, b) =>
      b.sales - a.sales ||
      b.machines - a.machines ||
      a.label.localeCompare(b.label, "ja")
  );
  return out;
}

function safeKey(v) {
  const s = v == null ? "" : String(v).trim();
  return s || "";
}

/* =========================
   下層の選び方（normRows仕様）
   ========================= */

function pickTounyuuChild(r) {
  const p = safeKey(r?.methodLabel);
  if (p === "3本爪") return safeKey(r?.claw3Label) || "未分類";
  if (p === "2本爪") return safeKey(r?.claw2Label) || "未分類";
  return "";
}

/**
 * 重要：子カテゴリは label（日本語ラベル）を優先して統一。
 * code へフォールバックすると、親切替時に「別親の子が混ざって見える」原因になりやすい。
 * ここでは label が空なら "未分類" に寄せる。
 */
function pickGenreChild(r) {
  const p = safeKey(r?.prizeGenreLabel);

  // 子列は label のみ（codeへ逃げない）
  const food = safeKey(r?.foodLabel);
  const plush = safeKey(r?.plushLabel);
  const goods = safeKey(r?.goodsLabel);

  // 親に応じて「本命列」を最優先
  // ただし実データが混在してても未分類固定にならないように、他列へフォールバック
  if (p === "食品") return food || plush || goods || "未分類";
  if (p === "ぬいぐるみ") return plush || food || goods || "未分類";
  if (p === "雑貨") return goods || food || plush || "未分類";

  // 親が想定外/空の場合も、とにかく拾えるものを拾う
  return plush || food || goods || "未分類";
}

function pickCharaChild(r) {
  const p = safeKey(r?.charaLabel);
  if (!p) return "";

  if (p === "ノンキャラ") return safeKey(r?.nonCharaGenreLabel) || "未分類";
  return safeKey(r?.charaGenreLabel) || "未分類";
}
