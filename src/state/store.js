// src/state/store.js
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  // notify中の再入を防ぐ
  let isEmitting = false;
  let pendingState = null;

  function get() {
    return state;
  }

  function set(updater) {
    const next =
      (typeof updater === "function") ? updater(state) : updater;

    // 同一参照なら何もしない（無限ループ抑止の基本）
    if (next === state) return;

    // notify中に set が来たら積むだけ（再帰しない）
    if (isEmitting) {
      pendingState = next;
      return;
    }

    // まず state 更新
    state = next;

    // notify（この間に set が来ても pending に積まれる）
    isEmitting = true;
    try {
      for (const fn of listeners) fn(state);
    } finally {
      isEmitting = false;
    }

    // notify中に積まれた pending があれば「1回だけ」反映する
    if (pendingState && pendingState !== state) {
      const p = pendingState;
      pendingState = null;
      set(p); // ここは isEmitting=false のため1段だけ進む
    } else {
      pendingState = null;
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { get, set, subscribe };
}
