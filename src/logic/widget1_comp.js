// src/logic/widget1_comp.js
const safe = (v) => (v == null ? "" : String(v)).trim();
const toNum = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * ウィジェット①：売上/マシン構成比（=ステーション構成比）
 * - 売上：Σ 総売上
 * - 台数：distinct(ブースID)
 * - 軸：axisKey の列を使う（空は "未分類"）
 */
export function buildWidget1Composition(rows, axisKey, opt = {}) {
  const boothKey = opt.boothKey ?? "ブースID";
  const salesKey = opt.salesKey ?? "総売上";

  const topN = opt.topN ?? 5;
  const includeOthers = opt.includeOthers ?? false; // 必要なら後で true

  // --- 全体（分母） ---
  const allBooths = new Set();
  let salesTotal = 0;

  // --- グループ ---
  // k -> { salesSum, booths:Set }
  const map = new Map();

  for (const r of rows) {
    const booth = safe(r[boothKey]);
    if (booth) allBooths.add(booth);

    const k0 = safe(r[axisKey]);
    const k = k0 ? k0 : "未分類";

    const sales = toNum(r[salesKey]);
    salesTotal += sales;

    if (!map.has(k)) map.set(k, { salesSum: 0, booths: new Set() });
    const g = map.get(k);
    g.salesSum += sales;
    if (booth) g.booths.add(booth);
  }

  const machineTotal = allBooths.size; // ★ここが “1ステーション=ブースID” の台数

  // --- VM化 ---
  let items = Array.from(map.entries()).map(([label, g]) => {
    const salesYen = g.salesSum;
    const machineCount = g.booths.size;
    return {
      label,
      salesYen,
      salesShare: salesTotal > 0 ? salesYen / salesTotal : 0,
      machineCount,
      machineShare: machineTotal > 0 ? machineCount / machineTotal : 0,
    };
  });

  // 売上降順
  items.sort((a, b) => b.salesYen - a.salesYen);

  // TopN（必要ならその他）
  if (!includeOthers && items.length > topN) {
    items = items.slice(0, topN);
  }

  // 未分類のみ検知（破綻検知：軸列が取れてない可能性）
  const onlyUnclassified =
    items.length === 1 && items[0].label === "未分類" && (salesTotal > 0 || machineTotal > 0);

  return {
    items,
    meta: {
      axisKey,
      salesTotal,
      machineTotal,
      onlyUnclassified,
    },
  };
}
