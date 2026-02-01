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

    // pending がなければ終了
    if (pending == null) return;

    // pending を確定して通知（この通知中に set が来ても次tickに回る）
    state = pending;
    pending = null;

    for (const fn of listeners) fn(state);

    // 通知中にまた pending が積まれていたら次tickへ
    if (pending != null && !scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  }

  function set(updater) {
    const next = (typeof updater === "function") ? updater(state) : updater;

    // 同一参照は無視（無限レンダーの最大要因）
    if (next === state) return;

    // いまのtickでは state を即座に変えず、pending に積む
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
