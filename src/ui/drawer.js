// src/ui/drawer.js
import { el, clear } from "../utils/dom.js";
import { uniqueOptions } from "../data/normalizeRow.js";

/**
 * Drawer
 * - 前半：中段4枠の差し替え（既存維持）
 * - 後半：アプリ全体フィルタ（B案：normRowsAll の固定キーだけを見る）
 *
 * 上層→下層の例：
 * - 景品ジャンル（prizeGenreKey）→ サブ（food/plush/goods のどれか）
 * - キャラ（charaKey）→ サブ（charaGenre/nonCharaGenre のどれか）
 */

const OPTIONS = [
  { value: "widget1", label: "① 構成比ドーナツ（既存）" },
  { value: "widget2", label: "② 原価率分布（既存）" },
  { value: "scatter", label: "③ 売上×原価率（散布）" },
  { value: "dummyA", label: "ダミーA" },
  { value: "dummyB", label: "ダミーB" },
  { value: "dummyC", label: "ダミーC" },
  { value: "dummyD", label: "ダミーD" },
];

function norm4(arr, fallback) {
  const a = Array.isArray(arr) ? arr.slice(0, 4) : fallback.slice(0, 4);
  while (a.length < 4) a.push(fallback[a.length] || "dummyA");
  return a.map((x) => String(x || "").trim() || "dummyA");
}

function buildSlotSelect_(currentValue, onChange) {
  const sel = el("select", { class: "select", onChange });
  for (const op of OPTIONS) sel.appendChild(el("option", { value: op.value, text: op.label }));
  sel.value = String(currentValue || "");
  if (!OPTIONS.some((o) => o.value === sel.value)) sel.value = OPTIONS[0]?.value || "";
  return sel;
}

// ===== helper: フィルタ select =====
function buildSelect_(items, current, onChange, { placeholder = "（指定なし）" } = {}) {
  const sel = el("select", { class: "select", onChange });
  sel.appendChild(el("option", { value: "", text: placeholder }));
  for (const it of items) {
    sel.appendChild(el("option", { value: it.value, text: it.label }));
  }
  sel.value = String(current || "");
  return sel;
}

function buildMultiSelect_(items, selectedArr, onChange) {
  // ブラウザ標準の複数選択（ctrl/shift）
  // 後でUIを改良する前提で、まずは実装を安定させる
  const sel = el("select", { class: "select", multiple: true, size: 8, onChange });
  const selected = new Set(Array.isArray(selectedArr) ? selectedArr : []);
  for (const it of items) {
    const opt = el("option", { value: it.value, text: it.label });
    if (selected.has(it.value)) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function readMultiSelectValues(selectEl) {
  return [...selectEl.options].filter((o) => o.selected).map((o) => o.value);
}

function triStateLabel(v) {
  if (v === true) return "〇のみ";
  if (v === false) return "×のみ";
  return "指定なし";
}

function triStateNext(v) {
  // null -> true -> false -> null ...
  if (v == null) return true;
  if (v === true) return false;
  return null;
}

export function renderDrawer(drawer, overlay, state, actions) {
  clear(drawer);

  const slots = norm4(state.midSlots, ["widget1", "widget2", "dummyA", "dummyB"]);
  const draft = norm4(state.midSlotsDraft, slots);

  const normAll = Array.isArray(state.normRowsAll) ? state.normRowsAll : [];
  const f = state.filters || {};
  const flags = f.flags || { movie: null, reserve: null, wl: null };

  // =========================
  // Header
  // =========================
  drawer.appendChild(
    el("div", { class: "drawerHeader" }, [
      el("div", { class: "drawerTitle", text: "ドロワー" }),
      el("div", { style: "display:flex; gap:10px; align-items:center;" }, [
        el("button", {
          class: "btn ghost",
          text: "取消",
          onClick: (e) => {
            e.preventDefault();
            actions.onCancelMidSlots?.();
          },
        }),
        el("button", {
          class: "btn primary",
          text: "決定",
          onClick: (e) => {
            e.preventDefault();
            actions.onApplyMidSlots?.();
          },
        }),
        el("button", {
          class: "btn ghost",
          text: "閉じる",
          onClick: actions.onCloseDrawer,
        }),
      ]),
    ])
  );

  // =========================
  // Body
  // =========================
  const body = el("div", { class: "drawerBody" });

  // ----- スロット差し替え（既存） -----
  body.appendChild(
    el("div", { class: "drawerCard" }, [
      el("h4", { text: "中段KPI（4枠）の表示内容" }),
      el("p", { text: "選択中は draft。『決定』で確定（midSlots）になります。" }),
    ])
  );

  for (let i = 0; i < 4; i++) {
    body.appendChild(
      el("div", { class: "drawerCard" }, [
        el("div", { style: "font-weight:900; margin-bottom:8px;", text: `スロット ${i + 1}` }),
        buildSlotSelect_(draft[i], (e) => {
          actions.onSetMidSlotDraft?.(i, e.target.value);
          actions.requestRender?.();
        }),
      ])
    );
  }

  // =========================
  // フィルタ（追加）
  // =========================
  body.appendChild(
    el("div", { class: "drawerCard" }, [
      el("h4", { text: "アプリ全体フィルタ" }),
      el("p", { text: "※ 全ウィジェットに影響。B案により normRowsAll の固定キーのみで判定します。" }),
      el("div", { style: "display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;" }, [
        el("button", {
          class: "btn ghost",
          text: "フィルタ全解除",
          onClick: (e) => {
            e.preventDefault();
            actions.onClearFilters?.();
          },
        }),
      ]),
    ])
  );

  // ----- machineNames（複数） -----
  const machineOptions = uniqueOptions(normAll, "machineName")
    .filter((x) => x)
    .sort((a, b) => a.localeCompare(b, "ja"))
    .map((name) => ({ value: name, label: name }));

  body.appendChild(
    el("div", { class: "drawerCard" }, [
      el("div", { style: "font-weight:900; margin-bottom:8px;", text: "対応マシン名（複数選択）" }),
      el("p", { style: "margin:0 0 8px 0; opacity:.8;", text: "※ Ctrl / Shift で複数選択" }),
      buildMultiSelect_(machineOptions, f.machineNames || [], (e) => {
        const values = readMultiSelectValues(e.target);
        actions.onSetMachineNames?.(values);
      }),
    ])
  );

  // ----- feeKeys（複数） -----
  // feeKey/feeLabel は normalizeRow が保証している前提
  const feePairs = new Map(); // key -> label
  for (const r of normAll) {
    const k = String(r?.feeKey || "");
    const l = String(r?.feeLabel || "");
    if (!k) continue;
    if (!feePairs.has(k)) feePairs.set(k, l || k);
  }
  const feeOptions = [...feePairs.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .map(([k, l]) => ({ value: k, label: l }));

  body.appendChild(
    el("div", { class: "drawerCard" }, [
      el("div", { style: "font-weight:900; margin-bottom:8px;", text: "料金（複数選択）" }),
      buildMultiSelect_(feeOptions, f.feeKeys || [], (e) => {
        const values = readMultiSelectValues(e.target);
        actions.onSetFeeKeys?.(values);
      }),
    ])
  );

  // ----- prizeGenre（上層） -----
  const prizeGenrePairs = new Map();
  for (const r of normAll) {
    const k = String(r?.prizeGenreKey || "");
    const l = String(r?.prizeGenreLabel || "");
    if (!k) continue;
    if (!prizeGenrePairs.has(k)) prizeGenrePairs.set(k, l || k);
  }
  const prizeGenreOptions = [...prizeGenrePairs.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .map(([k, l]) => ({ value: k, label: l }));

  // 下層：親によって候補が変わる
  let subItems = [];
  if (String(f.prizeGenreKey || "") === "1") {
    // 食品
    const mp = new Map();
    for (const r of normAll) {
      const k = String(r?.foodKey || "");
      const l = String(r?.foodLabel || "");
      if (!k) continue;
      if (!mp.has(k)) mp.set(k, l || k);
    }
    subItems = [...mp.entries()].sort((a, b) => a[0].localeCompare(b[0], "ja")).map(([k, l]) => ({ value: k, label: l }));
  } else if (String(f.prizeGenreKey || "") === "2") {
    // ぬい
    const mp = new Map();
    for (const r of normAll) {
      const k = String(r?.plushKey || "");
      const l = String(r?.plushLabel || "");
      if (!k) continue;
      if (!mp.has(k)) mp.set(k, l || k);
    }
    subItems = [...mp.entries()].sort((a, b) => a[0].localeCompare(b[0], "ja")).map(([k, l]) => ({ value: k, label: l }));
  } else if (String(f.prizeGenreKey || "") === "3") {
    // 雑貨
    const mp = new Map();
    for (const r of normAll) {
      const k = String(r?.goodsKey || "");
      const l = String(r?.goodsLabel || "");
      if (!k) continue;
      if (!mp.has(k)) mp.set(k, l || k);
    }
    subItems = [...mp.entries()].sort((a, b) => a[0].localeCompare(b[0], "ja")).map(([k, l]) => ({ value: k, label: l }));
  }

  body.appendChild(
    el("div", { class: "drawerCard" }, [
      el("div", { style: "font-weight:900; margin-bottom:8px;", text: "景品ジャンル（上層→下層）" }),
      el("div", { style: "display:grid; gap:10px;" }, [
        el("div", {}, [
          el("div", { style: "opacity:.8; margin-bottom:6px;", text: "上層（食品/ぬい/雑貨）" }),
          buildSelect_(prizeGenreOptions, f.prizeGenreKey, (e) => {
            actions.onSetPrizeGenre?.(e.target.value); // ★子は action 側でリセット
          }),
        ]),
        el("div", {}, [
          el("div", { style: "opacity:.8; margin-bottom:6px;", text: "下層（上層に応じて候補が切替）" }),
          buildSelect_(subItems, f.subGenreKey, (e) => {
            actions.onSetPrizeSubGenre?.(e.target.value);
          }, { placeholder: "（下層指定なし）" }),
        ]),
      ]),
    ])
  );

  // ----- chara（上層→下層） -----
  const charaPairs = new Map();
  for (const r of normAll) {
    const k = String(r?.charaKey || "");
    const l = String(r?.charaLabel || "");
    if (!k) continue;
    if (!charaPairs.has(k)) charaPairs.set(k, l || k);
  }
  const charaOptions = [...charaPairs.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .map(([k, l]) => ({ value: k, label: l }));

  let charaSubItems = [];
  if (String(f.charaKey || "") === "1") {
    const mp = new Map();
    for (const r of normAll) {
      const k = String(r?.charaGenreKey || "");
      const l = String(r?.charaGenreLabel || "");
      if (!k) continue;
      if (!mp.has(k)) mp.set(k, l || k);
    }
    charaSubItems = [...mp.entries()].sort((a, b) => a[0].localeCompare(b[0], "ja")).map(([k, l]) => ({ value: k, label: l }));
  } else if (String(f.charaKey || "") === "2") {
    const mp = new Map();
    for (const r of normAll) {
      const k = String(r?.nonCharaGenreKey || "");
      const l = String(r?.nonCharaGenreLabel || "");
      if (!k) continue;
      if (!mp.has(k)) mp.set(k, l || k);
    }
    charaSubItems = [...mp.entries()].sort((a, b) => a[0].localeCompare(b[0], "ja")).map(([k, l]) => ({ value: k, label: l }));
  }

  body.appendChild(
    el("div", { class: "drawerCard" }, [
      el("div", { style: "font-weight:900; margin-bottom:8px;", text: "キャラ（上層→下層）" }),
      el("div", { style: "display:grid; gap:10px;" }, [
        el("div", {}, [
          el("div", { style: "opacity:.8; margin-bottom:6px;", text: "上層（キャラ/ノンキャラ）" }),
          buildSelect_(charaOptions, f.charaKey, (e) => {
            actions.onSetChara?.(e.target.value);
          }),
        ]),
        el("div", {}, [
          el("div", { style: "opacity:.8; margin-bottom:6px;", text: "下層（上層に応じて候補が切替）" }),
          buildSelect_(charaSubItems, f.charaSubKey, (e) => {
            actions.onSetCharaSub?.(e.target.value);
          }, { placeholder: "（下層指定なし）" }),
        ]),
      ]),
    ])
  );

  // ----- flags tri-state -----
  body.appendChild(
    el("div", { class: "drawerCard" }, [
      el("div", { style: "font-weight:900; margin-bottom:8px;", text: "フラグ（指定なし/〇/×）" }),
      el("div", { style: "display:flex; gap:10px; flex-wrap:wrap;" }, [
        el("button", {
          class: "btn ghost",
          text: `映画: ${triStateLabel(flags.movie)}`,
          onClick: (e) => {
            e.preventDefault();
            actions.onSetFlags?.({ movie: triStateNext(flags.movie) });
          },
        }),
        el("button", {
          class: "btn ghost",
          text: `予約: ${triStateLabel(flags.reserve)}`,
          onClick: (e) => {
            e.preventDefault();
            actions.onSetFlags?.({ reserve: triStateNext(flags.reserve) });
          },
        }),
        el("button", {
          class: "btn ghost",
          text: `WL: ${triStateLabel(flags.wl)}`,
          onClick: (e) => {
            e.preventDefault();
            actions.onSetFlags?.({ wl: triStateNext(flags.wl) });
          },
        }),
      ]),
      el("p", { style: "margin-top:10px; opacity:.8;", text: "※ 指定なし→〇のみ→×のみ→指定なし の順で切替" }),
    ])
  );

  // ----- debug（既存＋追加） -----
  body.appendChild(
    el("div", { class: "drawerCard" }, [
      el("h4", { text: "現在の状態（debug）" }),
      el("p", { text: `midSlots (確定): ${JSON.stringify(slots)}` }),
      el("p", { text: `midSlotsDraft (編集中): ${JSON.stringify(draft)}` }),
      el("p", { text: `drawerOpen: ${state.drawerOpen ? "true" : "false"}` }),
      el("p", { text: `filters: ${JSON.stringify(state.filters || {})}` }),
      el("p", { text: `normRowsAll: ${normAll.length}` }),
      el("p", { text: `normRows(filtered): ${(state.normRows || []).length}` }),
    ])
  );

  drawer.appendChild(body);

  // =========================
  // Open / Close
  // =========================
  overlay.classList.toggle("open", !!state.drawerOpen);
  drawer.classList.toggle("open", !!state.drawerOpen);
}
