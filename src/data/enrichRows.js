// src/data/enrichRows.js
export function enrichRowsWithMaster(rows, masterDict) {
  // keep = 「行（raw/CSV側）の値を優先し、マスタで上書きしないキー」
  // ❗ item_name(=景品名) はマスタから入れたいので keep から外す
  const keep = new Set([
    "machine_name",
    "machine_key",
    "booth_id",
    // "item_name",  ← ここが景品名欠落の原因だったので外す
    "label_id",
    "w",
    "d",
    "consume_count",
    "updated_date",
    "sales",
    "claw",
    "cost_rate",
    "symbol_raw",
    "raw",
  ]);

  const pickFirst = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v != null && String(v).trim() !== "") return v;
    }
    return "";
  };

  return (rows || []).map((r) => {
    const key = String(r?.symbol_raw ?? r?.raw ?? "").trim();
    const m = key ? masterDict?.[key] : null;
    if (!m) return r;

    const out = { ...r };

    // ✅ マスタで上書き（keep以外）
    for (const [k, v] of Object.entries(m)) {
      if (keep.has(k)) continue;
      out[k] = v;
    }

    // ✅ 最後に「景品名」だけは必ず埋める（行側が空ならマスタから）
    // master 側は symbol_master.json の item_name が本命
    const itemName = String(
      pickFirst(out, ["item_name", "prizeName", "景品名"]) ||
        pickFirst(m, ["item_name", "prizeName", "景品名", "name"])
    ).trim();
    if (itemName) {
      out.item_name = itemName; // normalizeRow が拾う
      out.prizeName = itemName; // もしどこかが prizeName を見ても落ちない
    }

    return out;
  });
}
