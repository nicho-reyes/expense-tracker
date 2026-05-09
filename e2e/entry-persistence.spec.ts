import { test, expect } from '@playwright/test';

// NFR-R2 pass/fail gate: PENDING and SYNC_ERROR queue items must survive tab close+reopen
// with all fields intact (id, status, retryCount, nextRetryAt, errorMessage).
test.describe('NFR-R2: IDB persistence across reloads', () => {
  const DB_NAME = 'expense-dashboard';
  const DB_VERSION = 1;

  const ENTRY = {
    id: 'persist-entry-1',
    date: '2026-05-09',
    month: '2026-05',
    year: 2026,
    category: 'Food',
    amount: 12.5,
    remarks: 'Persistence test',
    tabName: '2026',
    schemaVersion: '2026',
    sheetRowIndex: null,
    syncStatus: 'pending',
    isReadOnly: false,
  };

  const QUEUE_PENDING = {
    id: 'queue-persist-pending',
    operation: 'INSERT',
    entryData: ENTRY,
    targetEntryId: null,
    targetTabName: null,
    enqueuedAt: 1700000000000,
    status: 'PENDING',
    retryCount: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    errorMessage: null,
  };

  const QUEUE_SYNC_ERROR = {
    id: 'queue-persist-error',
    operation: 'INSERT',
    entryData: ENTRY,
    targetEntryId: null,
    targetTabName: null,
    enqueuedAt: 1700000001000,
    status: 'SYNC_ERROR',
    retryCount: 3,
    lastAttemptAt: 1700000002000,
    nextRetryAt: 1700000060000,
    errorMessage: 'network timeout',
  };

  async function writeDirectlyToIdb(page: import('@playwright/test').Page, records: {
    entries: object[];
    syncQueue: object[];
  }): Promise<void> {
    await page.evaluate(
      ({ dbName, dbVersion, entries, syncQueue }) => {
        return new Promise<void>((resolve, reject) => {
          const req = indexedDB.open(dbName, dbVersion);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(['entries', 'syncQueue'], 'readwrite');
            tx.onerror = () => reject(tx.error);
            tx.oncomplete = () => resolve();
            for (const entry of entries) {
              tx.objectStore('entries').put(entry);
            }
            for (const item of syncQueue) {
              tx.objectStore('syncQueue').put(item);
            }
          };
          req.onupgradeneeded = () => {
            // DB already created by the app; if this fires it means the page didn't initialize
            reject(new Error('Unexpected DB upgrade — load the app page first'));
          };
        });
      },
      { dbName: DB_NAME, dbVersion: DB_VERSION, entries: records.entries, syncQueue: records.syncQueue },
    );
  }

  async function readAllFromIdb(page: import('@playwright/test').Page): Promise<{
    entries: object[];
    syncQueue: object[];
  }> {
    return page.evaluate(
      ({ dbName, dbVersion }) => {
        return new Promise<{ entries: object[]; syncQueue: object[] }>((resolve, reject) => {
          const req = indexedDB.open(dbName, dbVersion);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(['entries', 'syncQueue'], 'readonly');
            const entriesReq = tx.objectStore('entries').getAll();
            const queueReq = tx.objectStore('syncQueue').getAll();
            tx.oncomplete = () =>
              resolve({ entries: entriesReq.result, syncQueue: queueReq.result });
            tx.onerror = () => reject(tx.error);
          };
        });
      },
      { dbName: DB_NAME, dbVersion: DB_VERSION },
    );
  }

  test('LocalEntry and PENDING + SYNC_ERROR SyncQueueItems survive a full page reload', async ({ page }) => {
    // Navigate to app to initialize the IDB schema
    await page.goto('/');

    // Wait for the DB to be initialized (app shell renders)
    await page.waitForLoadState('networkidle');

    // Write records directly via indexedDB API
    await writeDirectlyToIdb(page, {
      entries: [ENTRY],
      syncQueue: [QUEUE_PENDING, QUEUE_SYNC_ERROR],
    });

    // Reload the page (simulates tab close + reopen)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Read back all records
    const { entries, syncQueue } = await readAllFromIdb(page);

    // Assert LocalEntry is intact
    const persistedEntry = (entries as typeof ENTRY[]).find(e => e.id === ENTRY.id);
    expect(persistedEntry).toBeDefined();
    expect(persistedEntry!.id).toBe(ENTRY.id);
    expect(persistedEntry!.syncStatus).toBe(ENTRY.syncStatus);
    expect(persistedEntry!.month).toBe(ENTRY.month);
    expect(persistedEntry!.year).toBe(ENTRY.year);

    // Assert PENDING item is intact
    const pendingItem = (syncQueue as typeof QUEUE_PENDING[]).find(i => i.id === QUEUE_PENDING.id);
    expect(pendingItem).toBeDefined();
    expect(pendingItem!.status).toBe('PENDING');
    expect(pendingItem!.retryCount).toBe(0);
    expect(pendingItem!.nextRetryAt).toBeNull();

    // Assert SYNC_ERROR item is intact with all fields (NFR-R2 core check)
    const errorItem = (syncQueue as typeof QUEUE_SYNC_ERROR[]).find(i => i.id === QUEUE_SYNC_ERROR.id);
    expect(errorItem).toBeDefined();
    expect(errorItem!.status).toBe('SYNC_ERROR');
    expect(errorItem!.retryCount).toBe(3);
    expect(errorItem!.nextRetryAt).toBe(1700000060000);
    expect(errorItem!.errorMessage).toBe('network timeout');
  });
});
