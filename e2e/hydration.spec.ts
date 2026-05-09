import { test, expect } from './fixtures/auth.fixture';
import { idbSeedEntry, idbPutAppMeta, idbGetAppMeta } from './support/idb-helpers';

// Reused fixture data
const SPREADSHEET_ID = 'fake-spreadsheet-id';

const META_NO_TABS = {
  spreadsheetId: SPREADSHEET_ID,
  properties: { title: 'Test Sheet' },
  sheets: [],
};

const META_WITH_2026 = {
  spreadsheetId: SPREADSHEET_ID,
  properties: { title: 'Test Sheet' },
  sheets: [
    {
      properties: {
        sheetId: 1,
        title: '2026',
        index: 0,
        sheetType: 'GRID',
        gridProperties: { rowCount: 100, columnCount: 6 },
      },
    },
  ],
};

// Two valid 2026-schema rows: [date, category, amount, remarks, month, uuid]
const ROWS_2026 = [
  ['2026-05-01', 'Food', '12.50', 'Lunch at cafe', '2026-05', 'uuid-e2e-hydration-1'],
  ['2026-05-02', 'Transport', '3.00', 'Bus fare', '2026-05', 'uuid-e2e-hydration-2'],
];

function makeEntry(id: string, date: string): Record<string, unknown> {
  return {
    id,
    date,
    month: date.slice(0, 7),
    year: Number(date.slice(0, 4)),
    category: 'Food',
    amount: 12.5,
    remarks: '',
    tabName: '2026',
    schemaVersion: '2026',
    sheetRowIndex: 2,
    syncStatus: 'synced',
    isReadOnly: false,
  };
}

// Installs a Sheets mock that handles meta vs values by URL inspection.
// meta: returned for any googleapis.com request that is NOT a /values/ path
// values: returned for /values/ requests
async function installSheetsMock(
  page: import('@playwright/test').Page,
  opts: { meta: object; values: string[][] },
): Promise<void> {
  await page.route('**/sheets.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/values/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ values: opts.values }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(opts.meta),
      });
    }
  });
}

test.describe('Hydration (Story 2.6)', () => {
  // ── H-01: IDB-seeded synced entries appear in list ─────────────────────────

  test('H-01: synced entries seeded in IDB appear in the entry list after reload', async ({
    authedPage,
  }) => {
    // Mark '2026' as already hydrated so HydrationService skips the Sheets API call
    await idbPutAppMeta(authedPage, 'hydratedAt', {
      '2026': { lastHydratedAt: Date.now(), rowCount: 2 },
    });
    await idbSeedEntry(authedPage, makeEntry('uuid-e2e-h01-a', '2026-05-01'));
    await idbSeedEntry(authedPage, makeEntry('uuid-e2e-h01-b', '2026-05-02'));

    await installSheetsMock(authedPage, { meta: META_WITH_2026, values: [] });

    await authedPage.reload();
    await authedPage.waitForLoadState('networkidle');

    await expect(authedPage.locator('[data-testid="entry-row"]')).toHaveCount(2);
  });

  // ── H-02: Full hydration reads Sheets and writes entries + hydratedAt ───────

  test('H-02: first-time hydration reads year tab rows from Sheets and persists entries', async ({
    page,
  }) => {
    // Replicate authedPage fixture seed — must be in addInitScript to run before Angular boots
    await page.addInitScript(() => {
      const openReq = indexedDB.open('expense-dashboard', 1);
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction('appMeta', 'readwrite');
        tx.objectStore('appMeta').put(
          { access_token: 'fake-token', expires_at: Date.now() + 3_600_000 },
          'tokenData',
        );
        tx.objectStore('appMeta').put('fake-spreadsheet-id', 'spreadsheetId');
        tx.objectStore('appMeta').put({ '2026': '2026' }, 'schemaCache');
      };
    });

    // Install mock BEFORE goto so APP_INITIALIZER hydration uses the mock
    await installSheetsMock(page, { meta: META_WITH_2026, values: ROWS_2026 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Two entry rows hydrated from Sheets
    await expect(page.locator('[data-testid="entry-row"]')).toHaveCount(2);

    // hydratedAt written to IDB with correct rowCount
    const hydratedAt = await idbGetAppMeta<
      Record<string, { lastHydratedAt: number; rowCount: number }>
    >(page, 'hydratedAt');
    expect(hydratedAt?.['2026']).toMatchObject({ rowCount: 2 });
  });

  // ── H-03: Already-hydrated tab not re-fetched from Sheets ──────────────────

  test('H-03: already-hydrated tab is skipped — values endpoint not called on reload', async ({
    authedPage,
  }) => {
    await idbPutAppMeta(authedPage, 'hydratedAt', {
      '2026': { lastHydratedAt: Date.now() - 60_000, rowCount: 1 },
    });
    await idbSeedEntry(authedPage, makeEntry('uuid-e2e-h03', '2026-04-15'));

    let valuesRequested = false;
    await authedPage.route('**/sheets.googleapis.com/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/values/')) {
        valuesRequested = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ values: [] }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(META_WITH_2026),
        });
      }
    });

    await authedPage.reload();
    await authedPage.waitForLoadState('networkidle');

    // The values endpoint must not have been called — skip respected hydratedAt
    expect(valuesRequested).toBe(false);
    await expect(authedPage.locator('[data-testid="entry-row"]')).toHaveCount(1);
  });

  // ── H-04: Empty state when no year tabs and no entries ──────────────────────

  test('H-04: empty state visible when no year tabs in spreadsheet and no entries', async ({
    authedPage,
  }) => {
    await installSheetsMock(authedPage, { meta: META_NO_TABS, values: [] });

    await authedPage.reload();
    await authedPage.waitForLoadState('networkidle');

    await expect(authedPage.locator('[data-testid="empty-state"]')).toBeVisible();
    await expect(authedPage.locator('[data-testid="hydration-progress"]')).not.toBeVisible();
  });
});
