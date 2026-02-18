// src/data/normalizeRow.js
// decodeSymbol が返す「日本語列 + *_code」を入口で吸収し、固定キーへ変換する

function asStr(v) {
  return String(v ?? "").trim();
}
function asNum(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}
function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}
function toBoolFromCode(code) {
  // codebook前提： "1"=〇, "2"=×（decodeSymbolの *_code を信頼）
  const c = asStr(code);
  if (c === "1") return true;
  if (c === "2") return false;
  return false;
}
function ensureOtherKeyLabel(key, label, otherKey = "other", otherLabel = "その他") {
  const k = asStr(key);
  const l = asStr(label);
  if (k) return { key: k, label: l || "" };
  return { key: otherKey, label: otherLabel };
}

/**
 * normalizeRow(rawRow)
 * rawRow は app.js で masterDict と decodeSymbol を merge 済み想定
 */
export function normalizeRow(rawRow) {
  // ===== 基本（masterDict由来） =====
  const boothId = asStr(pickFirst(rawRow, ["boothId", "booth_id", "ブースID"]));
  const labelId = asStr(pickFirst(rawRow, ["labelId", "label_id", "ラベルID"]));
  const machineName = asStr(pickFirst(rawRow, ["machineName", "machine_name", "対応マシン名", "マシン名"]));

  const prizeName = asStr(pickFirst(rawRow, ["prizeName", "item_name", "景品名"]));

  const sales = asNum(pickFirst(rawRow, ["sales", "総売上", "売上"]));
  const claw = asNum(pickFirst(rawRow, ["claw", "消化額"]));
  const consumeCount = asNum(pickFirst(rawRow, ["consume_count", "消化数"]));

  const w = asNum(pickFirst(rawRow, ["w", "幅"]));
  const d = asNum(pickFirst(rawRow, ["d", "奥行き"]));
  const updatedDate = asStr(pickFirst(rawRow, ["updated_date", "更新日", "updatedDate"]));

  // cost_rate は 0..1 に寄せる（masterDictは既に0..1想定）
  const crRaw = pickFirst(rawRow, ["costRate01", "cost_rate", "原価率"]);
  let costRate01 = 0;
  if (typeof crRaw === "string" && crRaw.includes("%")) {
    costRate01 = asNum(crRaw.replace("%", "")) / 100;
  } else {
    const n = asNum(crRaw);
    costRate01 = n > 1 ? n / 100 : n;
  }
  if (!Number.isFinite(costRate01) || costRate01 < 0) costRate01 = 0;

  // ===== ここから decodeSymbol（日本語列 + *_code）を固定キー化 =====
  const fee = ensureOtherKeyLabel(rawRow?.["料金_code"], rawRow?.["料金"]);
  const plays = ensureOtherKeyLabel(rawRow?.["回数_code"], rawRow?.["回数"]);
  const method = ensureOtherKeyLabel(rawRow?.["投入法_code"], rawRow?.["投入法"]);

  const claw3 = ensureOtherKeyLabel(rawRow?.["3本爪_code"], rawRow?.["3本爪"]);
  const claw2 = ensureOtherKeyLabel(rawRow?.["2本爪_code"], rawRow?.["2本爪"]);

  const prizeGenre = ensureOtherKeyLabel(rawRow?.["景品ジャンル_code"], rawRow?.["景品ジャンル"]);

  // 子ジャンルは「該当時だけ code が入る」仕様なので、空は空で保持（=未該当）
  const foodKey = asStr(rawRow?.["食品ジャンル_code"]);
  const plushKey = asStr(rawRow?.["ぬいぐるみジャンル_code"]);
  const goodsKey = asStr(rawRow?.["雑貨ジャンル_code"]);

  const foodLabel = foodKey ? asStr(rawRow?.["食品ジャンル"]) || "その他" : "";
  const plushLabel = plushKey ? asStr(rawRow?.["ぬいぐるみジャンル"]) || "その他" : "";
  const goodsLabel = goodsKey ? asStr(rawRow?.["雑貨ジャンル"]) || "その他" : "";

  const target = ensureOtherKeyLabel(rawRow?.["ターゲット_code"], rawRow?.["ターゲット"]);
  const age = ensureOtherKeyLabel(rawRow?.["年代_code"], rawRow?.["年代"]);

  const chara = ensureOtherKeyLabel(rawRow?.["キャラ_code"], rawRow?.["キャラ"]);
  const charaGenre = ensureOtherKeyLabel(rawRow?.["キャラジャンル_code"], rawRow?.["キャラジャンル"]);
  const nonCharaGenre = ensureOtherKeyLabel(rawRow?.["ノンキャラジャンル_code"], rawRow?.["ノンキャラジャンル"]);

  const isMovie = toBoolFromCode(rawRow?.["映画_code"]);
  const isReserve = toBoolFromCode(rawRow?.["予約_code"]);
  const isWlOriginal = toBoolFromCode(rawRow?.["WLオリジナル_code"]);

  return {
    // ===== ID系 =====
    boothId,
    labelId,
    machineName,

    // ===== 数値/表示 =====
    prizeName,
    sales,
    claw,
    consumeCount,
    costRate01,
    w,
    d,
    updatedDate,

    // ===== フィルタ固定キー（Key/Label） =====
    feeKey: fee.key,
    feeLabel: fee.label,

    playsKey: plays.key,
    playsLabel: plays.label,

    methodKey: method.key,
    methodLabel: method.label,

    claw3Key: claw3.key,
    claw3Label: claw3.label,

    claw2Key: claw2.key,
    claw2Label: claw2.label,

    prizeGenreKey: prizeGenre.key,
    prizeGenreLabel: prizeGenre.label,

    foodKey,
    foodLabel,
    plushKey,
    plushLabel,
    goodsKey,
    goodsLabel,

    targetKey: target.key,
    targetLabel: target.label,

    ageKey: age.key,
    ageLabel: age.label,

    charaKey: chara.key,
    charaLabel: chara.label,

    charaGenreKey: charaGenre.key,
    charaGenreLabel: charaGenre.label,

    nonCharaGenreKey: nonCharaGenre.key,
    nonCharaGenreLabel: nonCharaGenre.label,

    isMovie,
    isReserve,
    isWlOriginal,

    _raw: rawRow,
  };
}

export function uniqueOptions(normRows, field, opts = {}) {
  const includeEmpty = !!opts.includeEmpty;
  const set = new Set();
  for (const r of normRows || []) {
    const v = asStr(r?.[field]);
    if (!includeEmpty && !v) continue;
    set.add(v);
  }
  return [...set];
}
