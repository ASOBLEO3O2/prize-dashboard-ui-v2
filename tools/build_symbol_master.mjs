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
const stripBOM = (s) => s.replace(/^\uFEFF/, "");

function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find(l => l.trim() !== "") || "";
  const commas = (line.match(/,/g) || []).length;
  const tabs   = (line.match(/\t/g) || []).length;
  return (tabs > commas) ? "\t" : ",";
}

// RFC4180寄り（クォート/ダブルクォート対応）
function parseDelimited(text, delim) {
  const rows = [];
  let row = [], cell = "", inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i+1];

    if (inQ) {
      if (ch === '"' && next === '"') { cell += '"'; i++; continue; }
      if (ch === '"') { inQ = false; continue; }
      cell += ch; continue;
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

function num(v) {
  const s = trim(v).replace(/,/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function pctToRate(v) {
  const s = trim(v);
  if (!s) return 0;
  if (s.includes("%")) return num(s.replace("%","")) / 100;
  // "0.27" 形式も許容
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ヘッダ行を探す（「ブースID」「記号」どちらかを含む行）
function findHeaderIndex(rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(x => trim(x));
    const joined = r.join(",");
    if (joined.includes("ブースID") || joined.includes("記号")) return i;
  }
  return 0; // 見つからなければ先頭
}

const res = await fetch(csvUrl, { cache: "no-store" });
if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
const text = await res.text();

const delim = detectDelimiter(text);
const gridAll = parseDelimited(text, delim);

// ヘッダ行を確定
const hIdx = findHeaderIndex(gridAll);
const header = (gridAll[hIdx] || []).map(s => stripBOM(trim(s)));

// ログ（1回だけ確認用）
console.log("[MASTER] delimiter =", JSON.stringify(delim));
console.log("[MASTER] headerRowIndex =", hIdx);
console.log("[MASTER] header cols =", header.length);
console.log("[MASTER] header =", header.join(" | "));

// 列名→index
const idx = new Map();
header.forEach((h, i) => idx.set(h, i));

function getCell(row, name) {
  const i = idx.get(name);
  return (i == null) ? "" : trim(row[i]);
}

// 列名ゆれ吸収（あなたのシート想定）
const COL = {
  booth: ["ブースID"],
  item:  ["景品名"],
  sales: ["総売上"],
  cnt:   ["消化数"],
  claw:  ["消化額"],
  rate:  ["原価率"],
  label: ["ラベルID"],
  mach:  ["対応マシン名"],
  w:     ["幅"],
  d:     ["奥行き", "奥行"],
  sym:   ["記号", "symbol_raw", "raw", "シンボル", "記号ID"],
  upd:   ["更新日", "更新日時"],
};

function pick(row, names) {
  for (const n of names) {
    const v = getCell(row, n);
    if (v) return v;
  }
  return "";
}

const dataRows = gridAll
  .slice(hIdx + 1)
  .filter(r => r && r.some(x => trim(x) !== ""));

const out = {};
let kept = 0;

for (const r of dataRows) {
  const symbol = pick(r, COL.sym);
  if (!symbol) continue;

  out[symbol] = {
    booth_id: pick(r, COL.booth),
    item_name: pick(r, COL.item),
    sales: num(pick(r, COL.sales)),
    consume_count: num(pick(r, COL.cnt)),
    claw: num(pick(r, COL.claw)),
    cost_rate: pctToRate(pick(r, COL.rate)),
    label_id: pick(r, COL.label),
    machine_name: pick(r, COL.mach),
    w: num(pick(r, COL.w)),
    d: num(pick(r, COL.d)),
    symbol_raw: symbol,
    raw: symbol,
    updated_date: pick(r, COL.upd),
  };

  kept++;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
console.log(`[OK] wrote: ${outPath} keys=${kept}`);
