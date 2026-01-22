// tools/build_codebook.mjs
// 使い方:
// node tools/build_codebook.mjs "<CSV_URL>" "data/master/codebook.json"

import fs from "node:fs";
import path from "node:path";

const [,, csvUrl, outPath] = process.argv;
if (!csvUrl || !outPath) {
  console.log('Usage: node tools/build_codebook.mjs "<CSV_URL>" "<out_json_path>"');
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

// クォート対応のデリミタパーサ
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

const res = await fetch(csvUrl, { cache: "no-store" });
if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
const text = await res.text();

const delim = detectDelimiter(text);
const grid = parseDelimited(text, delim);

const header = (grid.shift() || []).map(s => stripBOM(trim(s)));
const idx = new Map();
header.forEach((h, i) => idx.set(h, i));

function get(row, col) {
  const i = idx.get(col);
  return (i == null) ? "" : trim(row[i]);
}

function add(map, code, label) {
  const c = trim(code);
  const l = trim(label);
  if (!c || !l) return;
  map[c] = l;
}

const out = {
  fee: {},          // 料金記号 -> 料金
  plays: {},        // 回数記号 -> プレイ回数
  method: {},       // 投入法記号 -> 投入法
  claw3: {},        // 3本爪記号 -> 3本爪
  claw2: {},        // 2本爪記号 -> 2本爪
  prizeGenre: {},   // 景品ジャンル記号 -> 景品ジャンル
  food: {},         // 食品記号 -> 食品ジャンル
  plush: {},        // ぬいぐるみ記号 -> ぬいぐるみジャンル
  goods: {},        // 雑貨記号 -> 雑貨ジャンル
  target: {},       // ターゲット記号 -> ターゲット
  age: {},          // 年代記号 -> 年代
  chara: {},        // キャラ記号 -> キャラ
  charaGenre: {},   // キャラジャンル記号 -> キャラジャンル
  nonCharaGenre: {},// ノンキャラジャンル記号 -> ノンキャラジャンル
  movie: {},        // 映画記号 -> 映画
  reserve: {},      // 予約記号 -> 予約
  wl: {},           // WLオリジナル記号 -> WLオリジナル
};

for (const r of grid) {
  if (!r || !r.some(x => trim(x) !== "")) continue;

  add(out.fee,    get(r, "料金記号"),           get(r, "料金"));
  add(out.plays,  get(r, "回数記号"),           get(r, "プレイ回数"));
  add(out.method, get(r, "投入法記号"),         get(r, "投入法"));
  add(out.claw3,  get(r, "3本爪記号"),          get(r, "3本爪"));
  add(out.claw2,  get(r, "2本爪記号"),          get(r, "2本爪"));
  add(out.prizeGenre, get(r, "景品ジャンル記号"), get(r, "景品ジャンル"));
  add(out.food,   get(r, "食品記号"),           get(r, "食品ジャンル"));
  add(out.plush,  get(r, "ぬいぐるみ記号"),     get(r, "ぬいぐるみジャンル"));
  add(out.goods,  get(r, "雑貨記号"),           get(r, "雑貨ジャンル"));
  add(out.target, get(r, "ターゲット記号"),     get(r, "ターゲット"));
  add(out.age,    get(r, "年代記号"),           get(r, "年代"));
  add(out.chara,  get(r, "キャラ記号"),         get(r, "キャラ"));
  add(out.charaGenre,    get(r, "キャラジャンル記号"),     get(r, "キャラジャンル"));
  add(out.nonCharaGenre, get(r, "ノンキャラジャンル記号"), get(r, "ノンキャラジャンル"));
  add(out.movie,   get(r, "映画記号"),          get(r, "映画"));
  add(out.reserve, get(r, "予約記号"),          get(r, "予約"));
  add(out.wl,      get(r, "WLオリジナル記号"), get(r, "WLオリジナル"));
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");

console.log(`[OK] wrote: ${outPath}`);
console.log(`[OK] counts: fee=${Object.keys(out.fee).length} plays=${Object.keys(out.plays).length} method=${Object.keys(out.method).length} prizeGenre=${Object.keys(out.prizeGenre).length}`);
