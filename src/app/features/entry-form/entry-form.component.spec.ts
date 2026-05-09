import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { QuickAddSheetComponent } from './entry-form.component';
import { EntriesService } from '../../core/services/entries.service';
import { CategoriesService } from '../../core/services/categories.service';
import { NotificationService } from '../../core/services/notification.service';
import { Category } from '../../core/models/category.model';
import { LocalEntry } from '../../core/models/entry.model';

const CAT_A: Category = { id: 'food', name: 'Food', color: '#6366f1', position: 0 };
const CAT_B: Category = { id: 'transport', name: 'Transport', color: '#f43f5e', position: 1 };

const SAVED_ENTRY: LocalEntry = {
  id: 'uuid-1',
  date: '2026-05-09',
  month: '2026-05',
  year: 2026,
  category: 'food',
  amount: 12.5,
  remarks: '',
  tabName: '2026',
  schemaVersion: '2026',
  sheetRowIndex: null,
  syncStatus: 'pending',
  isReadOnly: false,
};

describe('QuickAddSheetComponent', () => {
  let component: QuickAddSheetComponent;
  let fixture: ComponentFixture<QuickAddSheetComponent>;
  let entriesSpy: { add: ReturnType<typeof vi.fn> };
  let categoriesSpy: {
    categoryOrder: ReturnType<typeof signal<Category[]>>;
    markUsed: ReturnType<typeof vi.fn>;
  };
  let notificationSpy: { showError: ReturnType<typeof vi.fn> };
  let bottomSheetRefSpy: { dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    entriesSpy = { add: vi.fn().mockResolvedValue(SAVED_ENTRY) };
    categoriesSpy = {
      categoryOrder: signal<Category[]>([CAT_A, CAT_B]),
      markUsed: vi.fn(),
    };
    notificationSpy = { showError: vi.fn() };
    bottomSheetRefSpy = { dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [QuickAddSheetComponent],
      providers: [
        { provide: EntriesService, useValue: entriesSpy },
        { provide: CategoriesService, useValue: categoriesSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: MatBottomSheetRef, useValue: bottomSheetRefSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickAddSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('AC2 — date pre-filled with today', () => {
    it('dateValue signal equals today local ISO string on creation', () => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expect(component.dateValue()).toBe(today);
    });
  });

  describe('AC4 — category select + amount focus', () => {
    it('sets selectedCategoryId when onSelectCategory is called', () => {
      component.onSelectCategory('food');
      expect(component.selectedCategoryId()).toBe('food');
    });

    it('queues amount input focus after category select', async () => {
      const focusSpy = vi.spyOn(component.amountInput.nativeElement, 'focus');
      component.onSelectCategory('food');
      await new Promise(r => queueMicrotask(r as () => void));
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('AC5 — category tile order from categoryOrder signal', () => {
    it('categoryTiles reflects categories.categoryOrder computed', () => {
      expect(component.categoryTiles()).toEqual([CAT_A, CAT_B]);
    });
  });

  describe('AC7 — zero amount blocks save', () => {
    it('canSave is false when amount is null', () => {
      component.selectedCategoryId.set('food');
      component.amountValue.set(null);
      expect(component.canSave()).toBe(false);
    });

    it('canSave is false when amount is 0', () => {
      component.selectedCategoryId.set('food');
      component.amountValue.set(0);
      expect(component.canSave()).toBe(false);
    });

    it('canSave is false when no category selected', () => {
      component.amountValue.set(10);
      expect(component.canSave()).toBe(false);
    });

    it('canSave is true when category + nonzero amount', () => {
      component.selectedCategoryId.set('food');
      component.amountValue.set(10);
      expect(component.canSave()).toBe(true);
    });
  });

  describe('AC8 — negative amounts pass through', () => {
    it('onSave passes negative amount unchanged to entries.add()', async () => {
      component.selectedCategoryId.set('food');
      component.amountValue.set(-12.5);
      await component.onSave();
      expect(entriesSpy.add).toHaveBeenCalledWith(
        expect.objectContaining({ amount: -12.5 }),
      );
    });
  });

  describe('AC10 — save flow', () => {
    beforeEach(() => {
      component.selectedCategoryId.set('food');
      component.amountValue.set(15);
    });

    it('calls entries.add() with correct payload', async () => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await component.onSave();
      expect(entriesSpy.add).toHaveBeenCalledWith({
        date: today,
        category: 'food',
        amount: 15,
        remarks: '',
      });
    });

    it('calls categories.markUsed() after entries.add() resolves', async () => {
      await component.onSave();
      expect(categoriesSpy.markUsed).toHaveBeenCalledWith('food');
    });

    it('calls bottomSheetRef.dismiss({ saved: true }) on success', async () => {
      await component.onSave();
      expect(bottomSheetRefSpy.dismiss).toHaveBeenCalledWith({ saved: true });
    });

    it('does not call dismiss when canSave is false', async () => {
      component.amountValue.set(0);
      await component.onSave();
      expect(bottomSheetRefSpy.dismiss).not.toHaveBeenCalled();
    });
  });

  describe('AC11 — onCancel dismisses with saved: false', () => {
    it('calls dismiss with { saved: false }', () => {
      component.onCancel();
      expect(bottomSheetRefSpy.dismiss).toHaveBeenCalledWith({ saved: false });
    });
  });

  describe('save error handling', () => {
    it('shows notification and keeps sheet open when add() rejects', async () => {
      entriesSpy.add.mockRejectedValue(new Error('IDB write failed'));
      component.selectedCategoryId.set('food');
      component.amountValue.set(10);

      await component.onSave();

      expect(notificationSpy.showError).toHaveBeenCalledWith(
        expect.stringContaining('Could not save'),
      );
      expect(bottomSheetRefSpy.dismiss).not.toHaveBeenCalled();
    });

    it('resets isSaving to false even on error', async () => {
      entriesSpy.add.mockRejectedValue(new Error('fail'));
      component.selectedCategoryId.set('food');
      component.amountValue.set(10);

      await component.onSave();

      expect(component.isSaving()).toBe(false);
    });
  });
});
