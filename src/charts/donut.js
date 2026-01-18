import { el, clear } from "../utils/dom.js";

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * Math.PI / 180.0;
  return { x: cx + (r * Math.cos(a)), y: cy + (r * Math.sin(a)) };
}

function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const endOuter   = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, startAngle);
  const endInner   = polarToCartesian(cx, cy, rInner, endAngle);

  const sweep = endAngle - startAngle;
  const largeArc = sweep <= 180 ? "0" : "1";

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    "Z"
  ].join(" ");
}

export function renderDonut(container, opts) {
  // opts: { title, values: [{key,label,value,color}], onPick(key|null), pickedKey }
  clear(container);

  const size = 170;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 74;
  const rInner = 48;

  const total = opts.values.reduce((a, b) => a + (Number(b.value) || 0), 0);

  const svg = el("svg", {
    width: String(size),
    height: String(size),
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-label": opts.title,
    style: "display:block; overflow:visible;"
  });

  // 背景リング
  svg.appendChild(el("circle", {
    cx: String(cx), cy: String(cy), r: String(rOuter),
    fill: "none",
    stroke: "rgba(34,49,66,.65)",
    "stroke-width": String(rOuter - rInner),
  }));

  // total=0 のときは “空” 表示（描画が消えないようにする）
  if (!total) {
    // center label
    svg.appendChild(el("text", {
      x: String(cx),
      y: String(cy + 4),
      "text-anchor": "middle",
      fill: "rgba(159,176,194,.95)",
      "font-size": "12",
      "font-weight": "800",
    }, ["データなし"]));
    container.appendChild(svg);
    return;
  }

  let angle = 0;

  for (const seg of opts.values) {
    const v = Math.max(0, Number(seg.value) || 0);
    const pct = v / total;
    const sweep = pct * 360;

    // 小さすぎるセグメントで gap が勝って消える問題を根絶
    const dynamicGap = Math.min(2.0, Math.max(0.2, sweep * 0.15)); // sweepに応じて0.2〜2deg
    const start = angle + dynamicGap / 2;
    const end   = angle + sweep - dynamicGap / 2;

    angle += sweep;

    // sweepが極小でも最低限見えるようにする
    const safeStart = start;
    const safeEnd = Math.max(end, start + 0.6); // 最低0.6deg

    const path = el("path", {
      d: arcPath(cx, cy, rOuter, rInner, safeStart, safeEnd),
      fill: seg.color || "rgba(160,174,192,.9)",
      // “pickedKey がある時は薄く” を維持
      opacity: (opts.pickedKey && opts.pickedKey !== seg.key) ? "0.30" : "0.95",
      cursor: "pointer",
      // 視認性を強制（背景に溶けるケース対策）
      stroke: "rgba(10,15,20,.65)",
      "stroke-width": "1",
    });

    path.addEventListener("click", (e) => {
      e.preventDefault();
      const next = (opts.pickedKey === seg.key) ? null : seg.key;
      opts.onPick?.(next);
    });

    svg.appendChild(path);
  }

  // center label
  const center = el("g", {});
  center.appendChild(el("text", {
    x: String(cx),
    y: String(cy - 2),
    "text-anchor": "middle",
    fill: "rgba(232,238,246,.95)",
    "font-size": "12",
    "font-weight": "800",
  }, [opts.title]));
  center.appendChild(el("text", {
    x: String(cx),
    y: String(cy + 16),
    "text-anchor": "middle",
    fill: "rgba(159,176,194,.95)",
    "font-size": "11",
    "font-weight": "700",
  }, ["クリックで強調"]));
  svg.appendChild(center);

  container.appendChild(svg);
}
