// src/data/enrichRows.js
export function enrichRowsWithMaster(rows, masterDict) {
  const keep = new Set([
    "machine_name","machine_key","booth_id","item_name","label_id","w","d",
    "consume_count","updated_date","sales","claw","cost_rate",
    "symbol_raw","raw"
  ]);

  return rows.map(r => {
    const key = String(r?.symbol_raw ?? r?.raw ?? "").trim();
    const m = key ? masterDict?.[key] : null;
    if (!m) return r;

    const out = { ...r };
    for (const [k, v] of Object.entries(m)) {
      if (keep.has(k)) continue;
      out[k] = v; // ✅ マスタで上書き
    }
    return out;
  });
}
