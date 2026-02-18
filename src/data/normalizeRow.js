// src/data/normalizeRow.js
// B案：入口で1回だけ正規化し、以後は state.normRows の固定キーだけを見る
// - masterDict / decodeSymbol 由来の “記号キー” を codebook で label 化
// - 取れないものは other/その他（運用で見直し）
// - フラグは boolean に確定

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

function labelFrom(codebook, group, key) {
  const k = asStr(key);
  if (!k) return "";
  const dict = codebook?.[group];
  if (!dict) return "";
  const v = dict[k];
  return v != null ? String(v) : "";
}

function boolFromMaruBatsu(codebook, group, key) {
  // codebookは "1":"〇", "2":"×" の形
  const lbl = labelFrom(codebook, group, key);
  if (lbl === "〇") return true;
  if (lbl === "×") return false;
  // 万一 codebook が変わった時の保険：キーが "1"/"2" の場合
  const k = asStr(key);
  if (k === "1") return true;
  if (k === "2") return false;
  return false;
}

function ensureOther(key, label, otherKey = "other", otherLabel = "その他") {
  const k = asStr(key);
  const l = asStr(label);
  if (k) return { key: k, label: l || "" };
  return { key: otherKey, label: otherLabel };
}

/**
 * normalizeRow(rawRow, codebook)
 * - rawRow: enrich済み（masterDict + decodeSymbol merge 後）想定
 * - codebook: codebook.json
 */
export function normalizeRow(rawRow, codebook) {
  // ===== 基本キー（揺れ吸収） =====
  const boothId = asStr(pickFirst(rawRow, ["boothId", "booth_id", "ブースID", "booth"]));
  const labelId = asStr(pickFirst(rawRow, ["labelId", "label_id", "ラベルID", "label"]));
  const machineName = asStr(pickFirst(rawRow, ["machineName", "machine_name", "対応マシン名", "マシン名"]));

  const prizeName = asStr(pickFirst(rawRow, ["prizeName", "item_name", "prize_name", "景品名", "name"]));

  const sales = asNum(pickFirst(rawRow, ["sales", "総売上", "売上"]));
  const claw = asNum(pickFirst(rawRow, ["claw", "消化額", "cost", "原価"]));
  const consumeCount = asNum(pickFirst(rawRow, ["consume_count", "消化数", "count"]));

  const w = asNum(pickFirst(rawRow, ["w", "width", "幅"]));
  const d = asNum(pickFirst(rawRow, ["d", "depth", "奥行き"]));
  const updatedDate = asStr(pickFirst(rawRow, ["updated_date", "updatedDate", "更新日"]));

  // cost_rate が 0..1 / 0..100 / "8%" など揺れても 0..1 に寄せる
  const crRaw = pickFirst(rawRow, ["costRate01", "cost_rate", "cost_rate01", "原価率"]);
  let costRate01 = 0;
  if (typeof crRaw === "string" && crRaw.includes("%")) {
    costRate01 = asNum(crRaw.replace("%", "")) / 100;
  } else {
    const n = asNum(crRaw);
    costRate01 = n > 1 ? n / 100 : n;
  }
  if (!Number.isFinite(costRate01) || costRate01 < 0) costRate01 = 0;

  // ===== ここからフィルタ用（記号→ラベル） =====
  // decodeSymbol が返す “記号キー” はプロジェクト側の命名に合わせて拾う
  // 例：feeKey / fee_code / fee など、揺れそうな名前はここで吸収する

  const feeKey0 = asStr(pickFirst(rawRow, ["feeKey", "fee_key", "fee", "料金記号"]));
  const playsKey0 = asStr(pickFirst(rawRow, ["playsKey", "plays_key", "plays", "回数記号"]));
  const methodKey0 = asStr(pickFirst(rawRow, ["methodKey", "method_key", "method", "投入法記号"]));

  const claw3Key0 = asStr(pickFirst(rawRow, ["claw3Key", "claw3_key", "claw3", "3本爪記号"]));
  const claw2Key0 = asStr(pickFirst(rawRow, ["claw2Key", "claw2_key", "claw2", "2本爪記号"]));

  const prizeGenreKey0 = asStr(pickFirst(rawRow, ["prizeGenreKey", "prizeGenre_key", "prizeGenre", "景品ジャンル記号"]));
  const foodKey0 = asStr(pickFirst(rawRow, ["foodKey", "food_key", "food", "食品記号"]));
  const plushKey0 = asStr(pickFirst(rawRow, ["plushKey", "plush_key", "plush", "ぬいぐるみ記号"]));
  const goodsKey0 = asStr(pickFirst(rawRow, ["goodsKey", "goods_key", "goods", "雑貨記号"]));

  const targetKey0 = asStr(pickFirst(rawRow, ["targetKey", "target_key", "target", "ターゲット記号"]));
  const ageKey0 = asStr(pickFirst(rawRow, ["ageKey", "age_key", "age", "年代記号"]));

  const charaKey0 = asStr(pickFirst(rawRow, ["charaKey", "chara_key", "chara", "キャラ記号"]));
  const charaGenreKey0 = asStr(pickFirst(rawRow, ["charaGenreKey", "charaGenre_key", "charaGenre", "キャラジャンル記号"]));
  const nonCharaGenreKey0 = asStr(pickFirst(rawRow, ["nonCharaGenreKey", "nonCharaGenre_key", "nonCharaGenre", "ノンキャラジャンル記号"]));

  const movieKey0 = asStr(pickFirst(rawRow, ["movieKey", "movie_key", "movie", "映画記号"]));
  const reserveKey0 = asStr(pickFirst(rawRow, ["reserveKey", "reserve_key", "reserve", "予約記号"]));
  const wlKey0 = asStr(pickFirst(rawRow, ["wlKey", "wl_key", "wl", "WLオリジナル記号"]));

  // label 化（未定義なら空）
  const feeLabel0 = labelFrom(codebook, "fee", feeKey0);
  const playsLabel0 = labelFrom(codebook, "plays", playsKey0);
  const methodLabel0 = labelFrom(codebook, "method", methodKey0);

  const claw3Label0 = labelFrom(codebook, "claw3", claw3Key0);
  const claw2Label0 = labelFrom(codebook, "claw2", claw2Key0);

  const prizeGenreLabel0 = labelFrom(codebook, "prizeGenre", prizeGenreKey0);
  const foodLabel0 = labelFrom(codebook, "food", foodKey0);
  const plushLabel0 = labelFrom(codebook, "plush", plushKey0);
  const goodsLabel0 = labelFrom(codebook, "goods", goodsKey0);

  const targetLabel0 = labelFrom(codebook, "target", targetKey0);
  const ageLabel0 = labelFrom(codebook, "age", ageKey0);

  const charaLabel0 = labelFrom(codebook, "chara", charaKey0);
  const charaGenreLabel0 = labelFrom(codebook, "charaGenre", charaGenreKey0);
  const nonCharaGenreLabel0 = labelFrom(codebook, "nonCharaGenre", nonCharaGenreKey0);

  // “その他”ルール（空なら other/その他に落とす）
  const fee = ensureOther(feeKey0, feeLabel0);
  const plays = ensureOther(playsKey0, playsLabel0);
  const method = ensureOther(methodKey0, methodLabel0);

  const claw3 = ensureOther(claw3Key0, claw3Label0);
  const claw2 = ensureOther(claw2Key0, claw2Label0);

  // prizeGenre は "other" ではなく、空は空のままでも良いが、ここも統一するなら other に落とす
  const prizeGenre = ensureOther(prizeGenreKey0, prizeGenreLabel0);

  // サブジャンルは「空＝未該当」が自然なので other に落とさず空でOK、でも運用次第。
  // 今回は “見直し” をしやすいように空は空で保持し、表示側で空は非表示にできる。
  const foodKey = asStr(foodKey0);
  const plushKey = asStr(plushKey0);
  const goodsKey = asStr(goodsKey0);

  const foodLabel = foodKey ? (foodLabel0 || "その他") : "";
  const plushLabel = plushKey ? (plushLabel0 || "その他") : "";
  const goodsLabel = goodsKey ? (goodsLabel0 || "その他") : "";

  const target = ensureOther(targetKey0, targetLabel0);
  const age = ensureOther(ageKey0, ageLabel0);

  const chara = ensureOther(charaKey0, charaLabel0);
  const charaGenre = ensureOther(charaGenreKey0, charaGenreLabel0);
  const nonCharaGenre = ensureOther(nonCharaGenreKey0, nonCharaGenreLabel0);

  // フラグは boolean に確定
  const isMovie = boolFromMaruBatsu(codebook, "movie", movieKey0);
  const isReserve = boolFromMaruBatsu(codebook, "reserve", reserveKey0);
  const isWlOriginal = boolFromMaruBatsu(codebook, "wl", wlKey0);

  return {
    // ===== ID系 =====
    boothId,
    labelId,
    machineName,

    // ===== 表示/数値 =====
    prizeName,
    sales,
    claw,
    consumeCount,
    costRate01,
    w,
    d,
    updatedDate,

    // ===== フィルタ用（固定キー） =====
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
