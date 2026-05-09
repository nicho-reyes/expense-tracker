import { test as base, Page } from '@playwright/test';

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await page.addInitScript(() => {
      const openReq = indexedDB.open('expense-dashboard', 1);
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction('appMeta', 'readwrite');
        tx.objectStore('appMeta').put({
          access_token: 'fake-token',
          expires_at: Date.now() + 3_600_000,
        }, 'tokenData');
        tx.objectStore('appMeta').put('fake-spreadsheet-id', 'spreadsheetId');
        tx.objectStore('appMeta').put({ '2026': '2026' }, 'schemaCache');
      };
    });
    await page.goto('/');
    await use(page);
  },
});

export { expect } from '@playwright/test';
