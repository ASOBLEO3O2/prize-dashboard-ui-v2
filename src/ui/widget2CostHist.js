// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";

/* ===== 帯域定義 ===== */
const BANDS = [
  { key: "b1", label: "0–15%", min: 0, max: 15 },
  { key: "b2", label: "16–25%", min: 16, max: 25 },
  { key: "b3", label: "26–32%", min: 26, max: 32 },
  { key: "b4", label: "33–40%", min: 33, max: 40 },
  { key: "b5", label: "40%以上", min: 41, max: Infinity },
];

export function renderWidget2CostHist(mount, state) {
  clear(mount);

  let mode = "sales"; // sales | count

  const header = el("div", { class: "cardHeader" }, [
    el("div", { class: "cardTitle", text: "原価率分布" }),
  ]);

  const toggleWrap = el("div", { class: "toggleWrap" }, [
    el("button", {
      class: "btn small",
      text: "台数",
      onClick: () => {
        mode = "count";
        draw();
      },
    }),
    el("button", {
      class: "btn small",
      text: "売上",
      onClick: () => {
        mode = "sales";
        draw();
      },
    }),
  ]);

  const chartArea = el("div", { class: "histWrap" });

  const expandBtn = el("button", {
    class: "btn expand",
    text: "拡大",
    onClick: () => openExpand(),
  });

  mount.append(header, toggleWrap, chartArea, expandBtn);

  draw();

  /* ===== 分布計算 ===== */
  function buildDistribution() {
    const rows = state.filteredRows || [];

    return BANDS.map((band) => {
      const items = rows.filter((r) => {
        const rate = Number(r["原価率"] || 0);
        return rate >= band.min && rate <= band.max;
      });

      const count = items.length;
      const sales = items.reduce(
        (sum, r) => sum + Number(r["総売上"] || 0),
        0
      );

      return {
        ...band,
        count,
        sales,
        items,
      };
    });
  }

  /* ===== 描画 ===== */
  function draw() {
    clear(chartArea);

    const dist = buildDistribution();
    const maxValue = Math.max(
      ...dist.map((d) => (mode === "sales" ? d.sales : d.count)),
      1
    );

    dist.forEach((d) => {
      const value = mode === "sales" ? d.sales : d.count;
      const height = (value / maxValue) * 100;

      const bar = el("div", {
        class: "histBar",
        style: `height:${height}%`,
        title:
          mode === "sales"
            ? `${d.label} : ${fmtYen(d.sales)}`
            : `${d.label} : ${d.count}台`,
      });

      const wrap = el("div", { class: "histCol" }, [
        bar,
        el("div", { class: "histLabel", text: d.label }),
      ]);

      chartArea.append(wrap);
    });
  }

  /* ===== 拡大表示 ===== */
  function openExpand() {
    const overlay = el("div", { class: "overlay" });
    const container = el("div", { class: "expandContainer" });

    const topChart = el("div", { class: "expandChart" });
    const cardArea = el("div", { class: "cardArea" });

    overlay.append(container);
    container.append(topChart, cardArea);
    document.body.append(overlay);

    const dist = buildDistribution();

    let selectedBand = getMaxBand(dist);

    drawExpandChart();
    drawCards(selectedBand);

    function drawExpandChart() {
      clear(topChart);

      dist.forEach((d) => {
        const value = mode === "sales" ? d.sales : d.count;
        const maxValue = Math.max(
          ...dist.map((x) => (mode === "sales" ? x.sales : x.count)),
          1
        );

        const height = (value / maxValue) * 100;

        const bar = el("div", {
          class: "histBar",
          style: `height:${height}%`,
          onClick: () => {
            selectedBand = d;
            drawCards(d);
            highlight();
          },
        });

        const wrap = el("div", { class: "histCol" }, [
          bar,
          el("div", { class: "histLabel", text: d.label }),
        ]);

        topChart.append(wrap);
      });

      highlight();
    }

    function highlight() {
      [...topChart.querySelectorAll(".histCol")].forEach((col, i) => {
        col.classList.toggle(
          "active",
          dist[i].key === selectedBand.key
        );
      });
    }

    function drawCards(band) {
      clear(cardArea);

      if (!band.items.length) {
        cardArea.append(
          el("div", { class: "empty", text: "該当なし" })
        );
        return;
      }

      const sorted = [...band.items].sort(
        (a, b) =>
          Number(b["総売上"] || 0) - Number(a["総売上"] || 0)
      );

      sorted.forEach((r) => {
        const card = el("div", { class: "itemCard" }, [
          el("div", {
            class: "itemTitle",
            text: `${r["景品名"] || "-"} / ${
              r["対応マシン名"] || "-"
            }`,
          }),
          el("div", {
            text: `売上：${fmtYen(r["総売上"] || 0)}`,
          }),
          el("div", {
            text: `原価率：${fmtPct(r["原価率"] || 0)}`,
          }),
        ]);

        cardArea.append(card);
      });
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function getMaxBand(dist) {
    return dist.reduce((max, cur) =>
      cur.sales > max.sales ? cur : max
    );
  }
}
