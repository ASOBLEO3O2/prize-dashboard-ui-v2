// src/logic/filter.js
// B案：正規化済み normRows の固定キーだけを見るフィルタ
// 上層→下層（親子）フィルタに対応

function asStr(v) {
  return String(v ?? "").trim();
}

function hasAny(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

function inSet(value, setArr) {
  if (!hasAny(setArr)) return true; // 指定なしなら通す
  return setArr.includes(value);
}

function flagMatch(rowBool, want) {
  // want: null(指定なし) / true / false
  if (want == null) return true;
  return !!rowBool === !!want;
}

export function applyFilters(normRows, filters) {
  const f = filters || {};

  const machineNames = Array.isArray(f.machineNames) ? f.machineNames : [];
  const feeKeys = Array.isArray(f.feeKeys) ? f.feeKeys : [];

  const prizeGenreKey = asStr(f.prizeGenreKey);
  const subGenreKey = asStr(f.subGenreKey);

  const charaKey = asStr(f.charaKey);
  const charaSubKey = asStr(f.charaSubKey);

  const flags = f.flags || {};
  const wantMovie = flags.movie ?? null;
  const wantReserve = flags.reserve ?? null;
  const wantWl = flags.wl ?? null;

  return (normRows || []).filter((r) => {
    // ===== 単純（複数選択）=====
    if (!inSet(r.machineName, machineNames)) return false;
    if (!inSet(r.feeKey, feeKeys)) return false;

    // ===== フラグ =====
    if (!flagMatch(r.isMovie, wantMovie)) return false;
    if (!flagMatch(r.isReserve, wantReserve)) return false;
    if (!flagMatch(r.isWlOriginal, wantWl)) return false;

    // ===== 上層→下層：景品ジャンル =====
    // prizeGenreKey が空なら指定なし
    if (prizeGenreKey) {
      if (asStr(r.prizeGenreKey) !== prizeGenreKey) return false;

      // 下層は、親ジャンルに応じて参照列が変わる
      if (subGenreKey) {
        if (prizeGenreKey === "1") {
          // 食品
          if (asStr(r.foodKey) !== subGenreKey) return false;
        } else if (prizeGenreKey === "2") {
          // ぬい
          if (asStr(r.plushKey) !== subGenreKey) return false;
        } else if (prizeGenreKey === "3") {
          // 雑貨
          if (asStr(r.goodsKey) !== subGenreKey) return false;
        } else {
          // other の場合は下層無視（矛盾回避）
        }
      }
    }

    // ===== 上層→下層：キャラ =====
    if (charaKey) {
      if (asStr(r.charaKey) !== charaKey) return false;

      if (charaSubKey) {
        if (charaKey === "1") {
          // キャラ → charaGenreKey
          if (asStr(r.charaGenreKey) !== charaSubKey) return false;
        } else if (charaKey === "2") {
          // ノンキャラ → nonCharaGenreKey
          if (asStr(r.nonCharaGenreKey) !== charaSubKey) return false;
        } else {
          // other の場合は下層無視
        }
      }
    }

    return true;
  });
}
