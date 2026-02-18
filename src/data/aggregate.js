// src/data/aggregate.js

function asStr(v) {
  return String(v ?? "").trim();
}

export function aggregateBy(normRows, keyFnOrField) {
  const keyFn =
    typeof keyFnOrField === "function"
      ? keyFnOrField
      : (r) => asStr(r?.[keyFnOrField]);

  const map = new Map();

  for (const r of normRows || []) {
    const k = keyFn(r);
    if (!k) continue;

    const cur = map.get(k) || {
      key: k,
      rows: [],
      sales: 0,
      claw: 0,
      // 代表値（先勝ち）
      boothId: "",
      labelId: "",
      machineName: "",
      prizeName: "",
      genreKey: "",
      genreLabel: "",
    };

    cur.rows.push(r);
    cur.sales += Number(r?.sales || 0);
    cur.claw += Number(r?.claw || 0);

    if (!cur.boothId && r?.boothId) cur.boothId = r.boothId;
    if (!cur.labelId && r?.labelId) cur.labelId = r.labelId;
    if (!cur.machineName && r?.machineName) cur.machineName = r.machineName;
    if (!cur.prizeName && r?.prizeName) cur.prizeName = r.prizeName;
    if (!cur.genreKey && r?.genreKey) cur.genreKey = r.genreKey;
    if (!cur.genreLabel && r?.genreLabel) cur.genreLabel = r.genreLabel;

    map.set(k, cur);
  }

  // costRate01 は “集約後に” 計算（合算÷合算）
  const out = [];
  for (const v of map.values()) {
    const costRate01 = v.sales > 0 ? v.claw / v.sales : 0;
    out.push({ ...v, costRate01 });
  }
  return out;
}
