import { Page } from '@playwright/test';

export async function idbGetAll(page: Page, storeName: string): Promise<unknown[]> {
  return page.evaluate((store: string) =>
    new Promise<unknown[]>((resolve, reject) => {
      const req = indexedDB.open('expense-dashboard', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction(store, 'readonly');
        const getAllReq = tx.objectStore(store).getAll();
        getAllReq.onsuccess = () => resolve(getAllReq.result);
        getAllReq.onerror = () => reject(getAllReq.error);
      };
      req.onerror = () => reject(req.error);
    }),
    storeName,
  );
}

export async function idbClear(page: Page, storeName: string): Promise<void> {
  await page.evaluate((store: string) =>
    new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('expense-dashboard', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction(store, 'readwrite');
        const clearReq = tx.objectStore(store).clear();
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => reject(clearReq.error);
      };
      req.onerror = () => reject(req.error);
    }),
    storeName,
  );
}

export async function idbSeedEntry(page: Page, entry: Record<string, unknown>): Promise<void> {
  await page.evaluate((e: Record<string, unknown>) =>
    new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('expense-dashboard', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('entries', 'readwrite');
        const putReq = tx.objectStore('entries').put(e);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      req.onerror = () => reject(req.error);
    }),
    entry,
  );
}

// Must be called before page.goto() so the record is present when AuthService.init() reads it.
export async function idbSeedAuth(page: Page, record: Record<string, unknown>): Promise<void> {
  await page.addInitScript((r: Record<string, unknown>) => {
    const req = indexedDB.open('expense-dashboard', 1);
    req.onsuccess = () => {
      const tx = req.result.transaction('appMeta', 'readwrite');
      tx.objectStore('appMeta').put(r, 'auth');
    };
  }, record);
}

export async function idbGetAuth(page: Page): Promise<unknown> {
  return page.evaluate(() =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('expense-dashboard', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('appMeta', 'readonly');
        const getReq = tx.objectStore('appMeta').get('auth');
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => reject(getReq.error);
      };
      req.onerror = () => reject(req.error);
    }),
  );
}

export async function idbPutAppMeta(page: Page, key: string, value: unknown): Promise<void> {
  await page.evaluate(
    ({ key, value }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('expense-dashboard', 1);
        req.onsuccess = () => {
          const tx = req.result.transaction('appMeta', 'readwrite');
          const putReq = tx.objectStore('appMeta').put(value, key);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        req.onerror = () => reject(req.error);
      }),
    { key, value },
  );
}

export async function idbGetAppMeta<T>(page: Page, key: string): Promise<T | undefined> {
  return page.evaluate(
    (k) =>
      new Promise<unknown>((resolve, reject) => {
        const req = indexedDB.open('expense-dashboard', 1);
        req.onsuccess = () => {
          const tx = req.result.transaction('appMeta', 'readonly');
          const getReq = tx.objectStore('appMeta').get(k);
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
      }),
    key,
  ) as Promise<T | undefined>;
}
