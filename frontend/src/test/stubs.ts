// Node-env Vitest has no DOM: `localStorage` and `sessionStorage` are undefined.
// Tests that exercise the api/groupContext layers install these in-memory stubs.

export interface StorageStub {
  restore(): void;
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length(): number {
      return data.size;
    },
    clear: (): void => void data.clear(),
    getItem: (key: string): string | null => (data.has(key) ? String(data.get(key)) : null),
    key: (index: number): string | null => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string): void => void data.delete(key),
    setItem: (key: string, value: string): void => void data.set(key, String(value)),
  };
}

export function installStorageStub(): StorageStub {
  const g = globalThis as { localStorage?: Storage; sessionStorage?: Storage };
  const before = { localStorage: g.localStorage, sessionStorage: g.sessionStorage };
  g.localStorage = memoryStorage();
  g.sessionStorage = memoryStorage();
  return {
    restore(): void {
      g.localStorage = before.localStorage;
      g.sessionStorage = before.sessionStorage;
    },
  };
}
