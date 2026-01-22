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

const trim = (v) => (v == null) ? "" : String(v).trim();

// 区切り文字を自動判定（カンマ vs タブ）
function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find(l => l.trim() !== "") || "";
  const commas = (line.match(/,/g) || []).length;
  const tabs   = (line.match(/\t/g) || []).length;
  return (tabs > commas) ? "\t" : ",";
}

// デリミタ指定のCSV/TSVパーサ（クォート対応）
function parseDelimited(text, delim) {
  const rows = [];
  let row = [], cell = "", inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];

    if (inQ) {
      if (ch === '"' && next === '"') { cell += '"'; i++; continue; }
      if (ch === '"') { inQ = false; continue; }
      cell += ch;
      continue;
    }

    if (ch === '"') { inQ = true; continue; }
    if (ch === delim) { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (ch === "\r") continue;

    cell += ch;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

const res = await fetch(csvUrl, { cache: "no-store" });
if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
const text = await res.text();

const delim = detectDelimiter(text);
const grid = parseDelimited(text, delim);

// ヘッダ
const header = (grid.shift() || []).map(s => trim(s));

// ★ まずログに出す（区切り誤判定/列名ズレを即確認できる）
console.log("[MASTER] delimiter =", JSON.stringify(delim));
console.log("[MASTER] header cols =", header.length);
console.log("[MASTER] header =", header.join(" | "));

// 1行目が空/壊れのとき
if (!header.length || header.every(h => h === "")) {
  throw new Error("Header is empty. CSV/TSV export may be broken.");
}

// 列名→index
const idx = new Map();
header.forEach((h, i) => idx.set(h, i));

function getCell(row, name) {
  const i = idx.get(name);
  return (i == null) ? "" : trim(row[i]);
}

// 念のため「記号」列の候補も吸収（列名が微妙に違うケース対策）
function getSymbol(row) {
  return (
    getCell(row, "記号") ||
    getCell(row, "シンボル") ||
    getCell(row, "symbol_raw") ||
    getCell(row, "raw")
  );
}

// マスタ（あなたのスクショ）の列名に合わせて読む
function rowToRecord(r, symbol) {
  const booth_id = getCell(r, "ブースID");
  const item_name = getCell(r, "景品名");
  const sales = Number(getCell(r, "総売上") || 0);
  const consume_count = Number(getCell(r, "消化数") || 0);
  const claw = Number(getCell(r, "消化額") || 0);

  // 原価率は "27.0%" or "0.27" など揺れるので吸収
  const crRaw = getCell(r, "原価率");
  const cost_rate =
    crRaw.includes("%") ? (Number(crRaw.replace("%", "")) / 100 || 0) :
    (Number(crRaw) || 0);

  const label_id = getCell(r, "ラベルID");
  const machine_name = getCell(r, "対応マシン名");
  const w = Number(getCell(r, "幅") || 0);
  const d = Number(getCell(r, "奥行き") || 0);
  const updated_date = getCell(r, "更新日");

  return {
    booth_id,
    item_name,
    label_id,
    machine_name,
    w,
    d,
    updated_date,
    sales,
    consume_count,
    claw,
    cost_rate,
    symbol_raw: symbol,
    raw: symbol,
  };
}

const out = {};
let kept = 0;

for (const r of grid) {
  if (!r || !r.some(x => trim(x) !== "")) continue;

  const symbol = trim(getSymbol(r));
  if (!symbol) continue;

  out[symbol] = rowToRecord(r, symbol);
  kept++;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
console.log(`[OK] wrote: ${outPath} keys=${kept}`);
