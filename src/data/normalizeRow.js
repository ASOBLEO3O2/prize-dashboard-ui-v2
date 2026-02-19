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
  return "";
}

function toKeyLabel(obj, labelKeys, codeKeys, fallbackLabel = "", fallbackKey = "") {
  const label = asStr(pickFirst(obj, labelKeys));
  const key = asStr(pickFirst(obj, codeKeys));
  return {
    key: key || (label ? label : fallbackKey),
    label: label || (key ? key : fallbackLabel),
  };
}

export function normalizeRow(rawRow) {
  // ===== ID =====
  const boothId = asStr(pickFirst(rawRow, ["boothId", "booth_id", "ブースID"]));
  const labelId = asStr(pickFirst(rawRow, ["labelId", "label_id", "ラベルID"]));
  const machineName = asStr(
    pickFirst(rawRow, ["machineName", "machine_name", "対応マシン名", "マシン名"])
  );

  // ✅ 景品名（enrichで item_name が入る想定）
  const prizeName = asStr(
    pickFirst(rawRow, [
      "prizeName",
      "item_name",
      "景品名",
      "景品",
      "name",
      "prize_name",
    ])
  );

  // ===== 数値 =====
  const sales = asNum(pickFirst(rawRow, ["sales", "総売上", "売上"]));
  const claw = asNum(pickFirst(rawRow, ["claw", "消化額"]));

  // costRate01 は「0.0〜1.0」で統一
  // raw側に cost_rate(%) が来る場合もあるので両対応
  const cost_rate = pickFirst(rawRow, ["costRate01", "cost_rate", "原価率"]);
  let costRate01 = 0;
  if (typeof cost_rate === "number") costRate01 = cost_rate;
  else {
    const s = String(cost_rate ?? "").trim();
    const n = Number(s.replace(/%/g, ""));
    if (Number.isFinite(n)) costRate01 = n > 1 ? n / 100 : n;
  }

  const updatedDate = asStr(pickFirst(rawRow, ["updatedDate", "updated_date", "更新日"]));

  // ===== デコード済み（*_code or 日本語ラベル） =====
  const age = toKeyLabel(rawRow, ["年代"], ["年代_code"], "", "");
  const fee = toKeyLabel(rawRow, ["料金"], ["料金_code"], "", "");
  const plays = toKeyLabel(rawRow, ["回数"], ["回数_code"], "", "");

  const method = toKeyLabel(rawRow, ["投入法"], ["投入法_code"], "", "");

  const claw2 = toKeyLabel(rawRow, ["2本爪"], ["2本爪_code"], "", "");
  const claw3 = toKeyLabel(rawRow, ["3本爪"], ["3本爪_code"], "", "");

  const prizeGenre = toKeyLabel(rawRow, ["景品ジャンル"], ["景品ジャンル_code"], "その他", "other");
  const food = toKeyLabel(rawRow, ["食品ジャンル"], ["食品ジャンル_code"], "未分類", "misc");
  const plush = toKeyLabel(rawRow, ["ぬいぐるみジャンル"], ["ぬいぐるみジャンル_code"], "未分類", "misc");
  const goods = toKeyLabel(rawRow, ["雑貨ジャンル"], ["雑貨ジャンル_code"], "未分類", "misc");

  const chara = toKeyLabel(rawRow, ["キャラ"], ["キャラ_code"], "その他", "other");
  const charaGenre = toKeyLabel(rawRow, ["キャラジャンル"], ["キャラジャンル_code"], "未分類", "misc");
  const nonCharaGenre = toKeyLabel(rawRow, ["ノンキャラジャンル"], ["ノンキャラジャンル_code"], "未分類", "misc");

  // flags（正規化済みキーで扱う）
  const isMovie = !!rawRow?.isMovie;
  const isReserve = !!rawRow?.isReserve;
  const isWlOriginal = !!rawRow?.isWlOriginal;

  return {
    boothId,
    labelId,
    machineName,

    prizeName,
    updatedDate,

    sales,
    claw,
    costRate01,

    ageLabel: age.label,
    ageKey: age.key,

    feeLabel: fee.label,
    feeKey: fee.key,

    playsLabel: plays.label,
    playsKey: plays.key,

    methodLabel: method.label,
    methodKey: method.key,

    claw2Label: claw2.label,
    claw2Key: claw2.key,

    claw3Label: claw3.label,
    claw3Key: claw3.key,

    prizeGenreLabel: prizeGenre.label,
    prizeGenreKey: prizeGenre.key,

    foodLabel: food.label,
    foodKey: food.key,

    plushLabel: plush.label,
    plushKey: plush.key,

    goodsLabel: goods.label,
    goodsKey: goods.key,

    charaLabel: chara.label,
    charaKey: chara.key,

    charaGenreLabel: charaGenre.label,
    charaGenreKey: charaGenre.key,

    nonCharaGenreLabel: nonCharaGenre.label,
    nonCharaGenreKey: nonCharaGenre.key,

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
