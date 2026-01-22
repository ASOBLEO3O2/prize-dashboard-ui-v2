// tools/build_symbol_master.mjs
// 使い方:
// node tools/build_symbol_master.mjs "<CSV_URL>" "data/master/symbol_master.json"

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

function trim(v) {
  return (v == null) ? "" : String(v).trim();
}

const res = await fetch(csvUrl, { cache: "no-store" });
if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
const text = await res.text();

const grid = parseCSV(text);
const header = (grid.shift() || []).map(s => trim(s));

// 1行目の列名→index
const idx = new Map();
header.forEach((h, i) => idx.set(h, i));

function getCell(row, name) {
  const i = idx.get(name);
  return (i == null) ? "" : trim(row[i]);
}

// マスタ（あなたのスクショ）の列名に合わせて読む
// A:ブースID B:景品名 C:総売上 D:消化数 E:消化額 F:原価率 G:ラベルID H:対応マシン名 I:幅 J:奥行き K:記号 L:更新日
function rowToRecord(r) {
  const booth_id = getCell(r, "ブースID");
  const item_name = getCell(r, "景品名");
  const sales = Number(getCell(r, "総売上") || 0);
  const consume_count = Number(getCell(r, "消化数") || 0);
  const claw = Number(getCell(r, "消化額") || 0);
  const cost_rate = Number(String(getCell(r, "原価率") || "").replace("%","")) / 100 || 0;

  const label_id = getCell(r, "ラベルID");
  const machine_name = getCell(r, "対応マシン名");

  const w = Number(getCell(r, "幅") || 0);
  const d = Number(getCell(r, "奥行き") || 0);

  const updated_date = getCell(r, "更新日");
  const symbol = getCell(r, "記号"); // ←キー

  return {
    booth_id,
    item_name,
    label_id,
    machine_name,
    w,
    d,
    updated_date,

    // 数値系（必要ならアプリ側で使える）
    sales,
    consume_count,
    claw,
    cost_rate,

    // ★キー互換（アプリ側が symbol_raw/raw を見てもOK）
    symbol_raw: symbol,
    raw: symbol,
  };
}

const out = {};
let kept = 0;

for (const r of grid) {
  if (!r || !r.some(x => trim(x) !== "")) continue;

  const symbol = getCell(r, "記号");
  if (!symbol) continue;

  out[symbol] = rowToRecord(r);
  kept++;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
console.log(`[OK] wrote: ${outPath} keys=${kept}`);
