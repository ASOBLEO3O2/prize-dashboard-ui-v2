// tools/build_symbol_master.mjs
// 使い方:
// node tools/build_symbol_master.mjs "<CSV_URL>" "docs/data/master/symbol_master.json"

import fs from "node:fs";
import path from "node:path";

const [,, csvUrl, outPath] = process.argv;
if (!csvUrl || !outPath) {
  console.log('Usage: node tools/build_symbol_master.mjs "<CSV_URL>" "<out_json_path>"');
  process.exit(1);
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i+1];
    if (inQ) {
      if (ch === '"' && next === '"') { cell += '"'; i++; continue; }
      if (ch === '"') { inQ = false; continue; }
      cell += ch; continue;
    } else {
      if (ch === '"') { inQ = true; continue; }
      if (ch === ",") { row.push(cell); cell = ""; continue; }
      if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
      if (ch === "\r") continue;
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const res = await fetch(csvUrl, { cache: "no-store" });
if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
const text = await res.text();

const grid = parseCSV(text);
const header = (grid.shift() || []).map(s => String(s || "").trim());

const records = grid
  .filter(r => r.some(x => String(x || "").trim() !== ""))
  .map(r => {
    const o = {};
    header.forEach((h, i) => o[h] = (r[i] ?? "").toString().trim());
    return o;
  });

// キー列名は実データに合わせて吸収
function pickKey(rec) {
  return rec["symbol_raw"] || rec["raw"] || rec["記号"] || rec["シンボル"] || rec["symbol"] || "";
}

const out = {};
for (const rec of records) {
  const k = String(pickKey(rec)).trim();
  if (!k) continue;
  out[k] = rec; // そのまま辞書化
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
console.log(`[OK] wrote: ${outPath} keys=${Object.keys(out).length}`);
