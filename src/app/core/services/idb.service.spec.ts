import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { IdbService } from './idb.service';
import { LocalEntry, SyncQueueItem, QueueState } from '../models/entry.model';

// ── Test fixtures ──────────────────────────────────────────────────────────────

const ENTRY: LocalEntry = {
  id: 'entry-1',
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

const ENTRY_JAN: LocalEntry = {
  ...ENTRY,
  id: 'entry-jan',
  date: '2026-01-15',
  month: '2026-01',
  year: 2026,
};

const QUEUE_PENDING: SyncQueueItem = {
  id: 'queue-1',
  operation: 'INSERT',
  entryData: ENTRY,
  targetEntryId: null,
  targetTabName: null,
  enqueuedAt: 1700000000000,
  status: QueueState.PENDING,
  retryCount: 0,
  lastAttemptAt: null,
  nextRetryAt: null,
  errorMessage: null,
};

const QUEUE_ERROR: SyncQueueItem = {
  ...QUEUE_PENDING,
  id: 'queue-2',
  status: QueueState.SYNC_ERROR,
  retryCount: 3,
  lastAttemptAt: 1700000001000,
  nextRetryAt: 1700000060000,
  errorMessage: 'network timeout',
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('IdbService', () => {
  let service: IdbService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [IdbService] });
    service = TestBed.inject(IdbService);
  });

  afterEach(async () => {
    // Close the DB before deleting it to avoid blocking errors
    const db = await service.getDb();
    db.close();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('expense-dashboard');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    TestBed.resetTestingModule();
  });

  describe('entries store', () => {
    it('getAll("entries") returns inserted entries', async () => {
      await service.put('entries', ENTRY);

      const all = await service.getAll('entries');
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(ENTRY);
    });

    it('put("entries") round-trips — getAll returns the entry', async () => {
      await service.put('entries', ENTRY);
      const all = await service.getAll('entries');
      expect(all[0].id).toBe('entry-1');
    });

    it('delete("entries", id) removes — getAll no longer returns it', async () => {
      await service.put('entries', ENTRY);
      await service.delete('entries', ENTRY.id);

      const all = await service.getAll('entries');
      expect(all).toHaveLength(0);
    });

    it('getAllByIndex("entries", "by-month", "2026-05") returns only May 2026 entries', async () => {
      await service.put('entries', ENTRY);
      await service.put('entries', ENTRY_JAN);

      const may = await service.getAllByIndex('entries', 'by-month', '2026-05');
      expect(may).toHaveLength(1);
      expect(may[0].id).toBe('entry-1');
    });
  });

  describe('syncQueue store', () => {
    it('put("syncQueue", item) round-trips', async () => {
      await service.put('syncQueue', QUEUE_PENDING);

      const all = await service.getAll('syncQueue');
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(QUEUE_PENDING);
    });

    it('getAllByIndex("syncQueue", "by-status", "PENDING") returns only PENDING items', async () => {
      await service.put('syncQueue', QUEUE_PENDING);
      await service.put('syncQueue', QUEUE_ERROR);

      const pending = await service.getAllByIndex('syncQueue', 'by-status', QueueState.PENDING);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('queue-1');
    });

    it('SYNC_ERROR item round-trips retryCount, nextRetryAt, and errorMessage exactly', async () => {
      await service.put('syncQueue', QUEUE_ERROR);

      const all = await service.getAll('syncQueue');
      const item = all.find(i => i.id === 'queue-2')!;
      expect(item.retryCount).toBe(3);
      expect(item.nextRetryAt).toBe(1700000060000);
      expect(item.errorMessage).toBe('network timeout');
    });
  });

  describe('error handling', () => {
    it('wraps IDB errors to AppError.IDB_ERROR on getAll failure', async () => {
      const db = await service.getDb();
      db.close();

      await expect(service.getAll('entries')).rejects.toMatchObject({
        type: 'IDB_ERROR',
      });
    });

    it('wraps IDB errors to AppError.IDB_ERROR on put failure', async () => {
      const db = await service.getDb();
      db.close();

      await expect(service.put('entries', ENTRY)).rejects.toMatchObject({
        type: 'IDB_ERROR',
      });
    });

    it('wraps IDB errors to AppError.IDB_ERROR on delete failure', async () => {
      const db = await service.getDb();
      db.close();

      await expect(service.delete('entries', 'any-id')).rejects.toMatchObject({
        type: 'IDB_ERROR',
      });
    });

    it('wraps IDB errors to AppError.IDB_ERROR on getAllByIndex failure', async () => {
      const db = await service.getDb();
      db.close();

      await expect(service.getAllByIndex('entries', 'by-month', '2026-05')).rejects.toMatchObject({
        type: 'IDB_ERROR',
      });
    });
  });
});
