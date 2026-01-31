// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

const AXES = [
  { key: "料金", label: "① 料金" },
  { key: "プレイ回数", label: "② プレイ回数" },
  { key: "投入法", label: "③ 投入法" },
  { key: "ジャンル", label: "④ 景品ジャンル" },
  { key: "ターゲット", label: "⑤ ターゲット" },
  { key: "年代", label: "⑥ 年代" },
  { key: "キャラ", label: "⑦ キャラ" },
  { key: "映画", label: "⑧ 映画" },
  { key: "予約", label: "⑨ 予約" },
  { key: "WLオリジナル", label: "⑩ WLオリジナル" },
];

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getOrInitState_(state) {
  if (!state) return { widget1Axis: "ジャンル" };
  if (!state.widget1Axis) state.widget1Axis = "ジャンル";
  return state;
}

function buildAgg_(rows, axisKey) {
  const map = new Map();

  for (const r of rows) {
    const k = String(r?.[axisKey] ?? "未分類");
    let o = map.get(k);
    if (!o) {
      o = { key: k, label: k, sales: 0, booths: new Set() };
      map.set(k, o);
    }
    o.sales += toNum(r?.sales);
    if (r?.booth_id != null) o.booths.add(String(r.booth_id));
  }

  const items = Array.from(map.values()).map(x => ({
    key: x.key,
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
    const r = totalSales ? (cum / totalSales) : 0;
    const rank = (r <= 0.7) ? "A" : (r <= 0.9) ? "B" : "C";
    return { rank, label: x.label, sales: x.sales };
  });
}

function ensureDom_(mount, actions, mode) {
  // 初回だけDOMを作る（以降は更新）
  if (mount.__w1_root) return mount.__w1_root;

  const root = el("div", { class: `widget1 widget1-${mode}` });

  const header = el("div", { class: "widget1Header" });
  const title = el("div", { class: "widget1Title", text: "売上 / ブース 構成比" });

  const left = el("div", { class: "widget1HeaderLeft" }, [title]);

  const btnExpand = el("button", {
    class: "btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  const selectWrap = el("div", { class: "widget1SelectWrap" });
  const select = el("select", { class: "widget1Select" });
  AXES.forEach(a => {
    select.appendChild(el("option", { value: a.key, text: a.label }));
  });
  selectWrap.appendChild(select);

  const right = el("div", { class: "widget1HeaderRight" }, []);
  if (mode === "normal") right.appendChild(btnExpand);
  right.appendChild(selectWrap);

  header.appendChild(left);
  header.appendChild(right);

  const body = el("div", { class: "widget1Body" });

  const chartWrap = el("div", { class: "widget1ChartWrap" });
  const canvas = el("canvas", { class: "widget1Canvas" });
  chartWrap.appendChild(canvas);

  const abcWrap = el("div", { class: "widget1ABC" });

  body.appendChild(chartWrap);
  body.appendChild(abcWrap);

  root.appendChild(header);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  // refs
  mount.__w1_root = root;
  mount.__w1_select = select;
  mount.__w1_canvas = canvas;
  mount.__w1_abc = abcWrap;

  // change handler（1回だけ）
  select.addEventListener("change", () => {
    const st = getOrInitState_(mount.__w1_state_ref || {});
    st.widget1Axis = select.value;
    // stateは外から渡されるので、描画要求だけ出す
    actions.requestRender?.();
  });

  return root;
}

function updateSelect_(mount, state) {
  const st = getOrInitState_(state);
  const sel = mount.__w1_select;
  if (!sel) return;
  if (sel.value !== st.widget1Axis) sel.value = st.widget1Axis;
}

function upsertChart_(mount, items, totalSales, totalBooths) {
  const Chart = window.Chart;
  const canvas = mount.__w1_canvas;
  if (!Chart || !canvas) return;

  const labels = items.map(x => x.label);
  const dataBooths = items.map(x => (totalBooths ? x.booths / totalBooths : 0));
  const dataSales = items.map(x => (totalSales ? x.sales / totalSales : 0));

  // 既存チャートがあれば更新、なければ作成
  if (!mount.__w1_chart) {
    mount.__w1_chart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            label: "ブース構成比",
            data: dataBooths,
            // 色はひとまず固定（後でテーマ色に寄せるならここを拡張）
            backgroundColor: "#93c5fd",
            radius: "55%",
          },
          {
            label: "売上構成比",
            data: dataSales,
            backgroundColor: "#2563eb",
            radius: "95%",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "40%",
        animation: false,          // ✅ チラつき停止
        resizeDelay: 80,           // ✅ resize暴れ抑制
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const i = ctx.dataIndex;
                const it = items[i];
                const yen = new Intl.NumberFormat("ja-JP").format(Math.round(it.sales));
                return `${it.label} / 売上 ${yen}円 / ブース ${it.booths}`;
              },
            },
          },
        },
      },
    });
    return;
  }

  const ch = mount.__w1_chart;
  ch.data.labels = labels;
  ch.data.datasets[0].data = dataBooths;
  ch.data.datasets[1].data = dataSales;
  ch.update("none"); // ✅ アニメなし更新
}

function renderABC_(mount, abcRows) {
  const box = mount.__w1_abc;
  if (!box) return;

  // 更新：一旦クリアして軽量再描画（件数多くないのでOK）
  clear(box);

  abcRows.forEach(r => {
    box.appendChild(
      el("div", { class: `widget1ABCRow rank-${r.rank}` }, [
        el("span", { class: "rank", text: r.rank }),
        el("span", { class: "label", text: r.label }),
        el("span", { class: "value", text: `${Math.round(r.sales).toLocaleString()}円` }),
      ])
    );
  });
}

export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;
  const mode = opts.mode || "normal";

  // DOM確保（初回だけ作る）
  ensureDom_(mount, actions, mode);

  // state参照を保持（select change handler用）
  mount.__w1_state_ref = state;

  const st = getOrInitState_(state);
  updateSelect_(mount, st);

  const rows = Array.isArray(st.filteredRows) ? st.filteredRows : [];
  const { items, totalSales, totalBooths } = buildAgg_(rows, st.widget1Axis);

  // chart
  upsertChart_(mount, items, totalSales, totalBooths);

  // ABC
  const abc = buildABC_(items, totalSales);
  renderABC_(mount, abc);
}
