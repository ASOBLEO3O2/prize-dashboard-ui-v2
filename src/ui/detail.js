import { el, clear } from "../utils/dom.js";
import { fmtYen, fmtPct, fmtDate } from "../utils/format.js";

export function renderDetail(mount, state, actions) {
  clear(mount);

  if (!state.openDetailGenre) return;

  const genre = state.openDetailGenre;
  const rows = state.details[genre] || [];

  const wrap = el("div", { class: "detailArea" }, [
    el("div", { class: "detailHeader" }, [
      el("div", { class: "detailTitle", text: `詳細：${genre}` }),
      el("button", { class: "btn ghost", onClick: () => actions.onToggleDetail(genre), text: "閉じる" }),
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

  // 開いたら詳細先頭へ
  requestAnimationFrame(() => {
    wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function th(t){ return el("th", { text: t }); }
  function td(t){ return el("td", { text: t }); }

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
