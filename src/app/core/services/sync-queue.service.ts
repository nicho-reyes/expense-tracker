import { Injectable, signal, Signal } from '@angular/core';
import { SyncQueueItem } from '../models/entry.model';

export interface ISyncQueueService {
  readonly pendingCount: Signal<number>;
  readonly errorCount: Signal<number>;
  readonly queueItems: Signal<SyncQueueItem[]>;

  enqueue(item: Omit<SyncQueueItem, 'id' | 'enqueuedAt' | 'status' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'errorMessage'>): Promise<void>;
  dequeue(id: string): Promise<void>;
  markError(id: string, message: string): Promise<void>;
  markSynced(id: string): Promise<void>;
  retryAll(): Promise<void>;
  getQueue(): Promise<SyncQueueItem[]>;
}

@Injectable({ providedIn: 'root' })
export class SyncQueueService implements ISyncQueueService {
  readonly pendingCount: Signal<number> = signal(0);
  readonly errorCount: Signal<number> = signal(0);
  readonly queueItems: Signal<SyncQueueItem[]> = signal([]);

  enqueue(_item: Omit<SyncQueueItem, 'id' | 'enqueuedAt' | 'status' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'errorMessage'>): Promise<void> {
    throw new Error('Not implemented');
  }

  dequeue(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  markError(_id: string, _message: string): Promise<void> {
    throw new Error('Not implemented');
  }

  markSynced(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  retryAll(): Promise<void> {
    throw new Error('Not implemented');
  }

  getQueue(): Promise<SyncQueueItem[]> {
    throw new Error('Not implemented');
  }
}
