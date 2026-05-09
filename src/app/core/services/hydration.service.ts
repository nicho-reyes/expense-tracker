import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { EntriesService } from './entries.service';
import { NotificationService } from './notification.service';
import { HydratedTabRecord, HydrationProgress, HydrationTabResult } from '../models/sheets.model';
import { AppError } from '../models/error.model';

@Injectable({ providedIn: 'root' })
export class HydrationService {
  private readonly idb = inject(IdbService);
  private readonly sheets = inject(SheetsService);
  private readonly entries = inject(EntriesService);
  private readonly notification = inject(NotificationService);

  private readonly _progress = signal<HydrationProgress>({ type: 'idle' });
  private readonly _lastRunSummary = signal<HydrationTabResult[] | null>(null);
  private _hydrating = false;

  readonly progress = this._progress.asReadonly();
  readonly lastRunSummary = this._lastRunSummary.asReadonly();

  async init(): Promise<void> {
    try {
      await this.hydrate({ force: false });
    } catch (err) {
      this.notification.showError(this.toError(err));
      // Never rethrow — boot must continue
    }
  }

  async hydrate(opts: { force?: boolean } = {}): Promise<HydrationTabResult[]> {
    if (this._hydrating) return [];
    this._hydrating = true;
    try {
      return await this._runHydration(opts);
    } finally {
      this._hydrating = false;
    }
  }

  private async _runHydration(opts: { force?: boolean }): Promise<HydrationTabResult[]> {
    await this.sheets.ensureLoaded();
    const spreadsheetId = this.sheets.connectedSpreadsheetId();
    console.debug('[Hydration] spreadsheetId:', spreadsheetId);
    if (!spreadsheetId) {
      this._progress.set({ type: 'idle' });
      return [];
    }

    const hydratedAt = (await this.idb.get<Record<string, HydratedTabRecord>>('appMeta', 'hydratedAt')) ?? {};
    const schemaCache = this.sheets.schemaCache();
    console.debug('[Hydration] schemaCache:', schemaCache);
    console.debug('[Hydration] hydratedAt:', hydratedAt);

    const results: HydrationTabResult[] = [];
    const tabsToProcess = Object.entries(schemaCache)
      .filter(([name, schema]) => {
        if (schema !== '2026') {
          results.push({ type: 'skipped', tabName: name, reason: 'non-2026-schema' });
          return false;
        }
        if (!opts.force && hydratedAt[name]) {
          results.push({ type: 'skipped', tabName: name, reason: 'already-hydrated' });
          return false;
        }
        return true;
      })
      .map(([name]) => name);
    console.debug('[Hydration] tabsToProcess:', tabsToProcess, '| skipped:', results);

    for (let i = 0; i < tabsToProcess.length; i++) {
      const tabName = tabsToProcess[i];
      this._progress.set({ type: 'running', tabName, tabIndex: i + 1, tabTotal: tabsToProcess.length });

      try {
        const rows = await firstValueFrom(this.sheets.readTabDataRows(spreadsheetId, tabName));
        console.debug(`[Hydration] tab "${tabName}": ${rows.length} rows fetched`, rows.slice(0, 3));
        let validCount = 0;
        let invalidCount = 0;
        for (let r = 0; r < rows.length; r++) {
          const sheetRowIndex = r + 2; // header is row 1; A2:F starts at row 2
          const entry = this.sheets.mapRowToLocalEntry(tabName, sheetRowIndex, rows[r]);
          if (entry === null) {
            invalidCount++;
            continue;
          }
          await this.idb.put('entries', entry);
          validCount++;
        }
        console.debug(`[Hydration] tab "${tabName}": valid=${validCount} invalid=${invalidCount}`);

        if (invalidCount > 0) {
          const validationErr: AppError = {
            type: 'SCHEMA_VALIDATION',
            message: `${invalidCount} rows in tab "${tabName}" had unrecognized data and were skipped.`,
            details: undefined as never,
          };
          this.notification.showError(validationErr);
          results.push({ type: 'invalid', tabName, error: validationErr });
        }

        const updatedMap = { ...hydratedAt, [tabName]: { lastHydratedAt: Date.now(), rowCount: validCount } };
        await this.idb.set('appMeta', 'hydratedAt', updatedMap);
        hydratedAt[tabName] = updatedMap[tabName];

        results.push({ type: 'hydrated', tabName, rowCount: validCount });
        await this.entries.refreshFromIdb();
      } catch (err) {
        const appErr = this.toError(err);
        console.debug('[Hydration] tab error:', appErr);
        results.push({ type: 'deferred', tabName, error: appErr });
        this.notification.showError(appErr);
        // Do NOT update appMeta.hydratedAt — retry on next boot
      }
    }

    const hydrated = results.filter((r) => r.type === 'hydrated').length;
    const skipped = results.filter((r) => r.type === 'skipped').length;
    const deferred = results.filter((r) => r.type === 'deferred').length;
    this._progress.set({ type: 'complete', hydratedTabs: hydrated, skippedTabs: skipped, deferredTabs: deferred });
    this._lastRunSummary.set(results);
    return results;
  }

  private toError(err: unknown): AppError {
    if (err && typeof err === 'object' && 'type' in err) return err as AppError;
    return { type: 'UNKNOWN_ERROR', message: err instanceof Error ? err.message : String(err) };
  }
}
