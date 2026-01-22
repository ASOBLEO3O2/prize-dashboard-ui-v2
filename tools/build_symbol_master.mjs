// tools/build_symbol_master.mjs
import fs from "node:fs";
import path from "node:path";

const [,, csvUrl, outPath] = process.argv;
if (!csvUrl || !outPath) {
  console.log('Usage: node build_symbol_master.mjs "<CSV_URL>" "<out_json_path>"');
  process.exit(1);
}

// 区切り自動判定
function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find(l => l.trim() !== "") || "";
  return (line.split("\t").length > line.split(",").length) ? "\t" : ",";
}

function parse(text, delim) {
  return text.split(/\r?\n/).map(r => r.split(delim));
}

const res = await fetch(csvUrl, { cache: "no-store" });
if (!res.ok) throw new Error(res.statusText);
const text = await res.text();

const delim = detectDelimiter(text);
const rows = parse(text, delim);

// ★ ヘッダは使わない：2行目以降を実データとして扱う
const dataRows = rows.slice(1).filter(r => r.length >= 11);

const out = {};
let kept = 0;

for (const r of dataRows) {
  const symbol = (r[10] || "").trim(); // K列：記号
  if (!symbol) continue;

  out[symbol] = {
    booth_id: r[0]?.trim(),
    item_name: r[1]?.trim(),
    sales: Number((r[2] || "").replace(/,/g,"")) || 0,
    consume_count: Number(r[3]) || 0,
    claw: Number((r[4] || "").replace(/,/g,"")) || 0,
    cost_rate: String(r[5] || "").includes("%")
      ? Number(r[5].replace("%","")) / 100
      : Number(r[5]) || 0,
    label_id: r[6]?.trim(),
    machine_name: r[7]?.trim(),
    w: Number(r[8]) || 0,
    d: Number(r[9]) || 0,
    symbol_raw: symbol,
    raw: symbol,
    updated_date: r[11]?.trim(),
  };
  kept++;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
console.log(`[OK] wrote: ${outPath} keys=${kept}`);
