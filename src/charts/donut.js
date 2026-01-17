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

  const largeArc = (endAngle - startAngle) <= 180 ? "0" : "1";

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

  const total = opts.values.reduce((a, b) => a + (b.value || 0), 0) || 1;

  const svg = el("svg", {
    width: String(size),
    height: String(size),
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-label": opts.title,
  });

  // background ring
  const bg = el("circle", {
    cx: String(cx), cy: String(cy), r: String(rOuter),
    fill: "none",
    stroke: "rgba(34,49,66,.65)",
    "stroke-width": String(rOuter - rInner),
  });
  svg.appendChild(bg);

  let angle = 0;
  const gap = 1.2; // degrees
  for (const seg of opts.values) {
    const v = Math.max(0, seg.value || 0);
    const pct = v / total;
    const sweep = Math.max(0.001, pct * 360);

    const start = angle + gap / 2;
    const end   = angle + sweep - gap / 2;

    angle += sweep;

    if (end <= start) continue;

    const path = el("path", {
      d: arcPath(cx, cy, rOuter, rInner, start, end),
      fill: seg.color || "rgba(160,174,192,.9)",
      opacity: (opts.pickedKey && opts.pickedKey !== seg.key) ? "0.35" : "0.95",
      cursor: "pointer",
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
