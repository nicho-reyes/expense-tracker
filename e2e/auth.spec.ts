import { test, expect } from '@playwright/test';
import { installGisMock } from './fixtures/auth.fixture';
import { idbSeedAuth } from './support/idb-helpers';

// Story 2.7: Persistent auth and boot-time silent re-authentication
//
// All tests use a stubbed GIS (see installGisMock) so that:
//  - loadGisScript() resolves immediately without a CDN hit
//  - requestAccessToken immediately calls back with { error: 'interaction_required' }
//    so boot-time silent re-auth resolves fast rather than waiting 10 s

test.describe('Story 2.7 — Boot-time persistent auth', () => {
  test.beforeEach(async ({ page }) => {
    // Prevent CDN requests and make silent re-auth fail fast
    await installGisMock(page);
    // Seed spreadsheetId + schemaCache so setupGuard passes on authenticated paths
    await page.addInitScript(() => {
      const req = indexedDB.open('expense-dashboard', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('appMeta', 'readwrite');
        tx.objectStore('appMeta').put('fake-spreadsheet-id', 'spreadsheetId');
        tx.objectStore('appMeta').put({ '2026': '2026' }, 'schemaCache');
      };
    });
  });

  // AC2: valid persisted token → app boots without redirecting to /auth
  test('A-01: valid token in appMeta["auth"] → boots to app without /auth redirect', async ({ page }) => {
    await idbSeedAuth(page, { accessToken: 'fake-token', expiresAt: Date.now() + 3_600_000 });
    await page.goto('/');
    // Wait for Angular to bootstrap and all guards to settle before checking URL
    await page.waitForLoadState('networkidle', { timeout: 5_000 });
    expect(page.url()).not.toContain('/auth');
  });

  // AC3-4: expired token → purged, silent re-auth attempted, GIS returns error → /auth
  test('A-02: expired token → silent re-auth fails → redirects to /auth', async ({ page }) => {
    await idbSeedAuth(page, { accessToken: 'fake-token', expiresAt: Date.now() - 1 });
    await page.goto('/');
    await page.waitForURL('**/auth', { timeout: 5_000 });
    expect(page.url()).toContain('/auth');
  });

  // AC4: no persisted token → silent re-auth fails → /auth
  test('A-03: no auth record → silent re-auth fails → redirects to /auth', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/auth', { timeout: 5_000 });
    expect(page.url()).toContain('/auth');
  });

  // AC7: malformed records are treated as absent (purge + fall through to re-auth)
  for (const [desc, record] of [
    ['empty accessToken', { accessToken: '', expiresAt: Date.now() + 3_600_000 }],
    ['negative expiresAt', { accessToken: 'tok', expiresAt: -1 }],
    ['missing fields', {}],
  ] as [string, Record<string, unknown>][]) {
    test(`A-04: malformed token (${desc}) → treated as absent → redirects to /auth`, async ({ page }) => {
      await idbSeedAuth(page, record);
      await page.goto('/');
      await page.waitForURL('**/auth', { timeout: 5_000 });
      expect(page.url()).toContain('/auth');
    });
  }
});
