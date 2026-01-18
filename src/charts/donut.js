// src/charts/donut.js
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, text = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    n.setAttribute(k, String(v));
  }
  if (text != null) n.textContent = String(text);
  return n;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * Math.PI / 180.0;
  return { x: cx + (r * Math.cos(a)), y: cy + (r * Math.sin(a)) };
}

function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const endOuter   = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, startAngle);
  const endInner   = polarToCartesian(cx, cy, rInner, endAngle);

  const sweep = Math.max(0.0001, endAngle - startAngle);
  const largeArc = sweep <= 180 ? "0" : "1";

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    "Z"
  ].join(" ");
}

// valueが [0..1] でも [0..100]（%）でも対応
function normalizeValues(values) {
  const raw = values.map(v => Math.max(0, Number(v?.value) || 0));
  const sum = raw.reduce((a, b) => a + b, 0);

  // もし合計が 1.5 を超えるなら「% or 実数」扱いでそのまま
  // もし合計が 1.5 以下なら「比率」扱い（そのままでもOK）
  // => 結局 total は sum で良いが、ここは “全部0に見える”事故を避けるための保険
  return { raw, total: sum };
}

export function renderDonut(container, opts) {
  clear(container);

  const size = 170;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 74;
  const rInner = 48;

  const values = Array.isArray(opts?.values) ? opts.values : [];
  const { raw, total } = normalizeValues(values);

  const svg = svgEl("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-label": opts?.title ?? "",
    style: "display:block; overflow:visible;"
  });

  // 背景リング
  svg.appendChild(svgEl("circle", {
    cx, cy, r: rOuter,
    fill: "none",
    stroke: "rgba(34,49,66,.65)",
    "stroke-width": (rOuter - rInner),
  }));

  if (!total || !isFinite(total)) {
    svg.appendChild(svgEl("text", {
      x: cx,
      y: cy + 4,
      "text-anchor": "middle",
      fill: "rgba(159,176,194,.95)",
      "font-size": 12,
      "font-weight": 800,
    }, "データなし"));
    container.appendChild(svg);
    return;
  }

  // セグメント色のフォールバック（seg.colorが無い場合）
  const fallback = ["#6dd3fb", "#7ee081", "#f2c14e", "#b28dff", "#ff6b6b"];

  // 極小でも見える最小角（度）
  const MIN_ANGLE = 2.0;

  // gap（隙間）は小さめ
  const GAP = 1.2;

  // 角度配分を一旦作る（MIN_ANGLE適用）
  const angles = raw.map(v => (v / total) * 360);
  const nonZeroIdx = angles.map((a, i) => a > 0 ? i : -1).filter(i => i >= 0);

  // MIN_ANGLE以下を底上げして、総角度を360に再調整
  let boosted = angles.slice();
  let need = 0;
  for (const i of nonZeroIdx) {
    if (boosted[i] < MIN_ANGLE) {
      need += (MIN_ANGLE - boosted[i]);
      boosted[i] = MIN_ANGLE;
    }
  }
  if (need > 0) {
    // 底上げ分を他から比例配分で引く
    const bigIdx = nonZeroIdx.filter(i => boosted[i] > MIN_ANGLE);
    const bigSum = bigIdx.reduce((a, i) => a + (boosted[i] - MIN_ANGLE), 0);
    if (bigSum > 0) {
      for (const i of bigIdx) {
        const take = need * ((boosted[i] - MIN_ANGLE) / bigSum);
        boosted[i] = Math.max(MIN_ANGLE, boosted[i] - take);
      }
    }
  }

  let angle = 0;

  for (let idx = 0; idx < values.length; idx++) {
    const seg = values[idx];
    const sweep = boosted[idx];
    if (!sweep || sweep <= 0) continue;

    const start = angle + GAP / 2;
    const end = angle + sweep - GAP / 2;
    angle += sweep;

    const safeEnd = Math.max(end, start + 0.6);

    const path = svgEl("path", {
      d: arcPath(cx, cy, rOuter, rInner, start, safeEnd),
      fill: seg?.color || fallback[idx % fallback.length],
      opacity: (opts?.pickedKey && opts.pickedKey !== seg?.key) ? 0.30 : 0.95,
      stroke: "rgba(10,15,20,.65)",
      "stroke-width": 1,
      style: "cursor:pointer;"
    });

    path.addEventListener("click", (e) => {
      e.preventDefault();
      const next = (opts?.pickedKey === seg?.key) ? null : seg?.key;
      opts?.onPick?.(next);
    });

    svg.appendChild(path);
  }

  // 中央ラベル
  svg.appendChild(svgEl("text", {
    x: cx,
    y: cy - 2,
    "text-anchor": "middle",
    fill: "rgba(232,238,246,.95)",
    "font-size": 12,
    "font-weight": 800,
  }, opts?.title ?? ""));

  svg.appendChild(svgEl("text", {
    x: cx,
    y: cy + 16,
    "text-anchor": "middle",
    fill: "rgba(159,176,194,.95)",
    "font-size": 11,
    "font-weight": 700,
  }, "クリックで強調"));

  container.appendChild(svg);
}
