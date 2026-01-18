import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct, fmtDate } from "../utils/format.js";

export function renderDetail(mount, state, actions) {
  clear(mount);

  if (!state.openDetailGenre) return;

  const genre = state.openDetailGenre;
  const baseRows = state.details[genre] || [];

  const sortKey = state.detailSortKey || "sales";
  const sortDir = state.detailSortDir || "desc";

  const rows = [...baseRows].sort((a, b) => {
    const av = pick(a, sortKey);
    const bv = pick(b, sortKey);
    const diff = (bv - av);
    return sortDir === "desc" ? diff : -diff;
  });

  const wrap = el("div", { class: "detailArea" }, [
    el("div", { class: "detailHeader" }, [
      el("div", { class: "detailTitle", text: `詳細：${genre}` }),
      el("div", { style: "display:flex; gap:8px; align-items:center; flex-wrap:wrap;" }, [
        el("select", {
          class: "btn",
          style: "padding:8px 10px;",
          onChange: (e) => actions.onSetDetailSort?.(e.target.value, null),
        }, [
          opt("sales", "売上", sortKey),
          opt("consume", "消化額", sortKey),
          opt("count", "消化数", sortKey),
          opt("costRate", "原価率", sortKey),
        ]),
        el("button", {
          class: "btn",
          onClick: () => actions.onSetDetailSort?.(null, (sortDir === "desc") ? "asc" : "desc"),
          text: (sortDir === "desc") ? "降順" : "昇順",
        }),
        el("button", { class: "btn ghost", onClick: () => actions.onToggleDetail(genre), text: "閉じる" }),
      ]),
    ]),
    el("div", { class: "detailBody" }, [
      el("table", { class: "table" }, [
        el("thead", {}, [
          el("tr", {}, [
            th("マシン名"),
            th("景品名"),
            th("総売上"),
            th("消化数"),
            th("消化額"),
            th("原価率"),
            th("更新日"),
          ])
        ]),
        el("tbody", {}, rows.map(r => tr(r))),
      ])
    ])
  ]);

  mount.appendChild(wrap);

  requestAnimationFrame(() => {
    wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function opt(value, label, current) {
    return el("option", { value, selected: value === current ? "selected" : null }, [label]);
  }

  function th(t){ return el("th", { text: t }); }
  function td(t){ return el("td", { text: t }); }

  function pick(r, k) {
    if (k === "sales") return Number(r?.sales) || 0;
    if (k === "consume") return Number(r?.consume) || 0;
    if (k === "count") return Number(r?.count) || 0;
    if (k === "costRate") return Number(r?.costRate) || 0;
    return 0;
  }

  function tr(r){
    return el("tr", {}, [
      td(r.machine || "—"),
      td(r.item || "—"),
      td(fmtYen(r.sales)),
      td(r.count != null ? String(r.count) : "—"),
      td(fmtYen(r.consume)),
      td(fmtPct(r.costRate, 1)),
      td(fmtDate(r.date)),
    ]);
  }
}
