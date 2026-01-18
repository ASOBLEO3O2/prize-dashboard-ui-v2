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

  // 描画領域を“ここだけ”確保（UIを壊さない範囲で最小）
  container.style.minWidth = "170px";
  container.style.minHeight = "170px";
  container.style.overflow = "visible";

  clear(container);

  const size = 170;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 74;
  const rInner = 48;

  const values = Array.isArray(opts?.values) ? opts.values : [];
  const total = values.reduce((a, b) => a + (Number(b?.value) || 0), 0);

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

  if (!total) {
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

  let angle = 0;

  for (const seg of values) {
    const v = Math.max(0, Number(seg?.value) || 0);
    const sweep = (v / total) * 360;

    // 小さすぎるセグメントでも消えないように調整
    const gap = Math.min(2.0, Math.max(0.2, sweep * 0.15));
    const start = angle + gap / 2;
    const end   = angle + sweep - gap / 2;
    angle += sweep;

    const safeEnd = Math.max(end, start + 0.6);

    const path = svgEl("path", {
      d: arcPath(cx, cy, rOuter, rInner, start, safeEnd),
      fill: seg?.color || "rgba(160,174,192,.9)",
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
