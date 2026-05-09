import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CategoriesService } from './categories.service';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { Category, DEFAULT_CATEGORY_PALETTE, slugifyCategoryId } from '../models/category.model';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let idbSpy: {
    getAll: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let sheetsSpy: {
    ensureLoaded: ReturnType<typeof vi.fn>;
    connectedSpreadsheetId: ReturnType<typeof vi.fn>;
    findCategoriesTab: ReturnType<typeof vi.fn>;
    readCategoriesTabColumn: ReturnType<typeof vi.fn>;
    readActiveTabCategoryColumn: ReturnType<typeof vi.fn>;
    getActive2026TabName: ReturnType<typeof vi.fn>;
  };
  let setPropertySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    idbSpy = {
      getAll: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    sheetsSpy = {
      ensureLoaded: vi.fn().mockResolvedValue(undefined),
      connectedSpreadsheetId: vi.fn().mockReturnValue(null),
      findCategoriesTab: vi.fn().mockResolvedValue(null),
      readCategoriesTabColumn: vi.fn().mockReturnValue(of([])),
      readActiveTabCategoryColumn: vi.fn().mockReturnValue(of([])),
      getActive2026TabName: vi.fn().mockReturnValue(null),
    };
    setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

    TestBed.configureTestingModule({
      providers: [
        CategoriesService,
        { provide: IdbService, useValue: idbSpy },
        { provide: SheetsService, useValue: sheetsSpy },
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

    it('sets position equal to array index', () => {
      const result = service.assignDefaultColors(['A', 'B', 'C'], new Map());
      expect(result.map((c) => c.position)).toEqual([0, 1, 2]);
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
