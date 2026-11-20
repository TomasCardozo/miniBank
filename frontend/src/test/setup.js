import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const localStorageStore = new Map();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => (localStorageStore.has(key) ? localStorageStore.get(key) : null),
    setItem: (key, value) => localStorageStore.set(key, String(value)),
    removeItem: (key) => localStorageStore.delete(key),
    clear: () => localStorageStore.clear(),
  },
});

afterEach(() => {
  cleanup();
});
