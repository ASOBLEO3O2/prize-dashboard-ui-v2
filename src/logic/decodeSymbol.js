// src/logic/decodeSymbol.js
const safe = (v) => (v == null) ? "" : String(v).trim();

/**
 * symbol_raw（13文字）を codebook でラベル化して返す
 * 例: 112F1B2D2B222
 */
export function decodeSymbol(symbol, codebook) {
  const s = safe(symbol);
  if (!s || s.length < 13) return {}; // 変な値は無視

  // 1〜3
  const feeCode = s[0];
  const playsCode = s[1];
  const methodCode = s[2];

  // 4: 投入法詳細（3本爪/2本爪で辞書が違う）
  const methodDetailCode = s[3];

  // 5-6: 景品ジャンル + 子ジャンル
  const genreCode = s[4];
  const subCode = s[5];

  // 7-8: ターゲット + 年代
  const targetCode = s[6];
  const ageCode = s[7];

  // 9-10: キャラ種別 + 子
  const charaCode = s[8];
  const charaSubCode = s[9];

  // 11-13: フラグ（映画/予約/WL）
  const movieCode = s[10];
  const reserveCode = s[11];
  const wlCode = s[12];

  const cb = codebook || {};

  const fee = cb.fee?.[feeCode] || "";
  const plays = cb.plays?.[playsCode] || "";
  const method = cb.method?.[methodCode] || "";

  const claw3 = (methodCode === "3") ? (cb.claw3?.[methodDetailCode] || "") : "";
  const claw2 = (methodCode === "2") ? (cb.claw2?.[methodDetailCode] || "") : "";

  const prizeGenre = cb.prizeGenre?.[genreCode] || "";

  // 子ジャンルは親ジャンルで辞書が変わる（1=食品,2=ぬいぐるみ,3=雑貨）
  let food = "", plush = "", goods = "";
  if (genreCode === "1") food = cb.food?.[subCode] || "";
  if (genreCode === "2") plush = cb.plush?.[subCode] || "";
  if (genreCode === "3") goods = cb.goods?.[subCode] || "";

  const target = cb.target?.[targetCode] || "";
  const age = cb.age?.[ageCode] || "";

  const chara = cb.chara?.[charaCode] || "";
  const charaGenre = (charaCode === "1") ? (cb.charaGenre?.[charaSubCode] || "") : "";
  const nonCharaGenre = (charaCode === "2") ? (cb.nonCharaGenre?.[charaSubCode] || "") : "";

  const movie = cb.movie?.[movieCode] || "";
  const reserve = cb.reserve?.[reserveCode] || "";
  const wl = cb.wl?.[wlCode] || "";

  // 既存の byAxis.js が見る「列名」に合わせて返す
  return {
    "料金": fee, "料金_code": feeCode,
    "回数": plays, "回数_code": playsCode,
    "投入法": method, "投入法_code": methodCode,
    "3本爪": claw3, "3本爪_code": (methodCode === "3") ? methodDetailCode : "",
    "2本爪": claw2, "2本爪_code": (methodCode === "2") ? methodDetailCode : "",
    "景品ジャンル": prizeGenre, "景品ジャンル_code": genreCode,
    "食品ジャンル": food, "食品ジャンル_code": (genreCode === "1") ? subCode : "",
    "ぬいぐるみジャンル": plush, "ぬいぐるみジャンル_code": (genreCode === "2") ? subCode : "",
    "雑貨ジャンル": goods, "雑貨ジャンル_code": (genreCode === "3") ? subCode : "",
    "ターゲット": target, "ターゲット_code": targetCode,
    "年代": age, "年代_code": ageCode,
    "キャラ": chara, "キャラ_code": charaCode,
    "キャラジャンル": charaGenre, "キャラジャンル_code": (charaCode === "1") ? charaSubCode : "",
    "ノンキャラジャンル": nonCharaGenre, "ノンキャラジャンル_code": (charaCode === "2") ? charaSubCode : "",
    "映画": movie, "映画_code": movieCode,
    "予約": reserve, "予約_code": reserveCode,
    "WLオリジナル": wl, "WLオリジナル_code": wlCode,
  };
}
