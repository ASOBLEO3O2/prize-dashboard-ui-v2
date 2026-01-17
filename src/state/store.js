export function createStore(initialState) {
  let state = structuredClone(initialState);
  const subs = new Set();

  const get = () => state;

  const set = (patch) => {
    const next = typeof patch === "function" ? patch(state) : { ...state, ...patch };
    state = next;
    for (const fn of subs) fn(state);
  };

  const subscribe = (fn) => {
    subs.add(fn);
    return () => subs.delete(fn);
  };

  return { get, set, subscribe };
}
