import { test, expect } from '@playwright/test';

const DB_NAME = 'expense-dashboard';
const STORE = 'categories';

async function seedCategories(page: Parameters<typeof test>[1]['page']) {
  await page.evaluate(
    ({ dbName, storeName }: { dbName: string; storeName: string }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          store.put({ id: 'a', name: 'Alpha', color: '#111', position: 0 });
          store.put({ id: 'b', name: 'Beta', color: '#222', position: 1 });
          store.put({ id: 'c', name: 'Gamma', color: '#333', position: 2 });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: DB_NAME, storeName: STORE },
  );
}

async function readPositions(page: Parameters<typeof test>[1]['page']): Promise<{ id: string; position: number }[]> {
  return page.evaluate(
    ({ dbName, storeName }: { dbName: string; storeName: string }) =>
      new Promise<{ id: string; position: number }[]>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const all = store.getAll();
          all.onsuccess = () =>
            resolve(
              (all.result as { id: string; position: number }[]).map(c => ({
                id: c.id,
                position: c.position,
              })),
            );
          all.onerror = () => reject(all.error);
        };
      }),
    { dbName: DB_NAME, storeName: STORE },
  );
}

test.describe('Category reorder (Story 5.1)', () => {
  test.skip('drag row c above row a, reload, verify order persists (AC2, AC3)', async ({ page }) => {
    // Seed IDB before navigation so init() picks up the categories
    await page.goto('/settings');
    await seedCategories(page);
    await page.reload();

    // Rows should render: Alpha, Beta, Gamma
    const rows = page.locator('.cm-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Alpha');
    await expect(rows.nth(1)).toContainText('Beta');
    await expect(rows.nth(2)).toContainText('Gamma');

    // Drag Gamma (row 2) above Alpha (row 0) using the drag handle
    const handles = page.locator('[cdkDragHandle]');
    const gammaHandle = handles.nth(2);
    const alphaRow = rows.nth(0);
    await gammaHandle.dragTo(alphaRow);

    // After drop the order in the DOM should be: Gamma, Alpha, Beta
    await expect(rows.nth(0)).toContainText('Gamma');
    await expect(rows.nth(1)).toContainText('Alpha');
    await expect(rows.nth(2)).toContainText('Beta');

    // Reload and verify IDB-persisted order
    await page.reload();
    await expect(rows.nth(0)).toContainText('Gamma');
    await expect(rows.nth(1)).toContainText('Alpha');
    await expect(rows.nth(2)).toContainText('Beta');

    // Verify IDB positions are contiguous 0,1,2
    const positions = await readPositions(page);
    const sorted = [...positions].sort((a, b) => a.position - b.position);
    expect(sorted.map(c => c.id)).toEqual(['c', 'a', 'b']);
    expect(sorted.map(c => c.position)).toEqual([0, 1, 2]);
  });
});
