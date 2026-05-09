import { test as base, Page } from '@playwright/test';

// Stub window.google before the GIS CDN script loads.
// AuthService.loadGisScript() checks window.google?.accounts?.oauth2 first and resolves
// immediately if it exists — no network request to accounts.google.com is made.
// requestAccessToken calls config.callback with an error so boot-time silent re-auth
// resolves quickly (rather than hanging for 10 s on SILENT_REFRESH_TIMEOUT_MS).
const GIS_STUB = `
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: function(config) {
          return {
            requestAccessToken: function(_opts) {
              config.callback({ error: 'interaction_required' });
            }
          };
        },
        revoke: function(_token, done) { if (done) done(); }
      }
    }
  };
`;

export async function installGisMock(page: Page): Promise<void> {
  await page.addInitScript(GIS_STUB);
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    // Prevent real GIS CDN requests
    await page.addInitScript(GIS_STUB);

    // Seed appMeta with Story 2.7 format: key='auth', fields={ accessToken, expiresAt }
    await page.addInitScript(() => {
      const openReq = indexedDB.open('expense-dashboard', 1);
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction('appMeta', 'readwrite');
        tx.objectStore('appMeta').put(
          { accessToken: 'fake-token', expiresAt: Date.now() + 3_600_000 },
          'auth',
        );
        tx.objectStore('appMeta').put('fake-spreadsheet-id', 'spreadsheetId');
        tx.objectStore('appMeta').put({ '2026': '2026' }, 'schemaCache');
      };
    });
    await page.goto('/');
    await use(page);
  },
});

export { expect } from '@playwright/test';
