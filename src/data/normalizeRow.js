// src/data/normalizeRow.js
// 入口で1回だけ正規化（B案）
// - 列名揺れ吸収
// - 固定キー（boothId / labelId / machineName）
// - 数値化（sales / claw / costRate01）
// - genreKey / genreLabel を確定（取れなければ other/その他）

import { GENRES } from "../constants.js";

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

function resolveGenreKey(row) {
  // 1) 既に genreKey があればそれを優先
  const gk = asStr(pickFirst(row, ["genreKey", "genre_key", "genre"]));
  if (gk) return gk;

  // 2) ラベル（"食品" 等）から GENRES を逆引き
  const gl = asStr(
    pickFirst(row, ["genreLabel", "genre_label", "ジャンル", "景品ジャンル", "genre_label_jp"])
  );
  if (gl) {
    const found = (Array.isArray(GENRES) ? GENRES : []).find(
      (x) => asStr(x?.label) === gl
    );
    if (found?.key) return String(found.key);
  }

  // 3) 取れなければ other に落とす（運用で見直し）
  return "other";
}

function resolveGenreLabel(genreKey) {
  const found = (Array.isArray(GENRES) ? GENRES : []).find(
    (x) => String(x?.key) === String(genreKey)
  );
  if (found?.label) return String(found.label);
  if (String(genreKey) === "other") return "その他";
  return "";
}

/**
 * normalizeRow(rawRow) -> 固定キーに変換
 * - boothId, labelId, machineName
 * - prizeName, genreKey, genreLabel
 * - sales, claw, costRate01（0..1）
 * - _raw
 */
export function normalizeRow(rawRow) {
  const boothId = asStr(pickFirst(rawRow, ["boothId", "booth_id", "ブースID", "booth"]));
  const labelId = asStr(pickFirst(rawRow, ["labelId", "label_id", "ラベルID", "label"]));
  const machineName = asStr(
    pickFirst(rawRow, ["machineName", "machine_name", "対応マシン名", "マシン名"])
  );

  const prizeName = asStr(pickFirst(rawRow, ["prizeName", "prize_name", "景品名", "name"]));

  const genreKey = resolveGenreKey(rawRow);

  const genreLabel =
    resolveGenreLabel(genreKey) ||
    asStr(pickFirst(rawRow, ["genreLabel", "genre_label", "ジャンル", "景品ジャンル"])) ||
    (genreKey === "other" ? "その他" : "");

  const sales = asNum(pickFirst(rawRow, ["sales", "総売上", "売上"]));
  const claw = asNum(pickFirst(rawRow, ["claw", "消化額", "cost", "原価"]));

  // cost_rate が 0..1 / 0..100 / "8%" など揺れても 0..1 に寄せる
  const crRaw = pickFirst(rawRow, ["costRate01", "cost_rate", "原価率"]);
  let costRate01 = 0;
  if (typeof crRaw === "string" && crRaw.includes("%")) {
    costRate01 = asNum(crRaw.replace("%", "")) / 100;
  } else {
    const n = asNum(crRaw);
    costRate01 = n > 1 ? n / 100 : n; // 8 → 0.08, 0.08 → 0.08
  }
  if (!Number.isFinite(costRate01) || costRate01 < 0) costRate01 = 0;

  return {
    boothId,
    labelId,
    machineName,

    prizeName,
    genreKey,
    genreLabel,

    sales,
    claw,
    costRate01,

    _raw: rawRow,
  };
}

/**
 * uniqueOptions(normRows, field, { includeEmpty=false }?)
 */
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
