const DB_NAME = "challengemon";
const STORES = ["roms", "pending", "files", "assets"] as const;
type Store = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        for (const s of STORES) {
          if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function idbGet<T>(store: Store, key: string): Promise<T | undefined> {
  try {
    return await run<T | undefined>(store, "readonly", (s) => s.get(key));
  } catch {
    return undefined;
  }
}

export async function idbSet(store: Store, key: string, value: unknown): Promise<void> {
  try {
    await run(store, "readwrite", (s) => s.put(value, key));
  } catch {}
}

export async function idbDelete(store: Store, key: string): Promise<void> {
  try {
    await run(store, "readwrite", (s) => s.delete(key));
  } catch {}
}

export async function idbKeys(store: Store): Promise<string[]> {
  try {
    return await run<string[]>(store, "readonly", (s) => s.getAllKeys());
  } catch {
    return [];
  }
}
