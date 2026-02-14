// src/app.js
import { createStore } from "./state/store.js";
import { mountLayout } from "./ui/layout.js";
import { renderTopKpi } from "./ui/kpiTop.js";
import { renderMidKpi } from "./ui/kpiMid.js";
import { renderDetail } from "./ui/detail.js";
import { renderDrawer } from "./ui/drawer.js";

import { buildByAxis } from "./logic/byAxis.js";
import { loadRawData } from "./data/load.js";
import { applyFilters } from "./logic/filters.js";
import { buildViewModel } from "./logic/vm.js";

import { renderCharts } from "./ui/charts.js";

const store = createStore({
  filters: {},
  drawerOpen: false,
  midSlots: ["widget1", "widget2", "dummyA", "dummyB"],
  midSlotsDraft: ["widget1", "widget2", "dummyA", "dummyB"],
  byAxis: null,
  vm: null,
});

async function hydrate() {
  const { rows, summary } = await loadRawData();

  const st = store.get();
  const filtered = applyFilters(rows, st.filters);

  const vm = buildViewModel(filtered, summary);
  const axis = buildByAxis(filtered);

  store.set({ rows, summary, filtered, vm, byAxis: axis });
}

function wireActions(mounts) {
  const actions = {
    state: store.get(),
    setState(patch) {
      store.set(patch);
    },

    onRefresh: async () => {
      await hydrate();
      rerender();
    },

    onOpenDrawer: () => {
      const st = store.get();
      store.set({ drawerOpen: true, midSlotsDraft: st.midSlots.slice(0, 4) });
      rerender();
    },

    onCloseDrawer: () => {
      store.set({ drawerOpen: false });
      rerender();
    },

    onCommitDrawer: () => {
      const st = store.get();
      store.set({ drawerOpen: false, midSlots: st.midSlotsDraft.slice(0, 4) });
      rerender();
    },

    onSetMidSlotDraft: (slotIndex, slotType) => {
      const st = store.get();
      const next = (st.midSlotsDraft || []).slice(0, 4);
      while (next.length < 4) next.push("dummyA");
      next[slotIndex] = slotType;
      store.set({ midSlotsDraft: next });
      rerender();
    },
  };

  return actions;
}

let mounts = null;
let actions = null;

function rerender() {
  if (!mounts || !actions) return;

  const st = store.get();
  actions.state = st;

  renderTopKpi(mounts, st, actions);
  renderMidKpi(mounts, st, actions);
  renderDetail(mounts, st, actions);

  // ✅ Chart.js 系は “DOMが確定した後に1回だけ” 呼ぶ
  renderCharts(st, actions);

  if (st.drawerOpen) renderDrawer(mounts, st, actions);
  else renderDrawer(mounts, st, actions); // 既存の仕様で close 時も描画するなら維持
}

async function main() {
  mounts = mountLayout(document.getElementById("app"), {
    onRefresh: () => actions?.onRefresh?.(),
    onOpenDrawer: () => actions?.onOpenDrawer?.(),
  });

  actions = wireActions(mounts);

  await hydrate();
  rerender();
}

main();
