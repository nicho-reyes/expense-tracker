import { TestBed } from '@angular/core/testing';
import { EntriesService } from './entries.service';
import { IdbService } from './idb.service';
import { NotificationService } from './notification.service';
import { SheetsService } from './sheets.service';
import { SyncQueueService } from './sync-queue.service';
import { LocalEntry, NewEntryInput } from '../models/entry.model';
import { AppError } from '../models/error.model';

const ENTRY_A: LocalEntry = {
  id: 'uuid-a',
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

const ENTRY_SYNCED: LocalEntry = {
  id: 'uuid-synced',
  date: '2026-05-08',
  month: '2026-05',
  year: 2026,
  category: 'Transport',
  amount: 5.0,
  remarks: 'Tram',
  tabName: '2026',
  schemaVersion: '2026',
  sheetRowIndex: 3,
  syncStatus: 'synced',
  isReadOnly: false,
};

const ENTRY_B: LocalEntry = {
  id: 'uuid-b',
  date: '2026-05-10',
  month: '2026-05',
  year: 2026,
  category: 'Transport',
  amount: 3.0,
  remarks: 'Bus',
  tabName: '2026',
  schemaVersion: '2026',
  sheetRowIndex: null,
  syncStatus: 'pending',
  isReadOnly: false,
};

const NEW_INPUT: NewEntryInput = {
  date: '2026-05-09',
  category: 'Food',
  amount: 12.5,
  remarks: 'Lunch',
  tabName: '2026',
  schemaVersion: '2026',
};

describe('EntriesService', () => {
  let service: EntriesService;
  let idbSpy: {
    getAll: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let notificationSpy: { showError: ReturnType<typeof vi.fn> };
  let sheetsSpy: { getActive2026TabName: ReturnType<typeof vi.fn> };
  let syncQueueSpy: {
    enqueue: ReturnType<typeof vi.fn>;
    replaceEntryData: ReturnType<typeof vi.fn>;
    dequeue: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    idbSpy = {
      getAll: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    notificationSpy = {
      showError: vi.fn(),
    };
    sheetsSpy = {
      getActive2026TabName: vi.fn().mockReturnValue('2026'),
    };
    syncQueueSpy = {
      enqueue: vi.fn().mockResolvedValue(undefined),
      replaceEntryData: vi.fn().mockResolvedValue(true),
      dequeue: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        EntriesService,
        { provide: IdbService, useValue: idbSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: SheetsService, useValue: sheetsSpy },
        { provide: SyncQueueService, useValue: syncQueueSpy },
      ],
    });
    service = TestBed.inject(EntriesService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── init() ───────────────────────────────────────────────────────────────

  describe('init()', () => {
    it('populates signal from IdbService.getAll("entries")', async () => {
      idbSpy.getAll.mockResolvedValue([ENTRY_A, ENTRY_B]);

      await service.init();

      expect(service.entries()).toEqual([ENTRY_A, ENTRY_B]);
      expect(idbSpy.getAll).toHaveBeenCalledWith('entries');
    });

    it('is a no-op on second call (single-flight)', async () => {
      idbSpy.getAll.mockResolvedValue([ENTRY_A]);

      await service.init();
      await service.init();

      expect(idbSpy.getAll).toHaveBeenCalledTimes(1);
    });

    it('surfaces IDB_ERROR via notification on getAll rejection and does not throw', async () => {
      idbSpy.getAll.mockRejectedValue({ type: 'IDB_ERROR', message: 'disk full' } satisfies AppError);

      await expect(service.init()).resolves.toBeUndefined();

      expect(notificationSpy.showError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'IDB_ERROR' }),
      );
      expect(service.entries()).toEqual([]);
    });
  });

  // ── add() ────────────────────────────────────────────────────────────────

  describe('add()', () => {
    it('appends entry to signal before IdbService.put resolves (optimistic)', async () => {
      let resolveIdb!: () => void;
      idbSpy.put.mockReturnValue(
        new Promise<void>(res => {
          resolveIdb = res;
        }),
      );

      const addPromise = service.add(NEW_INPUT);

      // Signal is updated optimistically before IDB resolves
      expect(service.entries()).toHaveLength(1);
      expect(service.entries()[0].category).toBe('Food');

      resolveIdb();
      await addPromise;

      expect(service.entries()).toHaveLength(1);
    });

    it('returns the persisted entry', async () => {
      const result = await service.add(NEW_INPUT);

      expect(result.category).toBe('Food');
      expect(result.amount).toBe(12.5);
      expect(result.syncStatus).toBe('pending');
      expect(result.sheetRowIndex).toBeNull();
      expect(result.isReadOnly).toBe(false);
    });

    it('derives month and year from date', async () => {
      const result = await service.add({ ...NEW_INPUT, date: '2026-05-09' });

      expect(result.month).toBe('2026-05');
      expect(result.year).toBe(2026);
    });

    it('calls crypto.randomUUID() exactly once per add()', async () => {
      const uuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('test-uuid-1' as `${string}-${string}-${string}-${string}-${string}`);

      await service.add(NEW_INPUT);

      expect(uuidSpy).toHaveBeenCalledTimes(1);
    });

    it('rolls back signal and notifies on IDB rejection', async () => {
      const idbError: AppError = { type: 'IDB_ERROR', message: 'write failed' };
      idbSpy.put.mockRejectedValue(idbError);

      await expect(service.add(NEW_INPUT)).rejects.toMatchObject({ type: 'IDB_ERROR' });

      expect(service.entries()).toHaveLength(0);
      expect(notificationSpy.showError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'IDB_ERROR' }),
      );
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────

  describe('update()', () => {
    beforeEach(async () => {
      idbSpy.getAll.mockResolvedValue([ENTRY_A, ENTRY_B]);
      await service.init();
    });

    it('replaces the matching entry by id, preserves all other entries', async () => {
      const updated = await service.update(ENTRY_A.id, { amount: 99.9 });

      expect(updated.amount).toBe(99.9);
      expect(updated.id).toBe(ENTRY_A.id);
      expect(service.entries()).toHaveLength(2);
      expect(service.entries()[0].amount).toBe(99.9);
      expect(service.entries()[1]).toEqual(ENTRY_B);
    });

    it('recomputes month and year when date is in patch', async () => {
      const updated = await service.update(ENTRY_A.id, { date: '2025-12-31' });

      expect(updated.month).toBe('2025-12');
      expect(updated.year).toBe(2025);
    });

    it('restores the prior entry exactly on IDB rejection', async () => {
      const idbError: AppError = { type: 'IDB_ERROR', message: 'write failed' };
      idbSpy.put.mockRejectedValue(idbError);

      await expect(service.update(ENTRY_A.id, { amount: 999 })).rejects.toMatchObject({ type: 'IDB_ERROR' });

      expect(service.entries()[0]).toEqual(ENTRY_A);
      expect(notificationSpy.showError).toHaveBeenCalled();
    });

    it('throws IDB_ERROR when id not found and calls showError', async () => {
      await expect(service.update('nonexistent', { amount: 1 })).rejects.toMatchObject({
        type: 'IDB_ERROR',
        message: expect.stringContaining('nonexistent'),
      });

      expect(notificationSpy.showError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'IDB_ERROR' }),
      );
    });

    it('calls syncQueue.replaceEntryData when entry syncStatus is "pending"', async () => {
      await service.update(ENTRY_A.id, { amount: 20 }); // ENTRY_A is pending

      expect(syncQueueSpy.replaceEntryData).toHaveBeenCalledWith(
        ENTRY_A.id,
        expect.objectContaining({ id: ENTRY_A.id, amount: 20 }),
      );
      expect(syncQueueSpy.enqueue).not.toHaveBeenCalled();
    });

    it('calls syncQueue.enqueue UPDATE when entry syncStatus is "synced"', async () => {
      idbSpy.getAll.mockResolvedValue([ENTRY_SYNCED]);
      service = TestBed.inject(EntriesService);
      // Reinitialize with synced entry
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          EntriesService,
          { provide: IdbService, useValue: { ...idbSpy, getAll: vi.fn().mockResolvedValue([ENTRY_SYNCED]) } },
          { provide: NotificationService, useValue: notificationSpy },
          { provide: SheetsService, useValue: sheetsSpy },
          { provide: SyncQueueService, useValue: syncQueueSpy },
        ],
      });
      const svc = TestBed.inject(EntriesService);
      await svc.init();

      await svc.update(ENTRY_SYNCED.id, { amount: 10 });

      expect(syncQueueSpy.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'UPDATE',
          targetEntryId: ENTRY_SYNCED.id,
          targetTabName: ENTRY_SYNCED.tabName,
        }),
      );
      expect(syncQueueSpy.replaceEntryData).not.toHaveBeenCalled();
    });
  });

  // ── delete() ─────────────────────────────────────────────────────────────

  describe('delete()', () => {
    beforeEach(async () => {
      idbSpy.getAll.mockResolvedValue([ENTRY_A, ENTRY_B]);
      await service.init();
    });

    it('removes entry by id; signal length decremented', async () => {
      await service.delete(ENTRY_A.id);

      expect(service.entries()).toHaveLength(1);
      expect(service.entries().find(e => e.id === ENTRY_A.id)).toBeUndefined();
    });

    it('returns the snapshot of the deleted entry', async () => {
      const snapshot = await service.delete(ENTRY_A.id);

      expect(snapshot).toEqual(ENTRY_A);
    });

    it('is idempotent on missing id — returns undefined, IdbService.delete not called', async () => {
      await expect(service.delete('nonexistent')).resolves.toBeUndefined();

      expect(idbSpy.delete).not.toHaveBeenCalled();
    });

    it('restores entry at original index on IDB rejection', async () => {
      const idbError: AppError = { type: 'IDB_ERROR', message: 'write failed' };
      idbSpy.delete.mockRejectedValue(idbError);

      await expect(service.delete(ENTRY_A.id)).rejects.toMatchObject({ type: 'IDB_ERROR' });

      expect(service.entries()).toHaveLength(2);
      expect(service.entries()[0]).toEqual(ENTRY_A);
      expect(service.entries()[1]).toEqual(ENTRY_B);
      expect(notificationSpy.showError).toHaveBeenCalled();
    });

    it('does NOT enqueue anything on delete (caller decides via finalizeDelete)', async () => {
      await service.delete(ENTRY_A.id);

      expect(syncQueueSpy.enqueue).not.toHaveBeenCalled();
      expect(syncQueueSpy.dequeue).not.toHaveBeenCalled();
    });
  });

  // ── getById() ────────────────────────────────────────────────────────────

  describe('getById()', () => {
    beforeEach(async () => {
      idbSpy.getAll.mockResolvedValue([ENTRY_A]);
      await service.init();
    });

    it('returns the matching signal entry without calling IdbService', () => {
      const result = service.getById(ENTRY_A.id);

      expect(result).toEqual(ENTRY_A);
      expect(idbSpy.getAll).toHaveBeenCalledTimes(1); // only from init
    });

    it('returns undefined for unknown id', () => {
      expect(service.getById('nope')).toBeUndefined();
    });
  });

  // ── restore() ────────────────────────────────────────────────────────────

  describe('restore()', () => {
    beforeEach(async () => {
      idbSpy.getAll.mockResolvedValue([ENTRY_B]);
      await service.init();
    });

    it('re-inserts snapshot into IDB and signal, sorted by date descending', async () => {
      // ENTRY_A date 2026-05-09 < ENTRY_B date 2026-05-10 → ENTRY_B first
      await service.restore(ENTRY_A);

      expect(idbSpy.put).toHaveBeenCalledWith('entries', ENTRY_A);
      expect(service.entries()).toHaveLength(2);
      expect(service.entries()[0].id).toBe(ENTRY_B.id); // 2026-05-10 comes first
      expect(service.entries()[1].id).toBe(ENTRY_A.id);
    });

    it('rolls back and throws on IDB rejection', async () => {
      const idbError: AppError = { type: 'IDB_ERROR', message: 'write failed' };
      idbSpy.put.mockRejectedValue(idbError);

      await expect(service.restore(ENTRY_A)).rejects.toMatchObject({ type: 'IDB_ERROR' });
    });
  });

  // ── finalizeDelete() ─────────────────────────────────────────────────────

  describe('finalizeDelete()', () => {
    it('enqueues DELETE when syncStatus is "synced"', async () => {
      await service.finalizeDelete(ENTRY_SYNCED);

      expect(syncQueueSpy.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'DELETE',
          entryData: null,
          targetEntryId: ENTRY_SYNCED.id,
          targetTabName: ENTRY_SYNCED.tabName,
        }),
      );
      expect(syncQueueSpy.dequeue).not.toHaveBeenCalled();
    });

    it('calls dequeue when syncStatus is "pending" (never reached Sheets)', async () => {
      await service.finalizeDelete(ENTRY_A); // ENTRY_A is pending

      expect(syncQueueSpy.dequeue).toHaveBeenCalledWith(ENTRY_A.id);
      expect(syncQueueSpy.enqueue).not.toHaveBeenCalled();
    });

    it('calls dequeue when syncStatus is "error"', async () => {
      const errorEntry: LocalEntry = { ...ENTRY_A, syncStatus: 'error' };

      await service.finalizeDelete(errorEntry);

      expect(syncQueueSpy.dequeue).toHaveBeenCalledWith(errorEntry.id);
      expect(syncQueueSpy.enqueue).not.toHaveBeenCalled();
    });
  });

  // ── refreshFromIdb() ─────────────────────────────────────────────────────

  describe('refreshFromIdb()', () => {
    it('replaces _entries signal with all rows from IDB in stable order', async () => {
      const hydrated: LocalEntry = {
        ...ENTRY_A,
        id: 'hydrated-2026-2',
        date: '2026-01-01',
        month: '2026-01',
        syncStatus: 'synced',
      };
      idbSpy.getAll.mockResolvedValue([ENTRY_A, hydrated]);

      await service.refreshFromIdb();

      expect(service.entries()).toEqual([ENTRY_A, hydrated]);
    });

    it('can be called multiple times without the single-flight guard blocking it', async () => {
      idbSpy.getAll.mockResolvedValue([ENTRY_A]);
      await service.refreshFromIdb();
      idbSpy.getAll.mockResolvedValue([ENTRY_A, ENTRY_B]);
      await service.refreshFromIdb();

      expect(idbSpy.getAll).toHaveBeenCalledTimes(2);
      expect(service.entries()).toEqual([ENTRY_A, ENTRY_B]);
    });

    it('surfaces IDB_ERROR via notification and rethrows on getAll rejection', async () => {
      idbSpy.getAll.mockRejectedValue({ type: 'IDB_ERROR', message: 'disk full' } satisfies AppError);

      await expect(service.refreshFromIdb()).rejects.toMatchObject({ type: 'IDB_ERROR' });
      expect(notificationSpy.showError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'IDB_ERROR' }),
      );
    });
  });
});
