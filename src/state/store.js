// src/state/store.js
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  // setが連打されたら「最後の状態」だけを次tickで1回通知する
  let scheduled = false;
  let pending = null;

  function get() {
    return state;
  }

  function flush() {
    scheduled = false;

    if (pending == null) return;

    state = pending;
    pending = null;

    for (const fn of listeners) fn(state);

    if (pending != null && !scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  }

  function set(updater) {
    // ✅ ここが重要：同一tick内の連続 set は pending を基準に積み上げる
    const base = (pending != null) ? pending : state;
    const next = (typeof updater === "function") ? updater(base) : updater;

    if (next === base) return; // 同一参照は無視

    pending = next;

    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { get, set, subscribe };
}
