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
