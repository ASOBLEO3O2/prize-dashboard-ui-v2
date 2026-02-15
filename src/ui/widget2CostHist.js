// src/ui/widget2CostHist.js
import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct } from "../utils/format.js";

/* ===== 帯域（確定） ===== */
const BANDS = [
  { key: "b1", label: "0–15%",  min: 0,  max: 15 },
  { key: "b2", label: "16–25%", min: 16, max: 25 },
  { key: "b3", label: "26–32%", min: 26, max: 32 },
  { key: "b4", label: "33–40%", min: 33, max: 40 },
  { key: "b5", label: "40%以上", min: 41, max: Infinity },
];

export function renderWidget2CostHist(mount, state) {
  clear(mount);

  let mode = "sales"; // "sales" | "count"

  // ---- Header ----
  const head = el("div", { class: "w2-head" }, [
    el("div", { class: "w2-title", text: "原価率分布" }),
    el("div", { class: "w2-toggle" }, [
      el("button", {
        class: "btn small",
        text: "台数",
        onClick: () => { mode = "count"; draw(); },
      }),
      el("button", {
        class: "btn small",
        text: "売上",
        onClick: () => { mode = "sales"; draw(); },
      }),
    ]),
  ]);

  const histWrap = el("div", { class: "w2-hist" }, [
    el("div", { class: "w2-histWrap" }),
  ]);

  const expandRow = el("div", { class: "w2-expandRow" }, [
    el("button", {
      class: "btn ghost w2-expandBtn",
      text: "拡大",
      onClick: () => openExpand_(),
    }),
  ]);

  mount.append(head, histWrap, expandRow);

  draw();

  /* ===== 分布作成 ===== */
  function buildDistribution_() {
    const rows = state.filteredRows || [];

    return BANDS.map((band) => {
      const items = rows.filter((r) => {
        const rate = Number(r["原価率"] ?? 0);
        return rate >= band.min && rate <= band.max;
      });

      const count = items.length;
      const sales = items.reduce((sum, r) => sum + Number(r["総売上"] ?? 0), 0);

      return { ...band, count, sales, items };
    });
  }

  /* ===== 中段描画 ===== */
  function draw() {
    const wrap = histWrap.querySelector(".w2-histWrap");
    clear(wrap);

    const dist = buildDistribution_();
    const maxValue = Math.max(
      ...dist.map((d) => (mode === "sales" ? d.sales : d.count)),
      1
    );

    dist.forEach((d) => {
      const value = mode === "sales" ? d.sales : d.count;
      const height = (value / maxValue) * 100;

      const bar = el("div", {
        class: "w2-bar",
        style: `height:${height}%;`,
        title: mode === "sales"
          ? `${d.label} : ${fmtYen(d.sales)}`
          : `${d.label} : ${d.count}台`,
      });

      const col = el("div", { class: "w2-histCol" }, [
        bar,
        el("div", { class: "w2-histLabel", text: d.label }),
      ]);

      wrap.append(col);
    });
  }

  /* ===== 拡大（遷移） ===== */
  function openExpand_() {
    const dist = buildDistribution_();

    // 初期：売上最大の帯
    let selected = dist.reduce((max, cur) => (cur.sales > max.sales ? cur : max), dist[0]);

    const overlay = el("div", { class: "w2-overlay" });
    const modal = el("div", { class: "w2-modal" });

    const top = el("div", { class: "w2-modalTop" }, [
      el("div", { class: "w2-modalTitle", text: "原価率分布（拡大）" }),
      el("div", { class: "w2-toggle" }, [
        el("button", {
          class: "btn small",
          text: "台数",
          onClick: () => { mode = "count"; renderExpand_(); },
        }),
        el("button", {
          class: "btn small",
          text: "売上",
          onClick: () => { mode = "sales"; renderExpand_(); },
        }),
        el("button", {
          class: "btn ghost w2-close",
          text: "閉じる",
          onClick: () => overlay.remove(),
        }),
      ]),
    ]);

    const body = el("div", { class: "w2-modalBody" });
    const chart = el("div", { class: "w2-expandChart" }, [
      el("div", { class: "w2-histWrap" }),
    ]);
    const cards = el("div", { class: "w2-cards" }, [
      el("div", { class: "w2-cardsGrid" }),
    ]);

    body.append(chart, cards);
    modal.append(top, body);
    overlay.append(modal);
    document.body.append(overlay);

    // 背景クリックで閉じる（モーダル外のみ）
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    renderExpand_();

    function renderExpand_() {
      renderExpandChart_();
      renderCards_();
    }

    function renderExpandChart_() {
      const wrap = chart.querySelector(".w2-histWrap");
      clear(wrap);

      const maxValue = Math.max(
        ...dist.map((d) => (mode === "sales" ? d.sales : d.count)),
        1
      );

      dist.forEach((d) => {
        const value = mode === "sales" ? d.sales : d.count;
        const height = (value / maxValue) * 100;

        const bar = el("div", {
          class: "w2-bar",
          style: `height:${height}%;`,
          title: mode === "sales"
            ? `${d.label} : ${fmtYen(d.sales)}`
            : `${d.label} : ${d.count}台`,
          onClick: () => {
            selected = d;
            renderCards_();
            highlight_();
          },
        });

        const col = el("div", { class: "w2-histCol" }, [
          bar,
          el("div", { class: "w2-histLabel", text: d.label }),
        ]);

        wrap.append(col);
      });

      highlight_();
    }

    function highlight_() {
      const cols = [...chart.querySelectorAll(".w2-histCol")];
      cols.forEach((c, i) => c.classList.toggle("is-active", dist[i].key === selected.key));
    }

    function renderCards_() {
      const grid = cards.querySelector(".w2-cardsGrid");
      clear(grid);

      const items = selected.items || [];
      if (!items.length) {
        grid.append(el("div", { class: "w2-empty", text: "該当なし" }));
        return;
      }

      // 影響度優先：常に売上降順
      const sorted = [...items].sort((a, b) => Number(b["総売上"] ?? 0) - Number(a["総売上"] ?? 0));

      sorted.forEach((r) => {
        const prize = r["景品名"] ?? "-";
        const machine = r["対応マシン名"] ?? "-";
        const sales = Number(r["総売上"] ?? 0);
        const rate = Number(r["原価率"] ?? 0);

        grid.append(
          el("div", { class: "w2-itemCard" }, [
            el("div", { class: "w2-itemTitle", text: `${prize} / ${machine}` }),
            el("div", { class: "w2-row" }, [
              el("div", { text: "売上" }),
              el("div", { text: fmtYen(sales) }),
            ]),
            el("div", { class: "w2-row" }, [
              el("div", { text: "原価率" }),
              el("div", { text: fmtPct(rate) }),
            ]),
          ])
        );
      });
    }
  }
}
