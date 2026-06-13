// Save-storage adapters. The engine only needs { get, set, del }. This keeps the
// core free of any platform assumption: browser uses localStorage, tests use
// memory, tooling can use the filesystem.

export function memoryStorage() {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), del: (k) => void m.delete(k) };
}

export function localStorageAdapter() {
  return {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: (k) => { try { localStorage.removeItem(k); } catch {} },
  };
}
