import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { SheetsService } from './sheets.service';
import { IdbService } from './idb.service';
import { NotificationService } from './notification.service';
import { SCHEMA_2026_HEADERS, SCHEMA_2025_HEADERS } from '../models/sheets.model';

describe('SheetsService', () => {
  let service: SheetsService;
  let httpSpy: { get: ReturnType<typeof vi.fn> };
  let idbSpy: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let notificationSpy: { showError: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpSpy = { get: vi.fn() };
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
      expect(idbSpy.get).toHaveBeenCalledTimes(1);

      await service.ensureLoaded();
      expect(idbSpy.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('connectSheet()', () => {
    it('writes spreadsheetId and schemaCache to IDB and updates signal', async () => {
      const schemaCache = { Sheet1: '2026' as const, Old: '2025' as const };
      await service.connectSheet('new-id-456', schemaCache);

      expect(idbSpy.set).toHaveBeenCalledWith('appMeta', 'spreadsheetId', 'new-id-456');
      expect(idbSpy.set).toHaveBeenCalledWith('appMeta', 'schemaCache', schemaCache);
      expect(service.connectedSpreadsheetId()).toBe('new-id-456');
    });
  });
});
