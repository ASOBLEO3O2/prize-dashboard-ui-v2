// src/logic/palette.js

// 見づらい同系濃淡を避ける：色相を回す（ダーク背景前提）
export function buildPalette(labels) {
  const out = [];
  const n = Math.max(1, labels.length);

  for (let i = 0; i < n; i++) {
    const label = labels[i];

    // 未分類は固定グレー
    if (label === "未分類") {
      out.push("rgba(148,163,184,0.95)"); // slate-ish
      continue;
    }

    // HSLで色相を分散（見分けやすさ優先）
    const hue = Math.round((360 * i) / n);
    const sat = 85;
    const light = 55;
    out.push(`hsl(${hue} ${sat}% ${light}%)`);
  }

  return out;
}
