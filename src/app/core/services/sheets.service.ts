import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { IdbService } from './idb.service';
import { environment } from '../../../environments/environment';
import { AppError } from '../models/error.model';
import { LocalEntry } from '../models/entry.model';
import {
  SheetsSpreadsheet,
  SheetsSheetMeta,
  SheetsValueRange,
  SheetsAppendResponse,
  TabSchemaResult,
  schema2026Validator,
  schema2025Validator,
  schema2026PartialValidator,
  SCHEMA_2026_HEADERS,
} from '../models/sheets.model';

@Injectable({ providedIn: 'root' })
export class SheetsService {
  private readonly http = inject(HttpClient);
  private readonly idb = inject(IdbService);

  private readonly _connectedSpreadsheetId = signal<string | null>(null);
  private readonly _schemaCache = signal<Record<string, '2026' | '2025'>>({});
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
      const cache = await this.idb.get<Record<string, '2026' | '2025'>>('appMeta', 'schemaCache');
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
    schemaCache: Record<string, '2026' | '2025'>,
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

  readActiveTabCategoryColumn(spreadsheetId: string, tabName: string): Observable<string[]> {
    const escaped = tabName.replace(/'/g, "''");
    const range = encodeURIComponent(`'${escaped}'!B2:B`);
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
