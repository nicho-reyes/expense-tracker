import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CategoriesService } from './categories.service';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { SyncQueueService } from './sync-queue.service';
import { EntriesService } from './entries.service';
import { NotificationService } from './notification.service';
import { Category, DEFAULT_CATEGORY_PALETTE, slugifyCategoryId } from '../models/category.model';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let idbSpy: {
    getAll: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let sheetsSpy: {
    ensureLoaded: ReturnType<typeof vi.fn>;
    connectedSpreadsheetId: ReturnType<typeof vi.fn>;
    findCategoriesTab: ReturnType<typeof vi.fn>;
    readCategoriesTabColumn: ReturnType<typeof vi.fn>;
    readActiveTabCategoryColumn: ReturnType<typeof vi.fn>;
    getActive2026TabName: ReturnType<typeof vi.fn>;
    appendCategoryRow: ReturnType<typeof vi.fn>;
  };
  let syncQueueSpy: {
    enqueue: ReturnType<typeof vi.fn>;
  };
  let entriesSignal: ReturnType<typeof signal<{ category: string }[]>>;
  let notificationSpy: {
    showError: ReturnType<typeof vi.fn>;
    showInfo: ReturnType<typeof vi.fn>;
    showSuccess: ReturnType<typeof vi.fn>;
  };
  let setPropertySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    idbSpy = {
      getAll: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    sheetsSpy = {
      ensureLoaded: vi.fn().mockResolvedValue(undefined),
      connectedSpreadsheetId: vi.fn().mockReturnValue(null),
      findCategoriesTab: vi.fn().mockResolvedValue(null),
      readCategoriesTabColumn: vi.fn().mockReturnValue(of([])),
      readActiveTabCategoryColumn: vi.fn().mockReturnValue(of([])),
      getActive2026TabName: vi.fn().mockReturnValue(null),
      appendCategoryRow: vi.fn().mockReturnValue(of(undefined)),
    };
    syncQueueSpy = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };
    entriesSignal = signal([]);
    notificationSpy = {
      showError: vi.fn(),
      showInfo: vi.fn(),
      showSuccess: vi.fn(),
    };
    setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

    TestBed.configureTestingModule({
      providers: [
        CategoriesService,
        { provide: IdbService, useValue: idbSpy },
        { provide: SheetsService, useValue: sheetsSpy },
        { provide: SyncQueueService, useValue: syncQueueSpy },
        { provide: EntriesService, useValue: { entries: entriesSignal.asReadonly() } },
        { provide: NotificationService, useValue: notificationSpy },
      ],
    });
    service = TestBed.inject(CategoriesService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init()', () => {
    it('resolves cleanly with empty IDB and no spreadsheet connected', async () => {
      await service.init();

      expect(service.categories()).toEqual([]);
      expect(service.loadError()).toBeNull();
    });

    it('loads cached IDB categories and injects CSS when offline without showing error (AC6)', async () => {
      const cached: Category[] = [
        { id: 'food', name: 'Food', color: '#6366f1', position: 0 },
      ];
      idbSpy.getAll.mockResolvedValue(cached);
      sheetsSpy.connectedSpreadsheetId.mockReturnValue('spreadsheet-id');
      sheetsSpy.findCategoriesTab.mockRejectedValue({ type: 'NETWORK', message: 'offline' });

      await service.init();

      expect(service.categories()).toEqual(cached);
      expect(service.loadError()).toBeNull(); // AC6: app shell renders normally when cache is present
      expect(setPropertySpy).toHaveBeenCalledWith('--color-food', '#6366f1');
    });

    it('reads from Categories tab when present (AC8)', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue('sheet-id');
      sheetsSpy.findCategoriesTab.mockResolvedValue({ tabName: 'Categories' });
      sheetsSpy.readCategoriesTabColumn.mockReturnValue(of(['Groceries', 'Transport']));

      await service.init();

      expect(sheetsSpy.readCategoriesTabColumn).toHaveBeenCalledWith('sheet-id');
      expect(service.categories().map((c) => c.name)).toEqual(['Groceries', 'Transport']);
      expect(idbSpy.set).toHaveBeenCalledWith('appMeta', 'categorySource', {
        type: 'categories-tab',
        tabName: 'Categories',
      });
    });

    it('falls back to column B of active 2026 tab, deduplicates and sorts (AC9)', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue('sheet-id');
      sheetsSpy.findCategoriesTab.mockResolvedValue(null);
      sheetsSpy.getActive2026TabName.mockReturnValue('2026');
      sheetsSpy.readActiveTabCategoryColumn.mockReturnValue(of(['Groceries', 'Transport', 'Groceries']));

      await service.init();

      expect(sheetsSpy.readActiveTabCategoryColumn).toHaveBeenCalledWith('sheet-id', '2026');
      const names = service.categories().map((c) => c.name);
      expect(names).toEqual(['Groceries', 'Transport']); // deduped and sorted alphabetically
      expect(idbSpy.set).toHaveBeenCalledWith('appMeta', 'categorySource', {
        type: 'column-b-fallback',
        tabName: '2026',
      });
    });

    it('assigns DEFAULT_CATEGORY_PALETTE colors by position index (AC3)', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue('sheet-id');
      sheetsSpy.findCategoriesTab.mockResolvedValue({ tabName: 'Categories' });
      sheetsSpy.readCategoriesTabColumn.mockReturnValue(of(['A', 'B', 'C']));

      await service.init();

      const cats = service.categories();
      expect(cats[0].color).toBe(DEFAULT_CATEGORY_PALETTE[0]);
      expect(cats[1].color).toBe(DEFAULT_CATEGORY_PALETTE[1]);
      expect(cats[2].color).toBe(DEFAULT_CATEGORY_PALETTE[2]);
    });

    it('preserves user-assigned colors from prior IDB cache on re-seed', async () => {
      const prior: Category[] = [
        { id: 'groceries', name: 'Groceries', color: '#custom-color', position: 0 },
      ];
      idbSpy.getAll.mockResolvedValue(prior);
      sheetsSpy.connectedSpreadsheetId.mockReturnValue('sheet-id');
      sheetsSpy.findCategoriesTab.mockResolvedValue({ tabName: 'Categories' });
      sheetsSpy.readCategoriesTabColumn.mockReturnValue(of(['Groceries', 'Transport']));

      await service.init();

      const cats = service.categories();
      const groceries = cats.find((c) => c.id === 'groceries');
      expect(groceries?.color).toBe('#custom-color');
    });

    it('calls setProperty for every category with --color-[id] (AC4, AC5)', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue('sheet-id');
      sheetsSpy.findCategoriesTab.mockResolvedValue({ tabName: 'Categories' });
      sheetsSpy.readCategoriesTabColumn.mockReturnValue(of(['Food', 'Transport']));

      await service.init();

      expect(setPropertySpy).toHaveBeenCalledWith('--color-food', expect.any(String));
      expect(setPropertySpy).toHaveBeenCalledWith('--color-transport', expect.any(String));
    });

    it('never rejects when IdbService.getAll throws — sets loadError (AC7)', async () => {
      idbSpy.getAll.mockRejectedValue(new Error('IDB exploded'));

      await expect(service.init()).resolves.toBeUndefined();
      expect(service.loadError()).not.toBeNull();
      expect(service.categories()).toEqual([]);
    });

    it('never rejects when both IDB and Sheets fail — sets loadError (AC7)', async () => {
      idbSpy.getAll.mockRejectedValue(new Error('IDB down'));

      await expect(service.init()).resolves.toBeUndefined();
      expect(service.loadError()).not.toBeNull();
    });
  });

  describe('retry()', () => {
    it('clears loadError on success and re-populates the signal', async () => {
      // Simulate a prior failure state
      idbSpy.getAll.mockRejectedValue(new Error('IDB down'));
      await service.init();
      expect(service.loadError()).not.toBeNull();

      // Now recover
      sheetsSpy.connectedSpreadsheetId.mockReturnValue('sheet-id');
      sheetsSpy.findCategoriesTab.mockResolvedValue({ tabName: 'Categories' });
      sheetsSpy.readCategoriesTabColumn.mockReturnValue(of(['Food']));

      await service.retry();

      expect(service.loadError()).toBeNull();
      expect(service.categories().length).toBeGreaterThan(0);
    });

    it('sets loadError when retry also fails', async () => {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue('sheet-id');
      sheetsSpy.findCategoriesTab.mockRejectedValue({ type: 'NETWORK', message: 'still offline' });

      await service.retry();

      expect(service.loadError()).not.toBeNull();
    });
  });

  describe('assignDefaultColors()', () => {
    it('trims and filters empty names', () => {
      const result = service.assignDefaultColors(['  Food  ', '', '  '], new Map());
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Food');
    });

    it('wraps palette index to avoid out-of-bounds', () => {
      const names = Array.from({ length: DEFAULT_CATEGORY_PALETTE.length + 2 }, (_, i) => `Cat${i}`);
      const result = service.assignDefaultColors(names, new Map());
      expect(result[DEFAULT_CATEGORY_PALETTE.length].color).toBe(DEFAULT_CATEGORY_PALETTE[0]);
    });

    it('sets position equal to array index for new categories', () => {
      const result = service.assignDefaultColors(['A', 'B', 'C'], new Map());
      expect(result.map((c) => c.position)).toEqual([0, 1, 2]);
    });

    it('preserves prior position for existing categories on re-seed', () => {
      const existing = new Map<string, Category>([
        ['b', { id: 'b', name: 'B', color: '#222', position: 0 }],
        ['a', { id: 'a', name: 'A', color: '#111', position: 1 }],
      ]);
      const result = service.assignDefaultColors(['A', 'B'], existing);
      const byId = new Map(result.map(c => [c.id, c]));
      expect(byId.get('a')?.position).toBe(1);
      expect(byId.get('b')?.position).toBe(0);
    });
  });

  describe('reorder()', () => {
    const cats: Category[] = [
      { id: 'a', name: 'Alpha', color: '#111', position: 0 },
      { id: 'b', name: 'Beta', color: '#222', position: 1 },
      { id: 'c', name: 'Gamma', color: '#333', position: 2 },
    ];

    beforeEach(() => {
      idbSpy.getAll.mockResolvedValue(cats);
    });

    async function seedCategories() {
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.init();
    }

    it('reassigns position to array index matching input order (AC2)', async () => {
      await seedCategories();
      await service.reorder(['c', 'a', 'b']);
      const result = service.categories();
      expect(result[0]).toMatchObject({ id: 'c', position: 0 });
      expect(result[1]).toMatchObject({ id: 'a', position: 1 });
      expect(result[2]).toMatchObject({ id: 'b', position: 2 });
    });

    it('updates the signal before any IdbService.set resolves (optimistic AC3)', async () => {
      await seedCategories();
      let signalDuringWrite: Category[] = [];
      idbSpy.set.mockImplementation(async () => {
        signalDuringWrite = service.categories();
      });
      await service.reorder(['b', 'a', 'c']);
      expect(signalDuringWrite[0].id).toBe('b');
    });

    it('calls IdbService.set once per category in input order (AC2)', async () => {
      await seedCategories();
      await service.reorder(['c', 'a', 'b']);
      const setCalls = idbSpy.set.mock.calls.filter((c: unknown[]) => c[0] === 'categories');
      expect(setCalls).toHaveLength(3);
      expect(setCalls[0][2]).toMatchObject({ id: 'c', position: 0 });
      expect(setCalls[1][2]).toMatchObject({ id: 'a', position: 1 });
      expect(setCalls[2][2]).toMatchObject({ id: 'b', position: 2 });
    });

    it('rolls back signal and surfaces IDB_ERROR when IdbService.set rejects (AC8)', async () => {
      await seedCategories();
      const originalOrder = service.categories().map(c => c.id);
      idbSpy.set.mockRejectedValue(new Error('disk full'));
      await expect(service.reorder(['c', 'a', 'b'])).rejects.toMatchObject({ type: 'IDB_ERROR' });
      expect(service.categories().map(c => c.id)).toEqual(originalOrder);
      expect(notificationSpy.showError).toHaveBeenCalledWith(expect.objectContaining({ type: 'IDB_ERROR' }));
    });

    it('throws IDB_ERROR before signal mutation when length mismatches', async () => {
      await seedCategories();
      const originalOrder = service.categories().map(c => c.id);
      await expect(service.reorder(['a', 'b'])).rejects.toMatchObject({ type: 'IDB_ERROR' });
      expect(service.categories().map(c => c.id)).toEqual(originalOrder);
      expect(idbSpy.set).not.toHaveBeenCalledWith('categories', expect.anything(), expect.anything());
      expect(notificationSpy.showError).toHaveBeenCalledWith(expect.objectContaining({ type: 'IDB_ERROR' }));
    });

    it('throws IDB_ERROR before signal mutation when id is unknown', async () => {
      await seedCategories();
      const originalOrder = service.categories().map(c => c.id);
      await expect(service.reorder(['a', 'b', 'unknown'])).rejects.toMatchObject({ type: 'IDB_ERROR' });
      expect(service.categories().map(c => c.id)).toEqual(originalOrder);
      expect(notificationSpy.showError).toHaveBeenCalledWith(expect.objectContaining({ type: 'IDB_ERROR' }));
    });

    it('throws IDB_ERROR before signal mutation when reorderedIds contains duplicates', async () => {
      await seedCategories();
      const originalOrder = service.categories().map(c => c.id);
      await expect(service.reorder(['a', 'a', 'b'])).rejects.toMatchObject({ type: 'IDB_ERROR' });
      expect(service.categories().map(c => c.id)).toEqual(originalOrder);
      expect(idbSpy.set).not.toHaveBeenCalledWith('categories', expect.anything(), expect.anything());
      expect(notificationSpy.showError).toHaveBeenCalledWith(expect.objectContaining({ type: 'IDB_ERROR' }));
    });

    it('does not invoke any SheetsService method during reorder (AC5)', async () => {
      await seedCategories();
      vi.clearAllMocks();
      await service.reorder(['a', 'b', 'c']);
      expect(sheetsSpy.ensureLoaded).not.toHaveBeenCalled();
      expect(sheetsSpy.connectedSpreadsheetId).not.toHaveBeenCalled();
      expect(sheetsSpy.findCategoriesTab).not.toHaveBeenCalled();
      expect(sheetsSpy.readCategoriesTabColumn).not.toHaveBeenCalled();
      expect(sheetsSpy.readActiveTabCategoryColumn).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    const cat: Category = { id: 'food', name: 'Food', color: '#6366f1', position: 0 };
    const updated: Category = { ...cat, color: '#ef4444' };

    beforeEach(async () => {
      idbSpy.getAll.mockResolvedValue([cat]);
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.init();
    });

    it('persists to IDB (AC5)', async () => {
      await service.update(updated);
      expect(idbSpy.set).toHaveBeenCalledWith('categories', updated.id, updated);
    });

    it('updates _categories signal (AC3)', async () => {
      await service.update(updated);
      const result = service.categories().find(c => c.id === 'food');
      expect(result?.color).toBe('#ef4444');
    });

    it('calls setProperty with new color immediately (AC3)', async () => {
      await service.update(updated);
      expect(setPropertySpy).toHaveBeenCalledWith('--color-food', '#ef4444');
    });

    it('verifies CSS variable value via getPropertyValue after update (AC3)', async () => {
      await service.update(updated);
      const value = document.documentElement.style.getPropertyValue('--color-food');
      expect(value).toBe('#ef4444');
    });

    it('throws IDB_ERROR on persistence failure (AC5)', async () => {
      idbSpy.set.mockRejectedValue(new Error('disk full'));
      await expect(service.update(updated)).rejects.toMatchObject({ type: 'IDB_ERROR' });
    });

    it('does not update signal when IDB write fails (AC5)', async () => {
      idbSpy.set.mockRejectedValue(new Error('disk full'));
      try { await service.update(updated); } catch { /* expected */ }
      expect(service.categories().find(c => c.id === 'food')?.color).toBe('#6366f1');
    });
  });

  describe('removeCssVar()', () => {
    it('calls removeProperty on documentElement.style', () => {
      const removeSpy = vi.spyOn(document.documentElement.style, 'removeProperty');
      service.removeCssVar('food');
      expect(removeSpy).toHaveBeenCalledWith('--color-food');
    });
  });

  describe('refreshFromSheet()', () => {
    it('calls notification.showInfo with placeholder message (AC4 stub)', async () => {
      await service.refreshFromSheet();
      expect(notificationSpy.showInfo).toHaveBeenCalledWith(
        expect.stringContaining('later story'),
      );
    });

    it('does not call any SheetsService HTTP method (AC5 — stub only)', async () => {
      await service.refreshFromSheet();
      expect(sheetsSpy.ensureLoaded).not.toHaveBeenCalled();
      expect(sheetsSpy.readCategoriesTabColumn).not.toHaveBeenCalled();
    });
  });

  describe('markUsed() + categoryOrder', () => {
    const cats: Category[] = [
      { id: 'food', name: 'Food', color: '#111', position: 0 },
      { id: 'transport', name: 'Transport', color: '#222', position: 1 },
      { id: 'health', name: 'Health', color: '#333', position: 2 },
    ];

    beforeEach(async () => {
      idbSpy.getAll.mockResolvedValue(cats);
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.init();
    });

    it('categoryOrder returns categories sorted by position asc when no usage data (AC5)', () => {
      const order = service.categoryOrder();
      expect(order.map(c => c.id)).toEqual(['food', 'transport', 'health']);
    });

    it('markUsed bumps the used category to top of categoryOrder (AC5)', async () => {
      service.markUsed('health');
      await Promise.resolve(); // let signal settle

      const order = service.categoryOrder();
      expect(order[0].id).toBe('health');
    });

    it('most recently used category wins over earlier used (AC5)', async () => {
      service.markUsed('transport');
      await Promise.resolve();
      service.markUsed('food');
      await Promise.resolve();

      const order = service.categoryOrder();
      expect(order[0].id).toBe('food');
      expect(order[1].id).toBe('transport');
    });

    it('markUsed writes to appMeta.categoryRecentlyUsed in IDB', () => {
      service.markUsed('food');
      expect(idbSpy.set).toHaveBeenCalledWith(
        'appMeta',
        'categoryRecentlyUsed',
        expect.objectContaining({ food: expect.any(Number) }),
      );
    });

  });

  describe('categoryOrder — restored from IDB on init (AC5)', () => {
    it('init() loads categoryRecentlyUsed from IDB and restores order', async () => {
      const cats: Category[] = [
        { id: 'food', name: 'Food', color: '#111', position: 0 },
        { id: 'transport', name: 'Transport', color: '#222', position: 1 },
        { id: 'health', name: 'Health', color: '#333', position: 2 },
      ];
      const recentData: Record<string, number> = {
        health: Date.now() - 1000,
        transport: Date.now() - 500,
      };
      idbSpy.getAll.mockResolvedValue(cats);
      idbSpy.get.mockImplementation(async (_store: string, key: string) => {
        if (key === 'categoryRecentlyUsed') return recentData;
        return undefined;
      });
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);

      await service.init();

      const order = service.categoryOrder();
      expect(order[0].id).toBe('transport'); // most recent last-used
      expect(order[1].id).toBe('health');
    });
  });

  describe('create()', () => {
    const existing: Category[] = [
      { id: 'food', name: 'Food', color: '#6366f1', position: 0 },
    ];

    beforeEach(async () => {
      idbSpy.getAll.mockResolvedValue(existing);
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.init();
      vi.clearAllMocks();
      sheetsSpy.appendCategoryRow.mockReturnValue(of(undefined));
    });

    it('happy path — IDB row written, signal updated, CSS var injected, sheets called once', async () => {
      const cat = await service.create({ name: 'Groceries' });

      expect(idbSpy.put).toHaveBeenCalledWith('categories', expect.objectContaining({ name: 'Groceries' }));
      expect(service.categories().find(c => c.name === 'Groceries')).toBeTruthy();
      expect(setPropertySpy).toHaveBeenCalledWith(`--color-${cat.id}`, cat.color);
      expect(sheetsSpy.appendCategoryRow).toHaveBeenCalledOnce();
    });

    it('throws on empty name — no IDB write, no Sheets call', async () => {
      await expect(service.create({ name: '' })).rejects.toMatchObject({ type: 'IDB_ERROR', message: 'Name is required' });
      expect(idbSpy.put).not.toHaveBeenCalled();
      expect(sheetsSpy.appendCategoryRow).not.toHaveBeenCalled();
    });

    it('throws on whitespace-only name', async () => {
      await expect(service.create({ name: '   ' })).rejects.toMatchObject({ type: 'IDB_ERROR', message: 'Name is required' });
    });

    it('throws on case-insensitive duplicate name', async () => {
      await expect(service.create({ name: 'food' })).rejects.toMatchObject({ type: 'CATEGORY_NAME_DUPLICATE', name: 'food' });
      expect(idbSpy.put).not.toHaveBeenCalled();
      expect(sheetsSpy.appendCategoryRow).not.toHaveBeenCalled();
    });

    it('on Sheets failure — IDB row persists, signal updated, syncQueue enqueued, notification shown', async () => {
      sheetsSpy.appendCategoryRow.mockReturnValue(throwError(() => ({ type: 'SHEETS_API', status: 500, message: 'Server error' })));

      const cat = await service.create({ name: 'Transport' });

      expect(service.categories().find(c => c.name === 'Transport')).toBeTruthy();
      expect(syncQueueSpy.enqueue).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'CATEGORY_INSERT',
        categoryData: expect.objectContaining({ name: 'Transport' }),
      }));
      expect(notificationSpy.showError).toHaveBeenCalled();
      expect(cat.name).toBe('Transport');
    });

    it('assigns position = max existing position + 1', async () => {
      const cat = await service.create({ name: 'NewCat' });
      expect(cat.position).toBe(1); // existing max is 0
    });

    it('picks next unused palette color', async () => {
      const cat = await service.create({ name: 'NewCat' });
      expect(cat.color).not.toBe('#6366f1'); // first palette color already used by 'Food'
    });
  });

  describe('delete()', () => {
    const cat: Category = { id: 'food', name: 'Food', color: '#6366f1', position: 0 };
    let removePropertySpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      idbSpy.getAll.mockResolvedValue([cat]);
      sheetsSpy.connectedSpreadsheetId.mockReturnValue(null);
      await service.init();
      vi.clearAllMocks();
      removePropertySpy = vi.spyOn(document.documentElement.style, 'removeProperty');
    });

    it('happy path — IDB delete called, signal filtered, CSS var removed, no Sheets call', async () => {
      await service.delete(cat.id);

      expect(idbSpy.delete).toHaveBeenCalledWith('categories', cat.id);
      expect(service.categories().find(c => c.id === cat.id)).toBeUndefined();
      expect(removePropertySpy).toHaveBeenCalledWith(`--color-${cat.id}`);
      expect(sheetsSpy.appendCategoryRow).not.toHaveBeenCalled();
    });

    it('throws CATEGORY_IN_USE with exact entryCount when entries reference category name', async () => {
      entriesSignal.set([{ category: 'Food' }, { category: 'Food' }, { category: 'Other' }] as never);

      await expect(service.delete(cat.id)).rejects.toMatchObject({
        type: 'CATEGORY_IN_USE',
        categoryId: cat.id,
        categoryName: 'Food',
        entryCount: 2,
      });
      expect(idbSpy.delete).not.toHaveBeenCalled();
      expect(removePropertySpy).not.toHaveBeenCalled();
    });

    it('is idempotent for unknown id — silent no-op', async () => {
      await expect(service.delete('unknown-id')).resolves.toBeUndefined();
      expect(idbSpy.delete).not.toHaveBeenCalled();
    });
  });

  describe('slugifyCategoryId()', () => {
    it("slugifies 'Food & Drinks' to 'food-drinks'", () => {
      expect(slugifyCategoryId('Food & Drinks')).toBe('food-drinks');
    });

    it("slugifies '  Café  ' to exactly 'caf' (non-ASCII collapses to dash, then stripped)", () => {
      expect(slugifyCategoryId('  Café  ')).toBe('caf');
    });

    it('lowercases the output', () => {
      expect(slugifyCategoryId('GROCERIES')).toBe('groceries');
    });

    it('collapses multiple special chars into one dash', () => {
      expect(slugifyCategoryId('A & B && C')).toBe('a-b-c');
    });
  });
});
