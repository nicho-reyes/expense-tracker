import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SyncQueueService } from './sync-queue.service';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { NotificationService } from './notification.service';
import { LocalEntry, SyncQueueItem, QueueState } from '../models/entry.model';

const MOCK_ENTRY: LocalEntry = {
  id: 'entry-uuid-1',
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

const ENQUEUE_INPUT = {
  operation: 'INSERT' as const,
  entryData: MOCK_ENTRY,
  categoryData: null,
  targetEntryId: null,
  targetTabName: null,
};

const MOCK_APPEND_RESPONSE = {
  updates: { updatedRange: "'2026'!A2:F2", updatedRows: 1 },
};

describe('SyncQueueService', () => {
  let service: SyncQueueService;
  let idbSpy: {
    getAll: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let sheetsSpy: {
    connectedSpreadsheetId: ReturnType<typeof vi.fn>;
    getActive2026TabName: ReturnType<typeof vi.fn>;
    appendRow: ReturnType<typeof vi.fn>;
  };
  let notificationSpy: { showError: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    idbSpy = {
      getAll: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    sheetsSpy = {
      connectedSpreadsheetId: vi.fn().mockReturnValue('fake-spreadsheet-id'),
      getActive2026TabName: vi.fn().mockReturnValue('2026'),
      appendRow: vi.fn().mockReturnValue(of(MOCK_APPEND_RESPONSE)),
    };
    notificationSpy = { showError: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        SyncQueueService,
        { provide: IdbService, useValue: idbSpy },
        { provide: SheetsService, useValue: sheetsSpy },
        { provide: NotificationService, useValue: notificationSpy },
      ],
    });
    service = TestBed.inject(SyncQueueService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init()', () => {
    it('loads all items from IDB and sets signals correctly', async () => {
      const pending: SyncQueueItem = {
        ...ENQUEUE_INPUT,
        id: 'q1',
        enqueuedAt: Date.now(),
        status: QueueState.PENDING,
        retryCount: 0,
        lastAttemptAt: null,
        nextRetryAt: null,
        errorMessage: null,
      };
      const errored: SyncQueueItem = {
        ...ENQUEUE_INPUT,
        id: 'q2',
        enqueuedAt: Date.now(),
        status: QueueState.SYNC_ERROR,
        retryCount: 1,
        lastAttemptAt: Date.now(),
        nextRetryAt: null,
        errorMessage: 'Failed',
      };
      idbSpy.getAll.mockResolvedValue([pending, errored]);

      await service.init();

      expect(service.queueItems()).toHaveLength(2);
      expect(service.pendingCount()).toBe(1);
      expect(service.errorCount()).toBe(1);
    });

    it('starts with empty signals when IDB has no items', async () => {
      await service.init();

      expect(service.queueItems()).toHaveLength(0);
      expect(service.pendingCount()).toBe(0);
      expect(service.errorCount()).toBe(0);
    });

    it('shows error notification and does not throw when IDB fails', async () => {
      idbSpy.getAll.mockRejectedValue(new Error('IDB unavailable'));

      await expect(service.init()).resolves.toBeUndefined();
      expect(notificationSpy.showError).toHaveBeenCalledOnce();
      expect(service.queueItems()).toHaveLength(0);
    });
  });

  describe('enqueue()', () => {
    it('persists to IDB, adds item to queueItems, increments pendingCount', async () => {
      await service.enqueue(ENQUEUE_INPUT);
      // Allow fire-and-forget _processItem to settle
      await new Promise(r => setTimeout(r, 0));

      expect(idbSpy.put).toHaveBeenCalledWith('syncQueue', expect.objectContaining({
        operation: 'INSERT',
        status: QueueState.PENDING,
        retryCount: 0,
      }));
      // After successful appendRow, markSynced removes the item
      // pendingCount goes up then back down
    });

    it('adds item with generated UUID and correct fields', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null); // prevent _processItem
      await service.enqueue(ENQUEUE_INPUT);

      const items = service.queueItems();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBeTruthy();
      expect(items[0].status).toBe(QueueState.PENDING);
      expect(items[0].retryCount).toBe(0);
      expect(items[0].enqueuedAt).toBeGreaterThan(0);
    });

    it('does not call appendRow when connectedSpreadsheetId is null (offline)', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.enqueue(ENQUEUE_INPUT);
      await new Promise(r => setTimeout(r, 0));

      expect(sheetsSpy.appendRow).not.toHaveBeenCalled();
      expect(service.queueItems()).toHaveLength(1);
      expect(service.pendingCount()).toBe(1);
    });

    it('calls appendRow with correct row format [date, category, amountStr, remarks, month, uuid]', async () => {
      await service.enqueue(ENQUEUE_INPUT);
      await new Promise(r => setTimeout(r, 0));

      expect(sheetsSpy.appendRow).toHaveBeenCalledWith(
        'fake-spreadsheet-id',
        '2026',
        MOCK_ENTRY,
      );
    });

    it('calls markSynced after appendRow succeeds — queueItems empty, pendingCount 0', async () => {
      await service.enqueue(ENQUEUE_INPUT);
      await new Promise(r => setTimeout(r, 0));

      expect(idbSpy.delete).toHaveBeenCalled();
      expect(service.queueItems()).toHaveLength(0);
      expect(service.pendingCount()).toBe(0);
    });

    it('leaves item PENDING when appendRow rejects with 429', async () => {
      sheetsSpy.appendRow.mockReturnValue(
        throwError(() => ({ type: 'SHEETS_API', status: 429, message: 'Quota exceeded' })),
      );
      await service.enqueue(ENQUEUE_INPUT);
      await new Promise(r => setTimeout(r, 0));

      expect(idbSpy.delete).not.toHaveBeenCalled();
      expect(service.queueItems()).toHaveLength(1);
      expect(service.pendingCount()).toBe(1);
    });

    it('leaves item PENDING when appendRow rejects with 503', async () => {
      sheetsSpy.appendRow.mockReturnValue(
        throwError(() => ({ type: 'SHEETS_API', status: 503, message: 'Service unavailable' })),
      );
      await service.enqueue(ENQUEUE_INPUT);
      await new Promise(r => setTimeout(r, 0));

      expect(idbSpy.delete).not.toHaveBeenCalled();
      expect(service.queueItems()).toHaveLength(1);
      expect(service.pendingCount()).toBe(1);
    });

    it('calls notificationSpy.showError with SCHEMA_VALIDATION when getActive2026TabName returns null', async () => {
      sheetsSpy.getActive2026TabName.mockReturnValue(null);
      await service.enqueue(ENQUEUE_INPUT);
      await new Promise(r => setTimeout(r, 0));

      expect(notificationSpy.showError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SCHEMA_VALIDATION' }),
      );
      expect(sheetsSpy.appendRow).not.toHaveBeenCalled();
      expect(service.pendingCount()).toBe(1);
    });
  });

  describe('markSynced()', () => {
    it('deletes from IDB, removes item from queueItems, decrements pendingCount', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.enqueue(ENQUEUE_INPUT);
      const id = service.queueItems()[0].id;
      expect(service.pendingCount()).toBe(1);

      await service.markSynced(id);

      expect(idbSpy.delete).toHaveBeenCalledWith('syncQueue', id);
      expect(service.queueItems()).toHaveLength(0);
      expect(service.pendingCount()).toBe(0);
    });

    it('does not underflow pendingCount below 0', async () => {
      // markSynced on non-existent item
      await service.markSynced('nonexistent-id');
      expect(service.pendingCount()).toBe(0);
    });
  });

  describe('markError()', () => {
    it('updates item status to SYNC_ERROR and adjusts counts', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.enqueue(ENQUEUE_INPUT);
      const id = service.queueItems()[0].id;

      await service.markError(id, 'Write failed');

      const item = service.queueItems().find(i => i.id === id);
      expect(item?.status).toBe(QueueState.SYNC_ERROR);
      expect(item?.errorMessage).toBe('Write failed');
      expect(item?.retryCount).toBe(1);
      expect(service.errorCount()).toBe(1);
      expect(service.pendingCount()).toBe(0);
    });

    it('persists the updated item to IDB', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.enqueue(ENQUEUE_INPUT);
      const id = service.queueItems()[0].id;

      await service.markError(id, 'err');

      expect(idbSpy.put).toHaveBeenCalledTimes(2); // enqueue + markError
      const lastPutCall = idbSpy.put.mock.calls[1][1];
      expect(lastPutCall.status).toBe(QueueState.SYNC_ERROR);
    });

    it('does nothing when id is not found in queueItems', async () => {
      await service.markError('missing-id', 'err');
      expect(idbSpy.put).not.toHaveBeenCalled();
    });
  });

  describe('retryAll()', () => {
    it('transitions SYNC_ERROR items to PENDING and calls _processItem on each', async () => {
      // Seed via init with a SYNC_ERROR item
      const errorItem: SyncQueueItem = {
        ...ENQUEUE_INPUT,
        id: 'err-item-1',
        enqueuedAt: Date.now(),
        status: QueueState.SYNC_ERROR,
        retryCount: 1,
        lastAttemptAt: Date.now(),
        nextRetryAt: null,
        errorMessage: 'Previous failure',
      };
      idbSpy.getAll.mockResolvedValue([errorItem]);
      await service.init();
      expect(service.errorCount()).toBe(1);

      await service.retryAll();
      await new Promise(r => setTimeout(r, 0));

      expect(sheetsSpy.appendRow).toHaveBeenCalled();
      expect(service.errorCount()).toBe(0);
    });

    it('leaves PENDING items untouched', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.enqueue(ENQUEUE_INPUT);
      expect(service.pendingCount()).toBe(1);

      await service.retryAll(); // no SYNC_ERROR items
      await new Promise(r => setTimeout(r, 0));

      expect(service.pendingCount()).toBe(1);
      expect(sheetsSpy.appendRow).not.toHaveBeenCalled();
    });
  });

  describe('getQueue()', () => {
    it('delegates to IdbService.getAll', async () => {
      const items: SyncQueueItem[] = [];
      idbSpy.getAll.mockResolvedValue(items);

      const result = await service.getQueue();
      expect(result).toBe(items);
      expect(idbSpy.getAll).toHaveBeenCalledWith('syncQueue');
    });
  });
});
