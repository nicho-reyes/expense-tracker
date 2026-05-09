import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { HydrationService } from './hydration.service';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { EntriesService } from './entries.service';
import { NotificationService } from './notification.service';
import { LocalEntry } from '../models/entry.model';
import { AppError } from '../models/error.model';
import { HydratedTabRecord } from '../models/sheets.model';

function makeTab(title: string) {
  return { properties: { sheetId: 1, title, index: 0, sheetType: 'GRID', gridProperties: { rowCount: 100, columnCount: 6 } } };
}

function makeEntry(id: string): LocalEntry {
  return {
    id,
    date: '2026-05-01',
    month: '2026-05',
    year: 2026,
    category: 'Food',
    amount: 10,
    remarks: '',
    tabName: '2026',
    schemaVersion: '2026',
    sheetRowIndex: 2,
    syncStatus: 'synced',
    isReadOnly: false,
  };
}

describe('HydrationService', () => {
  let service: HydrationService;
  let idbSpy: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };
  let sheetsSpy: {
    ensureLoaded: ReturnType<typeof vi.fn>;
    connectedSpreadsheetId: ReturnType<typeof vi.fn>;
    schemaCache: ReturnType<typeof vi.fn>;
    listYearTabs: ReturnType<typeof vi.fn>;
    readTabDataRows: ReturnType<typeof vi.fn>;
    mapRowToLocalEntry: ReturnType<typeof vi.fn>;
  };
  let entriesSpy: { refreshFromIdb: ReturnType<typeof vi.fn> };
  let notificationSpy: { showError: ReturnType<typeof vi.fn> };

  const SPREADSHEET_ID = 'test-spreadsheet-id';
  const TAB_2026 = makeTab('2026');

  const RAW_ROW_WITH_UUID = ['2026-05-01', 'Food', '10', 'Lunch', '2026-05', 'row-uuid-1'];
  const RAW_ROW_NO_UUID = ['2026-05-01', 'Food', '10', 'Lunch', '2026-05', ''];
  const RAW_ROW_BAD_AMOUNT = ['2026-05-01', 'Food', 'NaN', 'Lunch', '2026-05', ''];

  beforeEach(() => {
    idbSpy = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
    };
    sheetsSpy = {
      ensureLoaded: vi.fn().mockResolvedValue(undefined),
      connectedSpreadsheetId: vi.fn().mockReturnValue(SPREADSHEET_ID),
      schemaCache: vi.fn().mockReturnValue({ '2026': '2026' }),
      listYearTabs: vi.fn().mockResolvedValue([TAB_2026]),
      readTabDataRows: vi.fn().mockReturnValue(of([])),
      mapRowToLocalEntry: vi.fn().mockReturnValue(null),
    };
    entriesSpy = { refreshFromIdb: vi.fn().mockResolvedValue(undefined) };
    notificationSpy = { showError: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        HydrationService,
        { provide: IdbService, useValue: idbSpy },
        { provide: SheetsService, useValue: sheetsSpy },
        { provide: EntriesService, useValue: entriesSpy },
        { provide: NotificationService, useValue: notificationSpy },
      ],
    });
    service = TestBed.inject(HydrationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── no spreadsheet connected ──────────────────────────────────────────────

  it('init() with no spreadsheet connected returns early; progress stays idle', async () => {
    sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);

    await service.init();

    expect(sheetsSpy.listYearTabs).not.toHaveBeenCalled();
    expect(service.progress()).toEqual({ type: 'idle' });
  });

  // ── tab filtering ─────────────────────────────────────────────────────────

  it('hydrate() skips tabs not in schemaCache as 2026 (non-year-schema)', async () => {
    sheetsSpy.schemaCache.mockReturnValue({ '2025': '2025' });
    sheetsSpy.listYearTabs.mockResolvedValue([makeTab('2025')]);

    const results = await service.hydrate();

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ type: 'skipped', tabName: '2025', reason: 'non-2026-schema' });
    expect(sheetsSpy.readTabDataRows).not.toHaveBeenCalled();
  });

  it('hydrate() skips tab already in hydratedAt unless force=true', async () => {
    const existingMap: Record<string, HydratedTabRecord> = {
      '2026': { lastHydratedAt: Date.now() - 1000, rowCount: 5 },
    };
    idbSpy.get.mockResolvedValue(existingMap);

    const results = await service.hydrate({ force: false });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ type: 'skipped', tabName: '2026', reason: 'already-hydrated' });
    expect(sheetsSpy.readTabDataRows).not.toHaveBeenCalled();
  });

  // ── happy path hydration ──────────────────────────────────────────────────

  it('hydrate() happy path — 3 valid rows → 3 IDB puts, appMeta updated, refreshFromIdb called', async () => {
    const row1 = makeEntry('uuid-1');
    const row2 = makeEntry('uuid-2');
    const row3 = makeEntry('uuid-3');

    sheetsSpy.readTabDataRows.mockReturnValue(of([RAW_ROW_WITH_UUID, RAW_ROW_WITH_UUID, RAW_ROW_WITH_UUID]));
    sheetsSpy.mapRowToLocalEntry
      .mockReturnValueOnce(row1)
      .mockReturnValueOnce(row2)
      .mockReturnValueOnce(row3);

    const results = await service.hydrate();

    expect(idbSpy.put).toHaveBeenCalledTimes(3);
    expect(idbSpy.set).toHaveBeenCalledWith('appMeta', 'hydratedAt', expect.objectContaining({
      '2026': expect.objectContaining({ rowCount: 3 }),
    }));
    expect(entriesSpy.refreshFromIdb).toHaveBeenCalledTimes(1);
    expect(results[0]).toMatchObject({ type: 'hydrated', tabName: '2026', rowCount: 3 });
  });

  // ── UUID vs deterministic id ──────────────────────────────────────────────

  it('mapRowToLocalEntry called with correct sheetRowIndex (row 1 → index 2)', async () => {
    const entry = makeEntry('hydrated-2026-2');
    sheetsSpy.readTabDataRows.mockReturnValue(of([RAW_ROW_NO_UUID]));
    sheetsSpy.mapRowToLocalEntry.mockReturnValue(entry);

    await service.hydrate();

    expect(sheetsSpy.mapRowToLocalEntry).toHaveBeenCalledWith('2026', 2, RAW_ROW_NO_UUID);
  });

  // ── partial hydration (invalid rows) ─────────────────────────────────────

  it('one malformed row in 5-row tab → 4 entries hydrated, tab still marked lastHydratedAt', async () => {
    const rows = Array(5).fill(RAW_ROW_WITH_UUID);
    sheetsSpy.readTabDataRows.mockReturnValue(of(rows));
    sheetsSpy.mapRowToLocalEntry
      .mockReturnValueOnce(makeEntry('e1'))
      .mockReturnValueOnce(makeEntry('e2'))
      .mockReturnValueOnce(makeEntry('e3'))
      .mockReturnValueOnce(makeEntry('e4'))
      .mockReturnValueOnce(null); // 5th row is malformed

    const results = await service.hydrate();

    expect(idbSpy.put).toHaveBeenCalledTimes(4);
    expect(idbSpy.set).toHaveBeenCalledWith('appMeta', 'hydratedAt', expect.objectContaining({
      '2026': expect.objectContaining({ rowCount: 4 }),
    }));
    expect(notificationSpy.showError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SCHEMA_VALIDATION' }),
    );
    expect(results).toContainEqual(
      expect.objectContaining({ type: 'invalid', tabName: '2026' }),
    );
  });

  // ── deferred tab on read failure ──────────────────────────────────────────

  it('readTabDataRows rejection → deferred result, appMeta NOT updated, showError called, run continues', async () => {
    const sheetsErr: AppError = { type: 'SHEETS_API', status: 429, message: 'quota' };
    sheetsSpy.readTabDataRows.mockReturnValue(throwError(() => sheetsErr));

    const results = await service.hydrate();

    expect(results[0]).toMatchObject({ type: 'deferred', tabName: '2026', error: sheetsErr });
    expect(idbSpy.set).not.toHaveBeenCalled();
    expect(notificationSpy.showError).toHaveBeenCalledWith(sheetsErr);
  });

  // ── re-run idempotency ────────────────────────────────────────────────────

  it('re-running hydrate() after success skips tab (already-hydrated)', async () => {
    sheetsSpy.readTabDataRows.mockReturnValue(of([RAW_ROW_WITH_UUID]));
    sheetsSpy.mapRowToLocalEntry.mockReturnValue(makeEntry('uuid-x'));

    // First run — succeeds, writes hydratedAt
    let capturedMap: Record<string, HydratedTabRecord> = {};
    idbSpy.set.mockImplementation((_store: string, _key: string, val: Record<string, HydratedTabRecord>) => {
      capturedMap = val;
    });
    idbSpy.get.mockResolvedValue(undefined); // no prior hydratedAt
    await service.hydrate({ force: false });

    // Second run — hydratedAt now present
    idbSpy.get.mockResolvedValue(capturedMap);
    vi.clearAllMocks();
    idbSpy.get.mockResolvedValue(capturedMap);
    idbSpy.set.mockResolvedValue(undefined);

    const results = await service.hydrate({ force: false });

    expect(results[0]).toMatchObject({ type: 'skipped', reason: 'already-hydrated' });
    expect(sheetsSpy.readTabDataRows).not.toHaveBeenCalled();
  });

  it('force=true re-reads even a previously hydrated tab', async () => {
    const existingMap: Record<string, HydratedTabRecord> = {
      '2026': { lastHydratedAt: Date.now() - 1000, rowCount: 3 },
    };
    idbSpy.get.mockResolvedValue(existingMap);
    sheetsSpy.readTabDataRows.mockReturnValue(of([RAW_ROW_WITH_UUID]));
    sheetsSpy.mapRowToLocalEntry.mockReturnValue(makeEntry('uuid-y'));

    const results = await service.hydrate({ force: true });

    expect(sheetsSpy.readTabDataRows).toHaveBeenCalled();
    expect(results[0]).toMatchObject({ type: 'hydrated', tabName: '2026' });
  });

  // ── progress signal ───────────────────────────────────────────────────────

  it('progress transitions from idle → running → complete during hydrate()', async () => {
    const progressStates: string[] = [];
    sheetsSpy.readTabDataRows.mockReturnValue(of([]));

    // capture signal state on each change
    const originalHydrate = service.hydrate.bind(service);
    let runningCaptured = false;

    sheetsSpy.readTabDataRows.mockImplementation(() => {
      progressStates.push(service.progress().type);
      runningCaptured = true;
      return of([]);
    });

    await service.hydrate();

    expect(runningCaptured).toBe(true);
    expect(progressStates).toContain('running');
    expect(service.progress()).toMatchObject({ type: 'complete' });

    void originalHydrate;
  });

  // ── init() swallows errors ────────────────────────────────────────────────

  it('init() does not rethrow when hydrate throws internally', async () => {
    sheetsSpy.ensureLoaded.mockRejectedValue(new Error('network fail'));

    await expect(service.init()).resolves.toBeUndefined();
    expect(notificationSpy.showError).toHaveBeenCalled();
  });

  // ── lastRunSummary ────────────────────────────────────────────────────────

  it('lastRunSummary is set after hydrate() completes', async () => {
    sheetsSpy.readTabDataRows.mockReturnValue(of([]));

    expect(service.lastRunSummary()).toBeNull();

    await service.hydrate();

    expect(service.lastRunSummary()).not.toBeNull();
  });

  // ── concurrency guard ─────────────────────────────────────────────────────

  it('concurrent hydrate() call returns [] without calling Sheets', async () => {
    let resolveEnsure!: (_?: unknown) => void;
    sheetsSpy.ensureLoaded.mockReturnValue(new Promise((r) => (resolveEnsure = r)));
    sheetsSpy.readTabDataRows.mockReturnValue(of([]));

    const first = service.hydrate();
    // Second call fires while first is awaiting ensureLoaded
    const secondResult = await service.hydrate();

    expect(secondResult).toEqual([]);
    expect(sheetsSpy.ensureLoaded).toHaveBeenCalledTimes(1);

    resolveEnsure();
    await first;
  });
});
