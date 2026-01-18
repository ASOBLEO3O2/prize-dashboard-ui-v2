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

  // ✅ ここが“壊さずに必ず出す”肝
  // 親のCSSで高さ0 / overflow hidden になっても、ここで描画領域を強制する
  try {
    container.style.minWidth = "170px";
    container.style.minHeight = "170px";
    container.style.width = container.style.width || "170px";
    container.style.height = container.style.height || "170px";
    container.style.display = container.style.display || "flex";
    container.style.alignItems = container.style.alignItems || "center";
    container.style.justifyContent = container.style.justifyContent || "center";
    container.style.overflow = "visible";
  } catch (_) {
    // styleが触れない環境でも描画自体は続ける
  }

  clear(container);

  const size = 170;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 74;
  const rInner = 48;

  const total = (opts.values || []).reduce((a, b) => a + (Number(b.value) || 0), 0);

  const svg = el("svg", {
    width: String(size),
    height: String(size),
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-label": opts.title,
    style: "display:block; overflow:visible;",
  });

  // 背景リング
  svg.appendChild(el("circle", {
    cx: String(cx), cy: String(cy), r: String(rOuter),
    fill: "none",
    stroke: "rgba(34,49,66,.65)",
    "stroke-width": String(rOuter - rInner),
  }));

  // total=0 のときは “空” 表示
  if (!total) {
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

    // 小さいセグメントでも消えないように gap を動的に
    const dynamicGap = Math.min(2.0, Math.max(0.2, sweep * 0.15)); // 0.2〜2deg
    const start = angle + dynamicGap / 2;
    const end   = angle + sweep - dynamicGap / 2;

    angle += sweep;

    // sweepが極小でも最低限見えるようにする
    const safeEnd = Math.max(end, start + 0.6);

    const path = el("path", {
      d: arcPath(cx, cy, rOuter, rInner, start, safeEnd),
      fill: seg.color || "rgba(160,174,192,.9)",
      opacity: (opts.pickedKey && opts.pickedKey !== seg.key) ? "0.30" : "0.95",
      cursor: "pointer",
      stroke: "rgba(10,15,20_toggle,.65)",
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
