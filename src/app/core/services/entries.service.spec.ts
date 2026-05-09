import { TestBed } from '@angular/core/testing';
import { EntriesService } from './entries.service';
import { IdbService } from './idb.service';
import { NotificationService } from './notification.service';
import { SheetsService } from './sheets.service';
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

    TestBed.configureTestingModule({
      providers: [
        EntriesService,
        { provide: IdbService, useValue: idbSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: SheetsService, useValue: sheetsSpy },
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

    it('is idempotent on missing id — no throw, IdbService.delete not called', async () => {
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
});
