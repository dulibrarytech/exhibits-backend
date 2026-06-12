import { vi } from 'vitest';

globalThis.jest = vi;

// jsdom 16.7 under newer Node exposes a window.localStorage whose setItem/clear are
// missing (opaque-origin Storage), which breaks the jsdom-environment unit tests in
// test/unit-app. Provide a minimal in-memory Storage so those tests have a real
// localStorage. Skipped in the default `node` environment, where there is no window.
if (typeof window !== 'undefined'
    && (!window.localStorage || typeof window.localStorage.setItem !== 'function')) {

    const store = new Map();
    const storage = {
        getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
        setItem: (key, value) => { store.set(String(key), String(value)); },
        removeItem: (key) => { store.delete(String(key)); },
        clear: () => { store.clear(); },
        key: (i) => (Array.from(store.keys())[i] ?? null),
        get length() { return store.size; },
    };

    try {
        Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true });
    } catch {
        window.localStorage = storage;
    }
}
