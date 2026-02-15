// src/logic/costBins.js
export const COST_BINS = [
  { key: "b0_10",  label: "0–10%"  },
  { key: "b11_25", label: "11–25%" },
  { key: "b26_32", label: "26–32%" },
  { key: "b33_40", label: "33–40%" },
  { key: "b40p",   label: "40%〜"  },
];

// rate01: 0.31 みたいな「割合」
export function pickCostBinIndex(rate01) {
  const r = Number(rate01);
  if (!Number.isFinite(r) || r < 0) return -1;

  // ①0–10%（<=10）
  // ②11–25%（>10 && <=25）
  // ③26–32%（>25 && <=32）
  // ④33–40%（>32 && <40）
  // ⑤40%〜（>=40）
  if (r <= 0.10) return 0;
  if (r <= 0.25) return 1;
  if (r <= 0.32) return 2;
  if (r <  0.40) return 3;
  return 4;
}
