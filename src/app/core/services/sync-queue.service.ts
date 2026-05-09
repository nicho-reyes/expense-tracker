import { Injectable, inject, signal, Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { NotificationService } from './notification.service';
import { SyncQueueItem, QueueState } from '../models/entry.model';
import { AppError } from '../models/error.model';

export interface ISyncQueueService {
  readonly pendingCount: Signal<number>;
  readonly errorCount: Signal<number>;
  readonly queueItems: Signal<SyncQueueItem[]>;

  init(): Promise<void>;
  enqueue(item: Omit<SyncQueueItem, 'id' | 'enqueuedAt' | 'status' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'errorMessage'>): Promise<void>;
  dequeue(id: string): Promise<void>;
  markError(id: string, message: string): Promise<void>;
  markSynced(id: string): Promise<void>;
  retryAll(): Promise<void>;
  getQueue(): Promise<SyncQueueItem[]>;
}

@Injectable({ providedIn: 'root' })
export class SyncQueueService implements ISyncQueueService {
  private readonly idb = inject(IdbService);
  private readonly sheets = inject(SheetsService);
  private readonly notification = inject(NotificationService);

  readonly queueItems = signal<SyncQueueItem[]>([]);
  readonly pendingCount = signal<number>(0);
  readonly errorCount = signal<number>(0);

  async init(): Promise<void> {
    try {
      const items = await this.idb.getAll('syncQueue');
      this.queueItems.set(items);
      this.pendingCount.set(items.filter(i => i.status === QueueState.PENDING).length);
      this.errorCount.set(items.filter(i => i.status === QueueState.SYNC_ERROR).length);
    } catch (err) {
      this.notification.showError(this.toAppError(err));
      // Do not rethrow — shell must boot with empty queue
    }
  }

  async enqueue(item: Omit<SyncQueueItem, 'id' | 'enqueuedAt' | 'status' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'errorMessage'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      enqueuedAt: Date.now(),
      status: QueueState.PENDING,
      retryCount: 0,
      lastAttemptAt: null,
      nextRetryAt: null,
      errorMessage: null,
    };
    try {
      await this.idb.put('syncQueue', queueItem);
    } catch (err) {
      this.notification.showError(this.toAppError(err));
      throw this.toAppError(err);
    }
    this.queueItems.update(all => [...all, queueItem]);
    this.pendingCount.update(n => n + 1);
    // Fire-and-forget — process immediately on happy path
    this._processItem(queueItem).catch(() => {});
  }

  async markSynced(id: string): Promise<void> {
    try {
      await this.idb.delete('syncQueue', id);
    } catch (err) {
      this.notification.showError(this.toAppError(err));
      throw this.toAppError(err);
    }
    this.queueItems.update(all => all.filter(i => i.id !== id));
    this.pendingCount.update(n => Math.max(0, n - 1));
  }

  async dequeue(id: string): Promise<void> {
    return this.markSynced(id);
  }

  async markError(id: string, message: string): Promise<void> {
    const item = this.queueItems().find(i => i.id === id);
    if (!item) return;
    const updated: SyncQueueItem = {
      ...item,
      status: QueueState.SYNC_ERROR,
      errorMessage: message,
      lastAttemptAt: Date.now(),
      retryCount: item.retryCount + 1,
    };
    try {
      await this.idb.put('syncQueue', updated);
    } catch (err) {
      this.notification.showError(this.toAppError(err));
      throw this.toAppError(err);
    }
    this.queueItems.update(all => all.map(i => i.id === id ? updated : i));
    if (item.status === QueueState.PENDING) {
      this.pendingCount.update(n => Math.max(0, n - 1));
    }
    this.errorCount.update(n => n + 1);
  }

  async retryAll(): Promise<void> {
    const errors = this.queueItems().filter(i => i.status === QueueState.SYNC_ERROR);
    for (const item of errors) {
      const retried: SyncQueueItem = { ...item, status: QueueState.PENDING };
      try {
        await this.idb.put('syncQueue', retried);
      } catch (err) {
        this.notification.showError(this.toAppError(err));
        continue;
      }
      this.queueItems.update(all => all.map(i => i.id === item.id ? retried : i));
      this.errorCount.update(n => Math.max(0, n - 1));
      this.pendingCount.update(n => n + 1);
      this._processItem(retried).catch(() => {});
    }
  }

  async getQueue(): Promise<SyncQueueItem[]> {
    return this.idb.getAll('syncQueue');
  }

  private async _processItem(item: SyncQueueItem): Promise<void> {
    const spreadsheetId = this.sheets.connectedSpreadsheetId();
    if (!spreadsheetId) return; // offline or unconnected — item stays PENDING

    if (item.operation !== 'INSERT') return; // UPDATE/DELETE: Story 2.4

    const tabName = this.sheets.getActive2026TabName();
    if (!tabName) {
      this.notification.showError({
        type: 'SCHEMA_VALIDATION',
        message: 'No 2026-schema tab found — INSERT blocked',
        details: undefined as never,
      } satisfies AppError);
      return; // item stays PENDING
    }

    if (!item.entryData) return; // defensive — INSERT always has entryData

    try {
      await firstValueFrom(this.sheets.appendRow(spreadsheetId, tabName, item.entryData));
      await this.markSynced(item.id);
    } catch {
      // Leave PENDING — retry handled by Epic 3 (Story 3.1)
    }
  }

  private toAppError(err: unknown): AppError {
    if (typeof err === 'object' && err !== null && 'type' in err) return err as AppError;
    return { type: 'IDB_ERROR', message: err instanceof Error ? err.message : String(err) };
  }
}
