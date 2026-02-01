// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/* =========================
   設定
   ========================= */

const AXES = [
  { key: "料金", label: "① 料金" },
  { key: "プレイ回数", label: "② プレイ回数" },
  { key: "投入法", label: "③ 投入法" },
  { key: "景品ジャンル", label: "④ 景品ジャンル" },
  { key: "ターゲット", label: "⑤ ターゲット" },
  { key: "年代", label: "⑥ 年代" },
  { key: "キャラ", label: "⑦ キャラ" },
  { key: "映画", label: "⑧ 映画" },
  { key: "予約", label: "⑨ 予約" },
  { key: "WLオリジナル", label: "⑩ WLオリジナル" },
];

const DEFAULT_AXIS = "景品ジャンル";

/* =========================
   util
   ========================= */

function toNumLoose(v) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function pickFirst_(row, keys, fallback = null) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function buildPalette_(labels) {
  const n = Math.max(1, labels.length);
  const outer = [];
  const inner = [];

  for (let i = 0; i < n; i++) {
    const label = labels[i];

    if (label === "未分類") {
      outer.push("rgba(148,163,184,.95)");
      inner.push("rgba(148,163,184,.35)");
      continue;
    }

    const hue = Math.round((360 * i) / n);
    outer.push(`hsla(${hue}, 85%, 55%, .95)`);
    inner.push(`hsla(${hue}, 85%, 55%, .35)`);
  }
  return { outer, inner };
}

function getOrInitState_(state) {
  if (!state) return { widget1Axis: DEFAULT_AXIS };
  if (!state.widget1Axis) state.widget1Axis = DEFAULT_AXIS;
  return state;
}

/* =========================
   集計
   - 売上：総売上
   - 台数：distinct(ブースID)
   ========================= */

function buildAgg_(rows, axisKey) {
  const map = new Map();

  for (const r of rows) {
    const axisRaw = pickFirst_(r, [axisKey], "未分類");
    const axisVal = String(axisRaw ?? "未分類").trim() || "未分類";

    const salesRaw = pickFirst_(r, ["総売上", "売上", "sales"], 0);
    const sales = toNumLoose(salesRaw);

    const boothRaw = pickFirst_(r, ["ブースID", "booth_id"], null);
    const boothId = boothRaw != null ? String(boothRaw).trim() : null;

    let o = map.get(axisVal);
    if (!o) {
      o = { label: axisVal, sales: 0, booths: new Set() };
      map.set(axisVal, o);
    }

    o.sales += sales;
    if (boothId) o.booths.add(boothId);
  }

  const items = Array.from(map.values()).map(x => ({
    label: x.label,
    sales: x.sales,
    booths: x.booths.size,
  }));

  items.sort((a, b) => b.sales - a.sales);

  const totalSales = items.reduce((a, x) => a + x.sales, 0);
  const totalBooths = items.reduce((a, x) => a + x.booths, 0);

  return { items, totalSales, totalBooths };
}

function buildABC_(items, totalSales) {
  let cum = 0;
  return items.map(x => {
    cum += x.sales;
    const r = totalSales ? cum / totalSales : 0;
    const rank = (r <= 0.7) ? "A" : (r <= 0.9) ? "B" : "C";
    return { rank, label: x.label, sales: x.sales };
  });
}

/* =========================
   DOM生成
   ========================= */

function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return;

  const root = el("div", { class: "w1 card" });

  const title = el("div", { class: "w1-title", text: "" });

  const select = el("select", { class: "w1-axis" });
  AXES.forEach(a => select.appendChild(el("option", { value: a.key, text: a.label })));

  const btnExpand = el("button", {
    class: "w1-btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("widget1"),
  });

  const head = el("div", { class: "w1-head" }, [
    title,
    el("div", { class: "w1-headRight" }, [
      mode === "normal" ? btnExpand : null,
      select,
    ].filter(Boolean)),
  ]);

  const canvas = el("canvas");
  const left = el("div", { class: "w1-left" }, [canvas]);
  const list = el("div", { class: "w1-list" });
  const note = el("div", { class: "w1-note" });

  const body = el("div", { class: "w1-body" }, [
    left,
    el("div", { class: "w1-right" }, [list, note]),
  ]);

  root.appendChild(head);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_canvas = canvas;
  mount.__w1_list = list;
  mount.__w1_note = note;

  select.addEventListener("change", () => {
    mount.__w1_state_ref.widget1Axis = select.value;
    actions.requestRender?.();
  });
}

/* =========================
   Chart.js
   ========================= */

function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  if (!Chart) return;

  const labels = items.map(x => x.label);
  const dataBooths = items.map(x => totalBooths ? x.booths / totalBooths : 0);
  const dataSales  = items.map(x => totalSales  ? x.sales  / totalSales  : 0);

  const palette = buildPalette_(labels);

  if (!mount.__w1_chart) {
    mount.__w1_chart = new Chart(mount.__w1_canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            label: "マシン構成比",
            data: dataBooths,
            backgroundColor: palette.inner,
            radius: "55%",
          },
          {
            label: "売上構成比",
            data: dataSales,
            backgroundColor: palette.outer,
            radius: "95%",
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: "40%",
      },
    });
  } else {
    const ch = mount.__w1_chart;
    ch.data.labels = labels;
    ch.data.datasets[0].data = dataBooths;
    ch.data.datasets[1].data = dataSales;
    ch.data.datasets[0].backgroundColor = palette.inner;
    ch.data.datasets[1].backgroundColor = palette.outer;
    ch.update("none");
  }

  mount.__w1_colors = palette.outer;
}

/* =========================
   凡例
   ========================= */

function renderABC_(mount, abc) {
  const box = mount.__w1_list;
  clear(box);

  const colors = mount.__w1_colors || [];

  abc.forEach((r, i) => {
    const sw = el("span", { class: "w1-chip" });
    if (colors[i]) sw.style.setProperty("--c", colors[i]);

    box.appendChild(
      el("div", { class: `w1-row rank-${r.rank}` }, [
        sw,
        el("span", { class: "w1-name", text: `${r.rank} ${r.label}` }),
        el("span", { class: "w1-v", text: `${Math.round(r.sales).toLocaleString()}円` }),
      ])
    );
  });
}

/* =========================
   エントリポイント
   ========================= */

export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;
  const mode = opts.mode || "normal";

  ensureDom_(mount, actions, mode);
  mount.__w1_state_ref = state;

  const st = getOrInitState_(state);
  mount.__w1_select.value = st.widget1Axis;

  mount.__w1_title.textContent =
    `${st.widget1Axis}別 売上 / マシン構成比`;

  const rows = Array.isArray(st.filteredRows) ? st.filteredRows : [];
  const { items, totalSales, totalBooths } = buildAgg_(rows, st.widget1Axis);

  upsertChart_(mount, items, totalSales, totalBooths);

  const abc = buildABC_(items, totalSales);
  renderABC_(mount, abc);

  mount.__w1_note.textContent =
    `台数は 1ステーション（ブースID）単位で集計（合計 ${totalBooths}）`;
}
