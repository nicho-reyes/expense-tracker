import { test, expect } from './fixtures/auth.fixture';
import { installSheetsMock } from './fixtures/sheets-mock';
import { idbGetAll, idbSeedEntry, idbClear } from './support/idb-helpers';

// NOTE: E2-01 through E2-06 require Stories 2.2 (QuickAdd UI), 2.3 (EntryList), and 2.4 (Edit/Delete)
// to be fully implemented. These tests are structurally complete and will pass once those stories land.
// E2-07 (syncQueue assertion) exercises the SyncQueueService implemented in Story 2.5.

test.describe('Entry Form (Epic 2 E2E)', () => {
  test.beforeEach(async ({ authedPage }) => {
    await installSheetsMock(authedPage);
    await idbClear(authedPage, 'entries');
    await idbClear(authedPage, 'syncQueue');
  });

  // E2-01: QuickAdd bottom sheet opens on FAB tap
  test.skip('E2-01: QuickAdd bottom sheet opens on FAB tap', async ({ authedPage }) => {
    const fab = authedPage.locator('[data-testid="fab-add"]');
    await expect(fab).toBeVisible();
    await fab.tap();
    const sheet = authedPage.locator('[data-testid="quickadd-sheet"]');
    await expect(sheet).toBeVisible();
  });

  // E2-02: Valid entry submitted → appears in entry list
  test.skip('E2-02: Valid entry submitted → appears in entry list with correct amount and category', async ({ authedPage }) => {
    const fab = authedPage.locator('[data-testid="fab-add"]');
    await fab.tap();
    await authedPage.locator('[data-testid="amount-input"]').fill('42.50');
    await authedPage.locator('[data-testid="category-select"]').selectOption('Food');
    await authedPage.locator('[data-testid="submit-button"]').tap();
    const row = authedPage.locator('[data-testid="entry-row"]').first();
    await expect(row).toContainText('42.50');
    await expect(row).toContainText('Food');
  });

  // E2-03: Amount field empty → submit blocked
  test.skip('E2-03: Amount field empty → submit blocked, inline validation error visible', async ({ authedPage }) => {
    const fab = authedPage.locator('[data-testid="fab-add"]');
    await fab.tap();
    await authedPage.locator('[data-testid="submit-button"]').tap();
    const error = authedPage.locator('[data-testid="amount-error"]');
    await expect(error).toBeVisible();
    const sheet = authedPage.locator('[data-testid="quickadd-sheet"]');
    await expect(sheet).toBeVisible(); // sheet stays open
  });

  // E2-04: Edit entry → bottom sheet pre-fills → save → list row updated
  test.skip('E2-04: Edit entry → bottom sheet pre-fills values → save → list row updated', async ({ authedPage }) => {
    await idbSeedEntry(authedPage, {
      id: 'seed-entry-1',
      date: '2026-05-09',
      month: '2026-05',
      year: 2026,
      category: 'Food',
      amount: 10,
      remarks: 'Coffee',
      tabName: '2026',
      schemaVersion: '2026',
      sheetRowIndex: null,
      syncStatus: 'pending',
      isReadOnly: false,
    });
    await authedPage.reload();
    const row = authedPage.locator('[data-testid="entry-row"]').first();
    await row.locator('[data-testid="edit-button"]').tap();
    const sheet = authedPage.locator('[data-testid="quickadd-sheet"]');
    await expect(sheet).toBeVisible();
    const amountField = sheet.locator('[data-testid="amount-input"]');
    await expect(amountField).toHaveValue('10');
    await amountField.fill('20');
    await sheet.locator('[data-testid="submit-button"]').tap();
    await expect(row).toContainText('20');
  });

  // E2-05: Delete entry → confirm dialog → row removed
  test.skip('E2-05: Delete entry → confirm dialog → row removed from list', async ({ authedPage }) => {
    await idbSeedEntry(authedPage, {
      id: 'seed-entry-delete',
      date: '2026-05-09',
      month: '2026-05',
      year: 2026,
      category: 'Transport',
      amount: 5,
      remarks: 'Bus',
      tabName: '2026',
      schemaVersion: '2026',
      sheetRowIndex: null,
      syncStatus: 'pending',
      isReadOnly: false,
    });
    await authedPage.reload();
    const row = authedPage.locator('[data-testid="entry-row"]').first();
    await row.locator('[data-testid="delete-button"]').tap();
    const dialog = authedPage.locator('[data-testid="confirm-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-testid="confirm-button"]').tap();
    await expect(authedPage.locator('[data-testid="entry-row"]')).toHaveCount(0);
  });

  // E2-06: Entry survives page reload — IDB persistence
  test.skip('E2-06: Entry survives page reload — IDB persistence assertion via idb-helpers', async ({ authedPage }) => {
    const fab = authedPage.locator('[data-testid="fab-add"]');
    await fab.tap();
    await authedPage.locator('[data-testid="amount-input"]').fill('15');
    await authedPage.locator('[data-testid="submit-button"]').tap();
    await authedPage.reload();
    const entries = await idbGetAll(authedPage, 'entries');
    expect(entries).toHaveLength(1);
  });

  // E2-07: After entry save → syncQueue IDB store contains 1 PENDING record
  // This test validates Story 2.5's SyncQueueService integration.
  // It requires the QuickAdd UI (Story 2.2) to call syncQueueService.enqueue() after entriesService.add().
  test.skip('E2-07: After entry save → syncQueue IDB store contains 1 PENDING record', async ({ authedPage }) => {
    const fab = authedPage.locator('[data-testid="fab-add"]');
    await fab.tap();
    await authedPage.locator('[data-testid="amount-input"]').fill('25');
    await authedPage.locator('[data-testid="category-select"]').selectOption('Food');
    await authedPage.locator('[data-testid="submit-button"]').tap();

    const queue = await idbGetAll(authedPage, 'syncQueue');
    expect(queue.length).toBeGreaterThanOrEqual(1);
    const item = queue[0] as Record<string, unknown>;
    expect(item['status']).toBe('PENDING');
    expect(item['operation']).toBe('INSERT');
  });
});
