import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { IdbService } from './idb.service';
import { environment } from '../../../environments/environment';
import { AppError } from '../models/error.model';
import { LocalEntry } from '../models/entry.model';
import { Category } from '../models/category.model';
import {
  SheetsSpreadsheet,
  SheetsSheetMeta,
  SheetsValueRange,
  SheetsAppendResponse,
  TabSchemaResult,
  schema2026Validator,
  schema2025Validator,
  schema2026PartialValidator,
  schemaNaturalValidator,
  SCHEMA_2026_HEADERS,
  extractYearFromTabName,
} from '../models/sheets.model';

@Injectable({ providedIn: 'root' })
export class SheetsService {
  private readonly http = inject(HttpClient);
  private readonly idb = inject(IdbService);

  private readonly _connectedSpreadsheetId = signal<string | null>(null);
  private readonly _schemaCache = signal<Record<string, '2026' | '2025' | 'natural'>>({});
  private _loadedFromIdb = false;
  private _ensureLoadedPromise: Promise<void> | null = null;

  readonly connectedSpreadsheetId = this._connectedSpreadsheetId.asReadonly();
  readonly isSheetConnected = computed(() => !!this._connectedSpreadsheetId());
  readonly schemaCache = this._schemaCache.asReadonly();

  async ensureLoaded(): Promise<void> {
    if (this._loadedFromIdb) return;
    this._ensureLoadedPromise ??= (async () => {
      const id = await this.idb.get<string>('appMeta', 'spreadsheetId');
      this._connectedSpreadsheetId.set(id ?? null);
      const cache = await this.idb.get<Record<string, '2026' | '2025' | 'natural'>>('appMeta', 'schemaCache');
      this._schemaCache.set(cache ?? {});
      this._loadedFromIdb = true;
    })().catch((err) => {
      this._ensureLoadedPromise = null;
      throw err;
    });
    return this._ensureLoadedPromise;
  }

  extractSpreadsheetId(input: string): string | null {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
    return null;
  }

  fetchSpreadsheetMeta(spreadsheetId: string): Observable<SheetsSpreadsheet> {
    const url =
      `${environment.sheetsApiBaseUrl}/${spreadsheetId}` +
      `?fields=spreadsheetId,properties.title,sheets.properties`;
    return this.http.get<SheetsSpreadsheet>(url).pipe(
      catchError((err: HttpErrorResponse) => {
        const msg =
          err.status === 403
            ? 'No access to this spreadsheet — check sharing settings.'
            : err.status === 404
              ? 'Spreadsheet not found — check the URL or ID.'
              : `Sheets error (${err.status}): ${err.message}`;
        return throwError(
          () =>
            ({
              type: 'SHEETS_API',
              status: err.status,
              message: msg,
            }) satisfies AppError,
        );
      }),
    );
  }

  detectSchema(tabName: string, headers: string[]): TabSchemaResult {
    const full2026 = schema2026Validator.safeParse(headers.slice(0, 6));
    if (full2026.success) {
      return { type: '2026', tabName };
    }
    // Check mismatch before 2025 — a tab with 5 correct 2026 columns is a 2026-intent
    // tab with a missing UUID column (AC6), not a 2025 tab.
    if (schema2026PartialValidator.safeParse(headers.slice(0, 5)).success) {
      return {
        type: 'mismatch',
        tabName,
        error: {
          type: 'SCHEMA_MISMATCH',
          tabName,
          expected: SCHEMA_2026_HEADERS,
          received: headers,
        } satisfies AppError,
      };
    }
    if (schema2025Validator.safeParse(headers.slice(0, 4)).success) {
      return { type: '2025', tabName };
    }
    if (schemaNaturalValidator.safeParse(headers.slice(0, 5)).success) {
      return { type: 'natural', tabName };
    }
    return {
      type: 'invalid',
      tabName,
      error: {
        type: 'SCHEMA_VALIDATION',
        message: `Tab "${tabName}" has unrecognized column headers`,
        details: full2026.error,
      } satisfies AppError,
    };
  }

  async validateAllTabs(
    spreadsheetId: string,
    tabs: SheetsSheetMeta[],
  ): Promise<TabSchemaResult[]> {
    return Promise.all(tabs.map((tab) => this.readTabHeaderRow(spreadsheetId, tab.properties.title)));
  }

  async connectSheet(
    spreadsheetId: string,
    schemaCache: Record<string, '2026' | '2025' | 'natural'>,
  ): Promise<void> {
    await this.idb.set('appMeta', 'spreadsheetId', spreadsheetId);
    await this.idb.set('appMeta', 'schemaCache', schemaCache);
    this._connectedSpreadsheetId.set(spreadsheetId);
    this._schemaCache.set(schemaCache);
  }

  async findCategoriesTab(spreadsheetId: string): Promise<{ tabName: 'Categories' } | null> {
    const meta = await firstValueFrom(this.fetchSpreadsheetMeta(spreadsheetId));
    const sheets = meta?.sheets ?? [];
    const tab = sheets.find((s) => s.properties.title === 'Categories');
    return tab ? { tabName: 'Categories' } : null;
  }

  readCategoriesTabColumn(spreadsheetId: string): Observable<string[]> {
    const range = encodeURIComponent(`'Categories'!A2:A`);
    const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}`;
    return this.http.get<SheetsValueRange>(url).pipe(
      map((res) => (res?.values ?? []).map((row) => (row[0] ?? '').trim()).filter((v) => v.length > 0)),
      catchError((err: HttpErrorResponse) =>
        throwError(() => ({ type: 'SHEETS_API', status: err.status, message: err.message }) satisfies AppError),
      ),
    );
  }

  readActiveTabCategoryColumn(spreadsheetId: string, tabName: string, column: 'B' | 'C' = 'B'): Observable<string[]> {
    const escaped = tabName.replace(/'/g, "''");
    const range = encodeURIComponent(`'${escaped}'!${column}2:${column}`);
    const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}`;
    return this.http.get<SheetsValueRange>(url).pipe(
      map((res) => (res?.values ?? []).map((row) => (row[0] ?? '').trim()).filter((v) => v.length > 0)),
      catchError((err: HttpErrorResponse) =>
        throwError(() => ({ type: 'SHEETS_API', status: err.status, message: err.message }) satisfies AppError),
      ),
    );
  }

  getActive2026TabName(): string | null {
    const cache = this._schemaCache();
    for (const [tabName, schema] of Object.entries(cache)) {
      if (schema === '2026') return tabName;
    }
    return null;
  }

  getActiveNaturalTabName(): string | null {
    const cache = this._schemaCache();
    for (const [tabName, schema] of Object.entries(cache)) {
      if (schema === 'natural') return tabName;
    }
    return null;
  }

  appendRow(spreadsheetId: string, tabName: string, entry: LocalEntry): Observable<SheetsAppendResponse> {
    const escapedTabName = tabName.replace(/'/g, "''");
    const range = encodeURIComponent(`'${escapedTabName}'!A:F`);
    const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const body = {
      values: [[
        entry.date,
        entry.category,
        String(entry.amount),
        entry.remarks,
        entry.month,
        entry.id,
      ]],
    };
    return this.http.post<SheetsAppendResponse>(url, body).pipe(
      catchError((err: HttpErrorResponse) =>
        throwError(() => ({
          type: 'SHEETS_API',
          status: err.status,
          message: err.status === 429
            ? 'Sheets quota exceeded — write queued for retry.'
            : `Sheets write error (${err.status}): ${err.message}`,
        }) satisfies AppError),
      ),
    );
  }

  appendCategoryRow(category: Category): Observable<void> {
    const id = this._connectedSpreadsheetId();
    if (!id) {
      return throwError(() => ({
        type: 'SHEETS_API',
        status: 0,
        message: 'No connected sheet',
      }) satisfies AppError);
    }

    const range = encodeURIComponent("'Categories'!A:D");
    const url = `${environment.sheetsApiBaseUrl}/${id}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const body = { values: [[category.id, category.name, category.color, category.position]] };

    return this.http.post(url, body).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 400) {
          return this.maybeCreateCategoriesTabAndRetry(id, category, err);
        }
        return throwError(() => ({
          type: 'SHEETS_API',
          status: err.status,
          message: err.status === 403
            ? 'No access to this spreadsheet — check sharing settings.'
            : err.status === 429
              ? 'Sheets quota exceeded — write queued for retry.'
              : `Sheets write error (${err.status}): ${err.message}`,
        }) satisfies AppError);
      }),
      map(() => void 0),
    );
  }

  private maybeCreateCategoriesTabAndRetry(spreadsheetId: string, category: Category, _originalErr: HttpErrorResponse): Observable<void> {
    const createTabUrl = `${environment.sheetsApiBaseUrl}/${spreadsheetId}:batchUpdate`;
    const createBody = {
      requests: [{ addSheet: { properties: { title: 'Categories' } } }],
    };
    return this.http.post(createTabUrl, createBody).pipe(
      catchError((createErr: HttpErrorResponse) =>
        throwError(() => ({
          type: 'SHEETS_API',
          status: createErr.status,
          message: `Sheets write error (${createErr.status}): ${createErr.message}`,
        }) satisfies AppError),
      ),
      switchMap(() => {
        const range = encodeURIComponent("'Categories'!A:D");
        const appendUrl = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
        const body = { values: [[category.id, category.name, category.color, category.position]] };
        return this.http.post(appendUrl, body).pipe(
          catchError((err: HttpErrorResponse) =>
            throwError(() => ({
              type: 'SHEETS_API',
              status: err.status,
              message: `Sheets write error (${err.status}): ${err.message}`,
            }) satisfies AppError),
          ),
        );
      }),
      map(() => void 0),
    );
  }

  async listYearTabs(spreadsheetId: string): Promise<SheetsSheetMeta[]> {
    const meta = await firstValueFrom(this.fetchSpreadsheetMeta(spreadsheetId));
    return (meta?.sheets ?? []).filter((s) => extractYearFromTabName(s.properties.title) !== null);
  }

  readTabDataRows(spreadsheetId: string, tabName: string): Observable<string[][]> {
    const escapedTabName = tabName.replace(/'/g, "''");
    const range = encodeURIComponent(`'${escapedTabName}'!A2:F`);
    const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
    return this.http.get<SheetsValueRange>(url).pipe(
      map((res) => res?.values ?? []),
      catchError((err: HttpErrorResponse) =>
        throwError(() => ({
          type: 'SHEETS_API',
          status: err.status,
          message: err.status === 429
            ? 'Sheets read quota exceeded — hydration deferred for retry.'
            : `Sheets read error (${err.status}): ${err.message}`,
        }) satisfies AppError),
      ),
    );
  }

  mapRowToLocalEntry(tabName: string, rowIndex: number, row: string[]): LocalEntry | null {
    // String() guards against UNFORMATTED_VALUE returning numbers for numeric cells
    const cells = [String(row[0] ?? ''), String(row[1] ?? ''), String(row[2] ?? ''), String(row[3] ?? ''), String(row[4] ?? ''), String(row[5] ?? '')];
    const date = cells[0].trim();
    const category = cells[1].trim();
    const amountRaw = cells[2].trim();
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amountRaw === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (!category) return null;

    const remarks = cells[3];
    const month = cells[4].trim() || date.slice(0, 7);
    const uuid = cells[5].trim();
    const id = uuid !== '' ? uuid : `hydrated-${tabName}-${rowIndex}`;

    return {
      id,
      date,
      month,
      year: Number(date.slice(0, 4)),
      category,
      amount,
      remarks,
      tabName,
      schemaVersion: '2026',
      sheetRowIndex: rowIndex,
      syncStatus: 'synced',
      isReadOnly: false,
    };
  }

  mapNaturalRowToLocalEntry(tabName: string, rowIndex: number, row: string[]): LocalEntry | null {
    const year = extractYearFromTabName(tabName);
    if (year === null) return null;

    // String() guards against UNFORMATTED_VALUE returning numbers for date/numeric cells
    const dateStr = String(row[1] ?? '').trim();
    const category = String(row[2] ?? '').trim();
    const priceStr = String(row[3] ?? '').trim();
    const remarks = String(row[4] ?? '');

    if (!category) return null;

    let day: string, month: string;
    if (dateStr.includes('.')) {
      // "D.M" or "DD.MM" text format
      const parts = dateStr.split('.');
      if (parts.length !== 2) return null;
      const dayNum = Number(parts[0]);
      const monthNum = Number(parts[1]);
      if (!Number.isFinite(dayNum) || !Number.isFinite(monthNum) ||
          parts[0] === '' || parts[1] === '' ||
          dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) return null;
      day = String(dayNum).padStart(2, '0');
      month = String(monthNum).padStart(2, '0');
    } else {
      // Google Sheets date serial (UNFORMATTED_VALUE returns integer for date-typed cells)
      // Serial 25569 = Jan 1, 1970 (Unix epoch) in Excel/Google Sheets
      const serial = Number(dateStr);
      if (!Number.isFinite(serial) || serial <= 0 || dateStr === '') return null;
      const d = new Date((serial - 25569) * 86400000);
      day = String(d.getUTCDate()).padStart(2, '0');
      month = String(d.getUTCMonth() + 1).padStart(2, '0');
    }

    const date = `${year}-${month}-${day}`;
    const monthStr = `${year}-${month}`;

    const amount = Number(priceStr);
    if (!Number.isFinite(amount) || priceStr === '') return null;

    return {
      id: `natural-${tabName}-${rowIndex}`,
      date,
      month: monthStr,
      year,
      category,
      amount,
      remarks,
      tabName,
      schemaVersion: 'natural',
      sheetRowIndex: rowIndex,
      syncStatus: 'synced',
      isReadOnly: year < new Date().getFullYear(),
    };
  }

  private async readTabHeaderRow(spreadsheetId: string, tabName: string): Promise<TabSchemaResult> {
    const escapedTabName = tabName.replace(/'/g, "''");
    const range = encodeURIComponent(`'${escapedTabName}'!A1:F1`);
    const url = `${environment.sheetsApiBaseUrl}/${spreadsheetId}/values/${range}`;
    try {
      const response = await firstValueFrom(this.http.get<SheetsValueRange>(url));
      const headers = (response?.values?.[0] ?? []) as string[];
      return this.detectSchema(tabName, headers);
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      return {
        type: 'error',
        tabName,
        error: {
          type: 'SHEETS_API',
          status: httpErr.status ?? 0,
          message: httpErr.message,
        } satisfies AppError,
      };
    }
  }
}
