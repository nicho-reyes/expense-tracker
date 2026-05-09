import { Injectable, inject, signal } from '@angular/core';
import { IdbService } from './idb.service';
import { NotificationService } from './notification.service';
import { SheetsService } from './sheets.service';
import { LocalEntry, NewEntryInput } from '../models/entry.model';
import { AppError } from '../models/error.model';

@Injectable({ providedIn: 'root' })
export class EntriesService {
  private readonly idb = inject(IdbService);
  private readonly notification = inject(NotificationService);
  private readonly sheets = inject(SheetsService);

  private readonly _entries = signal<LocalEntry[]>([]);
  readonly entries = this._entries.asReadonly();

  readonly selectedMonth = signal<string>('');
  readonly syncStatus = signal<'idle' | 'syncing' | 'error'>('idle');

  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        const all = await this.idb.getAll('entries');
        this._entries.set(all);
      } catch (err) {
        const appErr = this.toIdbError(err);
        this.notification.showError(appErr);
        // Do not rethrow — boot must continue with empty list
      }
    })();
    return this.initPromise;
  }

  async add(input: NewEntryInput): Promise<LocalEntry> {
    const tabName = input.tabName ?? this.sheets.getActive2026TabName() ?? '';
    const schemaVersion: '2025' | '2026' = input.schemaVersion ?? '2026';
    const entry: LocalEntry = {
      id: crypto.randomUUID(),
      date: input.date,
      month: input.date.slice(0, 7),
      year: Number(input.date.slice(0, 4)),
      category: input.category,
      amount: input.amount,
      remarks: input.remarks,
      tabName,
      schemaVersion,
      sheetRowIndex: null,
      syncStatus: 'pending',
      isReadOnly: false,
    };

    const prev = this._entries();
    this._entries.set([...prev, entry]);
    try {
      await this.idb.put('entries', entry);
      return entry;
    } catch (err) {
      this._entries.set(prev);
      const appErr = this.toIdbError(err);
      this.notification.showError(appErr);
      throw appErr;
    }
  }

  async update(id: string, patch: Partial<Omit<LocalEntry, 'id'>>): Promise<LocalEntry> {
    const prev = this._entries();
    const idx = prev.findIndex(e => e.id === id);
    if (idx < 0) {
      const appErr: AppError = { type: 'IDB_ERROR', message: `Entry ${id} not found` };
      this.notification.showError(appErr);
      throw appErr;
    }
    const updated: LocalEntry = { ...prev[idx], ...patch, id };
    if (patch.date !== undefined) {
      updated.month = patch.date.slice(0, 7);
      updated.year = Number(patch.date.slice(0, 4));
    }
    const next = [...prev];
    next[idx] = updated;
    this._entries.set(next);
    try {
      await this.idb.put('entries', updated);
      return updated;
    } catch (err) {
      this._entries.set(prev);
      const appErr = this.toIdbError(err);
      this.notification.showError(appErr);
      throw appErr;
    }
  }

  async delete(id: string): Promise<void> {
    const prev = this._entries();
    const idx = prev.findIndex(e => e.id === id);
    if (idx < 0) return;
    const next = prev.filter(e => e.id !== id);
    this._entries.set(next);
    try {
      await this.idb.delete('entries', id);
    } catch (err) {
      this._entries.set(prev);
      const appErr = this.toIdbError(err);
      this.notification.showError(appErr);
      throw appErr;
    }
  }

  getById(id: string): LocalEntry | undefined {
    return this._entries().find(e => e.id === id);
  }

  private toIdbError(err: unknown): AppError {
    if (this.isAppError(err)) return err;
    return { type: 'IDB_ERROR', message: err instanceof Error ? err.message : String(err) };
  }

  private isAppError(value: unknown): value is AppError {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      typeof (value as Record<string, unknown>)['type'] === 'string' &&
      'message' in value
    );
  }
}
