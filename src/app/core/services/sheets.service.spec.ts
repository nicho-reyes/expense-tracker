import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { SheetsService } from './sheets.service';
import { IdbService } from './idb.service';
import { NotificationService } from './notification.service';
import { SCHEMA_2026_HEADERS, SCHEMA_2025_HEADERS } from '../models/sheets.model';
import { LocalEntry } from '../models/entry.model';

const MOCK_ENTRY: LocalEntry = {
  id: 'entry-uuid-sheets-test',
  date: '2026-05-09',
  month: '2026-05',
  year: 2026,
  category: 'Food',
  amount: 12.5,
  remarks: 'Lunch',
  tabName: '2026',
  schemaVersion: '2026',
  sheetRowIndex: null,
  syncStatus: 'pending',
  isReadOnly: false,
};

describe('SheetsService', () => {
  let service: SheetsService;
  let httpSpy: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  let idbSpy: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let notificationSpy: { showError: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpSpy = { get: vi.fn(), post: vi.fn() };
    idbSpy = { get: vi.fn().mockResolvedValue(undefined), set: vi.fn().mockResolvedValue(undefined) };
    notificationSpy = { showError: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        SheetsService,
        { provide: HttpClient, useValue: httpSpy },
        { provide: IdbService, useValue: idbSpy },
        { provide: NotificationService, useValue: notificationSpy },
      ],
    });
    service = TestBed.inject(SheetsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractSpreadsheetId()', () => {
    it('extracts ID from full Google Sheets URL', () => {
      const url = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0';
      expect(service.extractSpreadsheetId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
    });

    it('returns bare ID directly when it is ≥20 alphanumeric chars', () => {
      const id = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms';
      expect(service.extractSpreadsheetId(id)).toBe(id);
    });

    it('returns null for a short or invalid string', () => {
      expect(service.extractSpreadsheetId('short')).toBeNull();
      expect(service.extractSpreadsheetId('not a url or id')).toBeNull();
      expect(service.extractSpreadsheetId('')).toBeNull();
    });

    it('trims whitespace before parsing', () => {
      const id = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms';
      expect(service.extractSpreadsheetId(`  ${id}  `)).toBe(id);
    });
  });

  describe('detectSchema()', () => {
    it('returns type 2026 for a 6-column 2026 header row', () => {
      const result = service.detectSchema('Sheet1', SCHEMA_2026_HEADERS);
      expect(result).toEqual({ type: '2026', tabName: 'Sheet1' });
    });

    it('returns type 2025 for a 4-column 2025 header row', () => {
      const result = service.detectSchema('Old', SCHEMA_2025_HEADERS);
      expect(result).toEqual({ type: '2025', tabName: 'Old' });
    });

    it('returns type mismatch when first 5 columns match 2026 but UUID is missing', () => {
      const headers = ['Date', 'Category', 'Amount', 'Remarks', 'Month'];
      const result = service.detectSchema('Partial', headers);
      expect(result.type).toBe('mismatch');
      expect(result.tabName).toBe('Partial');
      if (result.type === 'mismatch') {
        expect(result.error.type).toBe('SCHEMA_MISMATCH');
      }
    });

    it('returns type invalid for unrecognized headers', () => {
      const headers = ['Foo', 'Bar', 'Baz'];
      const result = service.detectSchema('Unknown', headers);
      expect(result.type).toBe('invalid');
      expect(result.tabName).toBe('Unknown');
      if (result.type === 'invalid') {
        expect(result.error.type).toBe('SCHEMA_VALIDATION');
      }
    });

    it('returns type invalid for empty headers', () => {
      const result = service.detectSchema('Empty', []);
      expect(result.type).toBe('invalid');
    });
  });

  describe('fetchSpreadsheetMeta()', () => {
    it('maps a 403 HTTP error to AppError SHEETS_API with access message', async () => {
      const httpError = { status: 403, message: 'Forbidden' };
      httpSpy.get.mockReturnValue(throwError(() => httpError));

      await expect(
        firstValueFrom(service.fetchSpreadsheetMeta('someId'))
      ).rejects.toMatchObject({
        type: 'SHEETS_API',
        status: 403,
        message: expect.stringContaining('sharing settings'),
      });
    });

    it('maps a 404 HTTP error to AppError SHEETS_API with not-found message', async () => {
      const httpError = { status: 404, message: 'Not Found' };
      httpSpy.get.mockReturnValue(throwError(() => httpError));

      await expect(
        firstValueFrom(service.fetchSpreadsheetMeta('badId'))
      ).rejects.toMatchObject({
        type: 'SHEETS_API',
        status: 404,
        message: expect.stringContaining('not found'),
      });
    });

    it('returns spreadsheet metadata on success', async () => {
      const mockMeta = {
        spreadsheetId: 'abc123',
        properties: { title: 'My Sheet' },
        sheets: [],
      };
      httpSpy.get.mockReturnValue(of(mockMeta));

      const result = await firstValueFrom(service.fetchSpreadsheetMeta('abc123'));
      expect(result).toEqual(mockMeta);
    });
  });

  describe('ensureLoaded()', () => {
    it('reads spreadsheetId from IDB and sets connectedSpreadsheetId signal', async () => {
      idbSpy.get.mockResolvedValue('stored-id-123');
      expect(service.connectedSpreadsheetId()).toBeNull();

      await service.ensureLoaded();

      expect(service.connectedSpreadsheetId()).toBe('stored-id-123');
      expect(service.isSheetConnected()).toBe(true);
    });

    it('sets signal to null when IDB has no spreadsheetId', async () => {
      idbSpy.get.mockResolvedValue(undefined);
      await service.ensureLoaded();

      expect(service.connectedSpreadsheetId()).toBeNull();
      expect(service.isSheetConnected()).toBe(false);
    });

    it('is a no-op on the second call (does not re-read IDB)', async () => {
      idbSpy.get.mockResolvedValue('first-id');
      await service.ensureLoaded();
      // Now calls idb.get twice: once for spreadsheetId, once for schemaCache
      expect(idbSpy.get).toHaveBeenCalledTimes(2);

      await service.ensureLoaded();
      expect(idbSpy.get).toHaveBeenCalledTimes(2);
    });

    it('loads schemaCache from IDB into signal', async () => {
      const cache = { '2026-tab': '2026' as const };
      idbSpy.get.mockImplementation((_store: string, key: string) => {
        if (key === 'spreadsheetId') return Promise.resolve('sid');
        if (key === 'schemaCache') return Promise.resolve(cache);
        return Promise.resolve(undefined);
      });

      await service.ensureLoaded();

      expect(service.schemaCache()).toEqual(cache);
    });
  });

  describe('connectSheet()', () => {
    it('writes spreadsheetId and schemaCache to IDB and updates signal', async () => {
      const schemaCache = { Sheet1: '2026' as const, Old: '2025' as const };
      await service.connectSheet('new-id-456', schemaCache);

      expect(idbSpy.set).toHaveBeenCalledWith('appMeta', 'spreadsheetId', 'new-id-456');
      expect(idbSpy.set).toHaveBeenCalledWith('appMeta', 'schemaCache', schemaCache);
      expect(service.connectedSpreadsheetId()).toBe('new-id-456');
      expect(service.schemaCache()).toEqual(schemaCache);
    });
  });

  describe('findCategoriesTab()', () => {
    it("returns { tabName: 'Categories' } when a 'Categories' sheet is present", async () => {
      const mockMeta = {
        spreadsheetId: 'sid',
        properties: { title: 'My Sheet' },
        sheets: [
          { properties: { title: 'Categories' } },
          { properties: { title: '2026' } },
        ],
      };
      httpSpy.get.mockReturnValue(of(mockMeta));

      const result = await service.findCategoriesTab('sid');
      expect(result).toEqual({ tabName: 'Categories' });
    });

    it('returns null when no matching tab is found', async () => {
      const mockMeta = {
        spreadsheetId: 'sid',
        properties: { title: 'My Sheet' },
        sheets: [{ properties: { title: '2026' } }],
      };
      httpSpy.get.mockReturnValue(of(mockMeta));

      const result = await service.findCategoriesTab('sid');
      expect(result).toBeNull();
    });

    it('performs case-sensitive match — does not match categories (lowercase)', async () => {
      const mockMeta = {
        spreadsheetId: 'sid',
        properties: { title: 'My Sheet' },
        sheets: [{ properties: { title: 'categories' } }],
      };
      httpSpy.get.mockReturnValue(of(mockMeta));

      const result = await service.findCategoriesTab('sid');
      expect(result).toBeNull();
    });
  });

  describe('readCategoriesTabColumn()', () => {
    it("uses URL-encoded 'Categories'!A2:A range", async () => {
      httpSpy.get.mockReturnValue(of({ values: [['Food'], ['Transport']] }));
      const { firstValueFrom: fvf } = await import('rxjs');

      await fvf(service.readCategoriesTabColumn('my-sheet-id'));

      const calledUrl: string = httpSpy.get.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent("'Categories'!A2:A"));
    });

    it('trims and filters empty values', async () => {
      httpSpy.get.mockReturnValue(of({ values: [['  Food  '], [''], ['Transport']] }));
      const { firstValueFrom: fvf } = await import('rxjs');

      const result = await fvf(service.readCategoriesTabColumn('sid'));
      expect(result).toEqual(['Food', 'Transport']);
    });

    it('maps HTTP error to SHEETS_API AppError', async () => {
      httpSpy.get.mockReturnValue(throwError(() => ({ status: 403, message: 'Forbidden' })));
      const { firstValueFrom: fvf } = await import('rxjs');

      await expect(fvf(service.readCategoriesTabColumn('sid'))).rejects.toMatchObject({
        type: 'SHEETS_API',
        status: 403,
      });
    });
  });

  describe('readActiveTabCategoryColumn()', () => {
    it('uses URL-encoded range with escaped tab name for column B', async () => {
      httpSpy.get.mockReturnValue(of({ values: [] }));
      const { firstValueFrom: fvf } = await import('rxjs');

      await fvf(service.readActiveTabCategoryColumn('sid', '2026'));

      const calledUrl: string = httpSpy.get.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent("'2026'!B2:B"));
    });

    it("escapes single quotes in tab name — Fred's 2026 → Fred''s 2026", async () => {
      httpSpy.get.mockReturnValue(of({ values: [] }));
      const { firstValueFrom: fvf } = await import('rxjs');

      await fvf(service.readActiveTabCategoryColumn('sid', "Fred's 2026"));

      const calledUrl: string = httpSpy.get.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent("'Fred''s 2026'!B2:B"));
    });

    it('trims and filters empty values', async () => {
      httpSpy.get.mockReturnValue(of({ values: [[''], ['  Food  '], ['Transport'], ['']] }));
      const { firstValueFrom: fvf } = await import('rxjs');

      const result = await fvf(service.readActiveTabCategoryColumn('sid', '2026'));
      expect(result).toEqual(['Food', 'Transport']);
    });
  });

  describe('getActive2026TabName()', () => {
    it('returns the first 2026 tab name from schemaCache', async () => {
      const schemaCache = { '2026-data': '2026' as const, 'Old': '2025' as const };
      await service.connectSheet('sid', schemaCache);

      expect(service.getActive2026TabName()).toBe('2026-data');
    });

    it('returns null when no 2026 tab is in schemaCache', async () => {
      const schemaCache = { 'Old': '2025' as const };
      await service.connectSheet('sid', schemaCache);

      expect(service.getActive2026TabName()).toBeNull();
    });

    it('returns null when schemaCache is empty', () => {
      expect(service.getActive2026TabName()).toBeNull();
    });
  });

  describe('appendRow()', () => {
    it('posts to correct URL with valueInputOption=USER_ENTERED and insertDataOption=INSERT_ROWS', async () => {
      httpSpy.post = vi.fn().mockReturnValue(of({ updates: { updatedRange: "'2026'!A2:F2", updatedRows: 1 } }));

      await firstValueFrom(service.appendRow('my-sheet-id', '2026', MOCK_ENTRY));

      const calledUrl: string = httpSpy.post.mock.calls[0][0];
      expect(calledUrl).toContain('my-sheet-id');
      expect(calledUrl).toContain('valueInputOption=USER_ENTERED');
      expect(calledUrl).toContain('insertDataOption=INSERT_ROWS');
      expect(calledUrl).toContain(encodeURIComponent("'2026'!A:F"));
    });

    it('sends row with correct column order [date, category, amount, remarks, month, uuid]', async () => {
      httpSpy.post = vi.fn().mockReturnValue(of({ updates: { updatedRange: "'2026'!A2:F2", updatedRows: 1 } }));

      await firstValueFrom(service.appendRow('sid', '2026', MOCK_ENTRY));

      const body = httpSpy.post.mock.calls[0][1];
      expect(body.values[0]).toEqual([
        '2026-05-09',
        'Food',
        '12.5',
        'Lunch',
        '2026-05',
        'entry-uuid-sheets-test',
      ]);
    });

    it('maps 429 quota error to SHEETS_API AppError with quota message', async () => {
      httpSpy.post = vi.fn().mockReturnValue(throwError(() => ({ status: 429, message: 'Too Many Requests' })));

      await expect(firstValueFrom(service.appendRow('sid', '2026', MOCK_ENTRY))).rejects.toMatchObject({
        type: 'SHEETS_API',
        status: 429,
        message: expect.stringContaining('quota'),
      });
    });

    it('maps 503 transient error to SHEETS_API AppError', async () => {
      httpSpy.post = vi.fn().mockReturnValue(throwError(() => ({ status: 503, message: 'Service Unavailable' })));

      await expect(firstValueFrom(service.appendRow('sid', '2026', MOCK_ENTRY))).rejects.toMatchObject({
        type: 'SHEETS_API',
        status: 503,
      });
    });

    it("escapes single quotes in tab name — Fred's 2026 → Fred''s 2026 in URL", async () => {
      httpSpy.post = vi.fn().mockReturnValue(of({ updates: { updatedRange: "'Fred''s 2026'!A2:F2", updatedRows: 1 } }));

      await firstValueFrom(service.appendRow('sid', "Fred's 2026", MOCK_ENTRY));

      const calledUrl: string = httpSpy.post.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent("'Fred''s 2026'!A:F"));
    });
  });

  describe('appendCategoryRow()', () => {
    const MOCK_CATEGORY = { id: 'cat-uuid-1', name: 'Groceries', color: '#6366f1', position: 0 };

    beforeEach(async () => {
      idbSpy.get = vi.fn().mockImplementation(async (_store: string, key: string) => {
        if (key === 'spreadsheetId') return 'fake-sheet-id';
        return undefined;
      });
      await service.ensureLoaded();
    });

    it('posts to values/Categories!A:D:append with correct row payload', async () => {
      httpSpy.post = vi.fn().mockReturnValue(of({ updates: { updatedRows: 1 } }));

      await firstValueFrom(service.appendCategoryRow(MOCK_CATEGORY));

      const [calledUrl, calledBody] = httpSpy.post.mock.calls[0];
      expect(calledUrl).toContain(encodeURIComponent("'Categories'!A:D"));
      expect(calledUrl).toContain(':append');
      expect(calledBody.values[0]).toEqual([
        MOCK_CATEGORY.id,
        MOCK_CATEGORY.name,
        MOCK_CATEGORY.color,
        MOCK_CATEGORY.position,
      ]);
    });

    it('HTTP 400 triggers tab creation then retries append', async () => {
      httpSpy.post = vi.fn()
        .mockReturnValueOnce(throwError(() => ({ status: 400, message: 'Invalid range' })))
        .mockReturnValueOnce(of({ replies: [] }))
        .mockReturnValueOnce(of({ updates: { updatedRows: 1 } }));

      await firstValueFrom(service.appendCategoryRow(MOCK_CATEGORY));

      expect(httpSpy.post).toHaveBeenCalledTimes(3);
      const batchUpdateUrl: string = httpSpy.post.mock.calls[1][0];
      expect(batchUpdateUrl).toContain(':batchUpdate');
    });

    it('HTTP 403 maps to AppError.SHEETS_API { status: 403 }', async () => {
      httpSpy.post = vi.fn().mockReturnValue(
        throwError(() => ({ status: 403, message: 'Forbidden' })),
      );

      await expect(firstValueFrom(service.appendCategoryRow(MOCK_CATEGORY))).rejects.toMatchObject({
        type: 'SHEETS_API',
        status: 403,
      });
    });
  });
});
