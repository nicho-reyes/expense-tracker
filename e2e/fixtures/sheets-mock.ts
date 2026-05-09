import { Page } from '@playwright/test';

export async function installSheetsMock(page: Page): Promise<void> {
  await page.route('**/sheets.googleapis.com/**values**:append**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        updates: { updatedRange: "'2026'!A2:F2", updatedRows: 1 },
      }),
    }),
  );
  await page.route('**/sheets.googleapis.com/**values/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ values: [] }),
    }),
  );
  await page.route('**/sheets.googleapis.com/**spreadsheets/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        spreadsheetId: 'fake-spreadsheet-id',
        properties: { title: 'Test Sheet' },
        sheets: [],
      }),
    }),
  );
}
