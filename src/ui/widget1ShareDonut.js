// src/ui/widget1ShareDonut.js
import { el, clear } from "../utils/dom.js";

const AXES = [
  { key: "料金", label: "① 料金", titleLabel: "料金" },
  { key: "回数", label: "② プレイ回数", titleLabel: "プレイ回数" },
  { key: "投入法", label: "③ 投入法", titleLabel: "投入法" },
  { key: "景品ジャンル", label: "④ 景品ジャンル", titleLabel: "景品ジャンル" },
  { key: "ターゲット", label: "⑤ ターゲット", titleLabel: "ターゲット" },
  { key: "年代", label: "⑥ 年代", titleLabel: "年代" },
  { key: "キャラ", label: "⑦ キャラ", titleLabel: "キャラ" },
  { key: "映画", label: "⑧ 映画", titleLabel: "映画" },
  { key: "予約", label: "⑨ 予約", titleLabel: "予約" },
  { key: "WLオリジナル", label: "⑩ WLオリジナル", titleLabel: "WLオリジナル" },
];

function safeStr(v, fallback = "未分類") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}
function toNum(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function yen(n) {
  return new Intl.NumberFormat("ja-JP").format(Math.round(n || 0)) + "円";
}
function axisMeta(axisKey) {
  return AXES.find(a => a.key === axisKey) || AXES[3];
}
function getAxisFromState_(state) {
  const raw = safeStr(state?.widget1Axis, "景品ジャンル");
  return (raw === "ジャンル") ? "景品ジャンル" : raw;
}

function buildAgg_(rows, axisKey) {
  const map = new Map();
  for (const r of rows) {
    const k = safeStr(r?.[axisKey], "未分類");
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

function ensureDom_(mount, actions, mode) {
  if (mount.__w1_root) return mount.__w1_root;

  const root = el("div", { class: `widget1 widget1-${mode}` });

  const header = el("div", { class: "widget1Header" });
  const title = el("div", { class: "widget1Title", text: "景品ジャンル別 売上 / ステーション構成比" });
  const left = el("div", { class: "widget1HeaderLeft" }, [title]);

  const btnExpand = el("button", {
    class: "btn ghost",
    text: "拡大",
    onClick: () => actions.onOpenFocus?.("shareDonut"),
  });

  const selectWrap = el("div", { class: "widget1SelectWrap" });
  const select = el("select", { class: "widget1Select" });
  AXES.forEach(a => select.appendChild(el("option", { value: a.key, text: a.label })));
  selectWrap.appendChild(select);

  const right = el("div", { class: "widget1HeaderRight" }, []);
  if (mode === "normal") right.appendChild(btnExpand);
  right.appendChild(selectWrap);

  header.appendChild(left);
  header.appendChild(right);

  const body = el("div", { class: "widget1Body" });

  // 左：チャート領域（いったんテキストで安全表示）
  const chartWrap = el("div", { class: "widget1ChartWrap" }, [
    el("div", { class: "widget1Empty", text: "（Chart描画を一時停止中：復旧優先）" })
  ]);

  const abcWrap = el("div", { class: "widget1ABC" });

  body.appendChild(chartWrap);
  body.appendChild(abcWrap);

  root.appendChild(header);
  root.appendChild(body);

  clear(mount);
  mount.appendChild(root);

  mount.__w1_root = root;
  mount.__w1_title = title;
  mount.__w1_select = select;
  mount.__w1_abc = abcWrap;

  select.addEventListener("change", () => {
    actions.onSetWidget1Axis?.(select.value);
  });

  return root;
}

function updateTitle_(mount, axisKey) {
  const meta = axisMeta(axisKey);
  if (mount.__w1_title) {
    mount.__w1_title.textContent = `${meta.titleLabel}別 売上 / ステーション構成比`;
  }
}
function updateSelect_(mount, axisKey) {
  const sel = mount.__w1_select;
  if (sel && sel.value !== axisKey) sel.value = axisKey;
}

function renderABC_(mount, items, totalSales, totalBooths) {
  const box = mount.__w1_abc;
  if (!box) return;

  clear(box);

  for (const it of items) {
    const share = totalSales ? (it.sales / totalSales) : 0;
    box.appendChild(
      el("div", { class: "widget1ABCRow" }, [
        el("span", { class: "rank", text: "" }),
        el("span", { class: "label", text: it.label }),
        el("span", { class: "value", text: `${yen(it.sales)}（${it.booths}台 / ${(share*100).toFixed(1)}%）` }),
      ])
    );
  }

  box.appendChild(
    el("div", {
      class: "widget1Note",
      text: `台数は 1ステーション（ブースID）単位で集計（合計 ${totalBooths}）`,
    })
  );
}

export function renderWidget1ShareDonut(mount, state, actions, opts = {}) {
  if (!mount) return;
  const mode = opts.mode || "normal";

  ensureDom_(mount, actions, mode);

  const rows = Array.isArray(state?.filteredRows) ? state.filteredRows : [];
  const axisKey = getAxisFromState_(state);

  updateSelect_(mount, axisKey);
  updateTitle_(mount, axisKey);

  const { items, totalSales, totalBooths } = buildAgg_(rows, axisKey);

  // 右側だけでも正常に動くことをまず保証
  renderABC_(mount, items, totalSales, totalBooths);
}
