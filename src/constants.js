export const GENRES = [
  { key: "雑貨", label: "雑貨" },
  { key: "ぬいぐるみ", label: "ぬいぐるみ" },
  { key: "食品", label: "食品" },
  { key: "未分類", label: "未分類" },
];

export const DONUT_COLORS = {
  "雑貨": "#6dd3fb",
  "ぬいぐるみ": "#7ee081",
  "食品": "#ffd166",
  "未分類": "#a0aec0",
};

// Step A: モック値（フィルタで将来変わる前提）
export const MOCK = {
  updatedDate: "2026-01-17",
  topKpi: {
    sales: 1493500,
    consume: 612000,
    costRate: 0.451,
    avg: 5350, // 仮：売上/台 など（中身は後で）
  },
  // ジャンル別（カード用）
  byGenre: {
    "雑貨":   { machines: 46, sales: 620000, consume: 238000, costRate: 0.423, salesShare: 0.415, machineShare: 0.356 },
    "ぬいぐるみ": { machines: 52, sales: 520000, consume: 265000, costRate: 0.560, salesShare: 0.348, machineShare: 0.403 },
    "食品":   { machines: 26, sales: 300000, consume: 90000,  costRate: 0.330, salesShare: 0.201, machineShare: 0.201 },
    "未分類": { machines: 6,  sales: 53500,  consume: 19000,  costRate: 0.391, salesShare: 0.036, machineShare: 0.046 },
  },
  // 詳細（カードクリックで展開するテーブルのモック）
  details: {
    "雑貨": [
      { machine: "UFO9セカンド(01)左", item: "雑貨A", sales: 42000, consume: 18000, count: 120, costRate: 0.471, date: "2026-01-17" },
      { machine: "ジェミニ80α(03)右", item: "雑貨B", sales: 38000, consume: 12000, count: 98,  costRate: 0.347, date: "2026-01-17" },
      { machine: "トリプルセカンド(02)", item: "雑貨C", sales: 31000, consume: 9000,  count: 85,  costRate: 0.319, date: "2026-01-17" },
    ],
    "ぬいぐるみ": [
      { machine: "UFO9セカンド(02)右", item: "ぬいA", sales: 50000, consume: 29000, count: 140, costRate: 0.638, date: "2026-01-17" },
      { machine: "ジェミニ80α(01)左", item: "ぬいB", sales: 42000, consume: 22000, count: 112, costRate: 0.577, date: "2026-01-17" },
    ],
    "食品": [
      { machine: "UFO9セカンド(03)左", item: "食品A", sales: 28000, consume: 6000,  count: 76,  costRate: 0.236, date: "2026-01-17" },
      { machine: "トリプルセカンド(01)", item: "食品B", sales: 24000, consume: 9000,  count: 62,  costRate: 0.413, date: "2026-01-17" },
    ],
    "未分類": [
      { machine: "不明(00)", item: "未分類A", sales: 12000, consume: 4000, count: 30, costRate: 0.367, date: "2026-01-17" },
    ],
  },
};
