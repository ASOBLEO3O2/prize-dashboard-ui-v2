// src/data/normalizeRow.js
// decodeSymbol が返す「日本語列 + *_code」を入口で吸収し、固定キーへ変換する

function asStr(v) {
  return String(v ?? "").trim();
}
function asNum(v) {
  if (v == null) return 0;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function asNumOrNull(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "") return null;          // ✅ 空欄は null
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return "";
}

// 0/1/true/false/○/× etc を boolean に寄せる
function asBoolTri(v) {
  const s = asStr(v);
  if (!s) return null;
  if (s === "1" || s.toLowerCase() === "true" || s === "○" || s === "〇") return true;
  if (s === "0" || s.toLowerCase() === "false" || s === "×" || s === "✕") return false;
  return null;
}

// 原価率を 0..1（01）に正規化して返す
// - 空欄 → null
// - 0.28 など → そのまま
// - 28 や 28.5 など → % とみなして /100
function parseCostRate01(v) {
  const n = asNumOrNull(v);
  if (n == null) return null;

  // 例えば 27.9（%）が来ることがあるなら /100
  if (n > 1.5) return n / 100;

  // 0..1.5 は比率として扱う（1.1 などが来ても一応許容）
  return n;
}

export function normalizeRow(rawRow) {
  // ==== 基本キー（rawの揺れを吸収） ====

  const boothId = asStr(pickFirst(rawRow, ["boothId", "ブースID", "booth_id"]));
  const labelId = asStr(pickFirst(rawRow, ["labelId", "ラベルID", "label_id"]));

  // ✅ 重要：machineName はマスタの「対応マシン名」を最優先
  const machineName = asStr(
    pickFirst(rawRow, ["対応マシン名", "machineName", "マシン名", "machine_name"])
  );

  const prizeName = asStr(
  pickFirst(rawRow, [
    "prizeName",
    "景品名",
    "景品名_表示",
    "景品名（表示）",
    "景品",
    "景品名称",
    "prize_name",
    "prize",
    "name",
  ])
);


  // 売上/消化額（あなたのデータでは claw が消化額）
  const sales = asNum(pickFirst(rawRow, ["sales", "総売上", "売上", "売上合計"]));
  const claw = asNum(pickFirst(rawRow, ["claw", "消化額", "消化金額", "消化額合計"]));

  // 更新日
  const updatedDate = asStr(pickFirst(rawRow, ["updatedDate", "更新日"]));

  // ==== 原価率（0..1） ====
  // 既にあるなら吸収（空欄は0にしない！）
  let costRate01 =
    parseCostRate01(pickFirst(rawRow, ["costRate01", "原価率01"])) ??
    parseCostRate01(pickFirst(rawRow, ["costRate", "原価率"])); // 互換：別名も拾う

  // 無ければ計算（消化額×1.1÷売上）
  if (costRate01 == null) {
    costRate01 = sales > 0 ? (claw * 1.1) / sales : null;
  }

  // ==== フィルタ用の正規化キー群（設計B案） ====

  // 年代
  const ageLabel = asStr(pickFirst(rawRow, ["年代", "ageLabel"])) || "—";
  const ageKey = asStr(pickFirst(rawRow, ["年代_code", "ageKey"])) || "";

  // 料金
  const feeLabel = asStr(pickFirst(rawRow, ["料金", "feeLabel"])) || "—";
  const feeKey = asStr(pickFirst(rawRow, ["料金_code", "feeKey"])) || "";

  // 回数
  const playsLabel = asStr(pickFirst(rawRow, ["回数", "playsLabel"])) || "—";
  const playsKey = asStr(pickFirst(rawRow, ["回数_code", "playsKey"])) || "";

  // 投入法（親）
  const methodLabel = asStr(pickFirst(rawRow, ["投入法", "methodLabel"])) || "その他";
  const methodKey = asStr(pickFirst(rawRow, ["投入法_code", "methodKey"])) || "";

  // 投入法（子）
  const claw2Label = asStr(pickFirst(rawRow, ["2本爪", "claw2Label"])) || "";
  const claw2Key = asStr(pickFirst(rawRow, ["2本爪_code", "claw2Key"])) || "";
  const claw3Label = asStr(pickFirst(rawRow, ["3本爪", "claw3Label"])) || "";
  const claw3Key = asStr(pickFirst(rawRow, ["3本爪_code", "claw3Key"])) || "";

  // 景品ジャンル（親）
  const prizeGenreLabel =
    asStr(pickFirst(rawRow, ["景品ジャンル", "prizeGenreLabel"])) || "その他";
  const prizeGenreKey =
    asStr(pickFirst(rawRow, ["景品ジャンル_code", "prizeGenreKey"])) || "other";

  // 景品ジャンル（子：label優先）
  const foodLabel = asStr(pickFirst(rawRow, ["食品ジャンル", "foodLabel"])) || "";
  const foodKey = asStr(pickFirst(rawRow, ["食品ジャンル_code", "foodKey"])) || "";
  const plushLabel = asStr(pickFirst(rawRow, ["ぬいぐるみジャンル", "plushLabel"])) || "";
  const plushKey = asStr(pickFirst(rawRow, ["ぬいぐるみジャンル_code", "plushKey"])) || "";
  const goodsLabel = asStr(pickFirst(rawRow, ["雑貨ジャンル", "goodsLabel"])) || "";
  const goodsKey = asStr(pickFirst(rawRow, ["雑貨ジャンル_code", "goodsKey"])) || "";

  // キャラ（親）
  const charaLabel = asStr(pickFirst(rawRow, ["キャラ", "charaLabel"])) || "その他";
  const charaKey = asStr(pickFirst(rawRow, ["キャラ_code", "charaKey"])) || "";

  // キャラ（子）
  const charaGenreLabel = asStr(pickFirst(rawRow, ["キャラジャンル", "charaGenreLabel"])) || "";
  const charaGenreKey = asStr(pickFirst(rawRow, ["キャラジャンル_code", "charaGenreKey"])) || "";
  const nonCharaGenreLabel =
    asStr(pickFirst(rawRow, ["ノンキャラジャンル", "nonCharaGenreLabel"])) || "";
  const nonCharaGenreKey =
    asStr(pickFirst(rawRow, ["ノンキャラジャンル_code", "nonCharaGenreKey"])) || "";

  // ターゲット
  const targetLabel = asStr(pickFirst(rawRow, ["ターゲット", "targetLabel"])) || "—";
  const targetKey = asStr(pickFirst(rawRow, ["ターゲット_code", "targetKey"])) || "";

  // flags（tri）
  const isMovie = asBoolTri(pickFirst(rawRow, ["映画", "movie"])) === true;
  const isReserve = asBoolTri(pickFirst(rawRow, ["予約", "reserve"])) === true;
  const isWlOriginal = asBoolTri(pickFirst(rawRow, ["WL", "wl"])) === true;

  return {
    // ===== ID/基本 =====
    boothId,
    labelId,
    machineName,
    prizeName,
    updatedDate,

    // ===== 数値 =====
    sales,
    claw,
    costRate01,

    // ===== 正規化済みキー群 =====
    ageLabel,
    ageKey,

    feeLabel,
    feeKey,

    playsLabel,
    playsKey,

    methodLabel,
    methodKey,

    claw2Label,
    claw2Key,
    claw3Label,
    claw3Key,

    prizeGenreLabel,
    prizeGenreKey,

    foodLabel,
    foodKey,
    plushLabel,
    plushKey,
    goodsLabel,
    goodsKey,

    charaLabel,
    charaKey,
    charaGenreLabel,
    charaGenreKey,
    nonCharaGenreLabel,
    nonCharaGenreKey,

    targetLabel,
    targetKey,

    isMovie,
    isReserve,
    isWlOriginal,
  };
}

/**
 * drawer等で使う：rows から key のユニーク値を取得（正規化済み前提）
 */
export function uniqueOptions(rows, key) {
  const set = new Set();
  for (const r of rows || []) {
    const v = r?.[key];
    if (v != null && String(v).trim() !== "") set.add(String(v).trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
}
