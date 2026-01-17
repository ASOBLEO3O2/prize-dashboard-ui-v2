export const fmtYen = (n) => {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("ja-JP").format(Math.round(n)) + "円";
};

export const fmtPct = (v, digits = 1) => {
  if (v == null || Number.isNaN(v)) return "—";
  return (v * 100).toFixed(digits) + "%";
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  // 2026-01-17 → 2026/01/17
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[1]}/${m[2]}/${m[3]}`;
};
