// src/data/load.js
async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  return await res.json();
}

export async function loadRawData() {
  // ここが「実データ接続の唯一の入口」
  const [rows, summary, masterDict] = await Promise.all([
    fetchJson("./data/raw/rows.json"),
    fetchJson("./data/raw/summary.json"),
    fetchJson("./data/master/symbol_master.json"),
  ]);

  return { rows, summary, masterDict };
}
