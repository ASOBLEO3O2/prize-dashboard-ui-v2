// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

/**
 * ウィジェット①：売上 / ブース 構成比（2重ドーナツ）
 * - 外：売上構成比
 * - 内：ブースIDユニーク数 構成比
 * - mode: "normal" | "expanded"
 */
export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;
  const mode = opts.mode || "normal";

  clear(mount);

  const axisKeys = [
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

  const currentAxis = state.widget1Axis || "ジャンル";

  /* =========================
   * ヘッダー
   * ========================= */
  const header = el("div", { class: "widget1Header" }, [
    el("div", { class: "widget1Title", text: "売上 / ブース 構成比" }),
  ]);

  if (mode === "normal") {
    header.appendChild(
      el("button", {
        class: "btn ghost",
        text: "拡大",
        onClick: () => actions.onOpenFocus?.("shareDonut"),
      })
    );
  }

  /* =========================
   * 軸ドロップダウン
   * ========================= */
  const select = el("select", {
    class: "widget1Select",
    onChange: (e) => {
      state.widget1Axis = e.target.value;
      actions.requestRender?.();
    },
  });

  axisKeys.forEach((a) => {
    select.appendChild(
      el("option", {
        value: a.key,
        text: a.label,
        selected: a.key === currentAxis,
      })
    );
  });

  header.appendChild(select);

  /* =========================
   * データ集計
   * ========================= */
  const rows = Array.isArray(state.filteredRows) ? state.filteredRows : [];
  const map = new Map();

  rows.forEach((r) => {
    const key = String(r[currentAxis] ?? "未分類");
    if (!map.has(key)) {
      map.set(key, {
        key,
        sales: 0,
        boothSet: new Set(),
      });
    }
    const o = map.get(key);
    o.sales += Number(r.sales) || 0;
    if (r.booth_id != null) o.boothSet.add(String(r.booth_id));
  });

  const items = Array.from(map.values()).map((x) => ({
    key: x.key,
    label: x.key,
    sales: x.sales,
    booths: x.boothSet.size,
  }));

  items.sort((a, b) => b.sales - a.sales);

  const totalSales = items.reduce((a, x) => a + x.sales, 0);
  const totalBooths = items.reduce((a, x) => a + x.booths, 0);

  /* =========================
   * チャート描画
   * ========================= */
  const canvas = el("canvas");
  const chartWrap = el("div", { class: "widget1ChartWrap" }, [canvas]);

  const chart = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: items.map((x) => x.label),
      datasets: [
        {
          label: "ブース構成比",
          data: items.map((x) => (totalBooths ? x.booths / totalBooths : 0)),
          backgroundColor: "#93c5fd",
          radius: "55%",
        },
        {
          label: "売上構成比",
          data: items.map((x) => (totalSales ? x.sales / totalSales : 0)),
          backgroundColor: "#2563eb",
          radius: "95%",
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "40%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex;
              const it = items[i];
              return `${it.label} / 売上 ${Math.round(
                it.sales
              ).toLocaleString()}円 / ブース ${it.booths}`;
            },
          },
        },
      },
    },
  });

  /* =========================
   * 右：ABC
   * ========================= */
  const abcWrap = el("div", { class: "widget1ABC" });

  let cum = 0;
  items.forEach((x) => {
    cum += x.sales;
    const rate = totalSales ? cum / totalSales : 0;
    const rank = rate <= 0.7 ? "A" : rate <= 0.9 ? "B" : "C";

    abcWrap.appendChild(
      el("div", { class: `widget1ABCRow rank-${rank}` }, [
        el("span", { class: "rank", text: rank }),
        el("span", { class: "label", text: x.label }),
        el("span", {
          class: "value",
          text: `${Math.round(x.sales).toLocaleString()}円`,
        }),
      ])
    );
  });

  /* =========================
   * レイアウト
   * ========================= */
  const body = el("div", { class: "widget1Body" }, [
    chartWrap,
    abcWrap,
  ]);

  mount.appendChild(
    el("div", { class: `widget1 widget1-${mode}` }, [
      header,
      body,
    ])
  );
}
