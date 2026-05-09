import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';
import { EntryDetailSheetComponent } from './entry-detail-sheet.component';
import { EntriesService } from '../../core/services/entries.service';
import { CategoriesService } from '../../core/services/categories.service';
import { NotificationService } from '../../core/services/notification.service';
import { LocalEntry } from '../../core/models/entry.model';

const ENTRY: LocalEntry = {
  id: 'test-id',
  date: '2026-05-09',
  month: '2026-05',
  year: 2026,
  category: 'Food',
  amount: 25.0,
  remarks: 'Dinner',
  tabName: '2026',
  schemaVersion: '2026',
  sheetRowIndex: null,
  syncStatus: 'pending',
  isReadOnly: false,
};

const READ_ONLY_ENTRY: LocalEntry = {
  ...ENTRY,
  id: 'ro-id',
  isReadOnly: true,
  syncStatus: 'synced',
};

describe('EntryDetailSheetComponent', () => {
  let fixture: ComponentFixture<EntryDetailSheetComponent>;
  let component: EntryDetailSheetComponent;

  let entriesSpy: {
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    finalizeDelete: ReturnType<typeof vi.fn>;
  };
  let notificationSpy: {
    showError: ReturnType<typeof vi.fn>;
    showUndoableDelete: ReturnType<typeof vi.fn>;
  };
  let bottomSheetRefSpy: { dismiss: ReturnType<typeof vi.fn> };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };
  let dialogAfterClosed$: Subject<boolean>;

  function createComponent(entryId: string = ENTRY.id) {
    dialogAfterClosed$ = new Subject<boolean>();
    dialogSpy = {
      open: vi.fn().mockReturnValue({ afterClosed: () => dialogAfterClosed$.asObservable() }),
    };

    TestBed.configureTestingModule({
      imports: [EntryDetailSheetComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: { entryId } },
        { provide: MatBottomSheetRef, useValue: bottomSheetRefSpy },
        { provide: EntriesService, useValue: entriesSpy },
        { provide: CategoriesService, useValue: { categoryOrder: () => [] } },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntryDetailSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    entriesSpy = {
      getById: vi.fn().mockReturnValue(ENTRY),
      update: vi.fn().mockResolvedValue(ENTRY),
      delete: vi.fn().mockResolvedValue(ENTRY),
      restore: vi.fn().mockResolvedValue(undefined),
      finalizeDelete: vi.fn().mockResolvedValue(undefined),
    };
    notificationSpy = {
      showError: vi.fn(),
      showUndoableDelete: vi.fn().mockReturnValue({
        onAction: () => of(),
        afterDismissed: () => of(),
      }),
    };
    bottomSheetRefSpy = { dismiss: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  // ── pre-fill ──────────────────────────────────────────────────────────────

  describe('pre-fill', () => {
    it('initialises form fields with existing entry values', () => {
      createComponent();

      expect(component.dateValue()).toBe(ENTRY.date);
      expect(component.selectedCategoryId()).toBe(ENTRY.category);
      expect(component.amountValue()).toBe(ENTRY.amount);
      expect(component.remarksValue()).toBe(ENTRY.remarks);
    });
  });

  // ── read-only mode ────────────────────────────────────────────────────────

  describe('read-only mode', () => {
    it('hides Save and Delete, shows readonly hint when entry.isReadOnly is true', () => {
      entriesSpy.getById.mockReturnValue(READ_ONLY_ENTRY);
      createComponent(READ_ONLY_ENTRY.id);

      expect(component.isReadOnly()).toBe(true);
      expect(component.canSave()).toBe(false);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[data-testid="save-btn"]')).toBeNull();
      expect(el.querySelector('[data-testid="delete-btn"]')).toBeNull();
    });
  });

  // ── save ─────────────────────────────────────────────────────────────────

  describe('onSave()', () => {
    it('calls EntriesService.update with patch and dismisses sheet', async () => {
      createComponent();
      component.amountValue.set(50);

      await component.onSave();

      expect(entriesSpy.update).toHaveBeenCalledWith(
        ENTRY.id,
        expect.objectContaining({ amount: 50 }),
      );
      expect(bottomSheetRefSpy.dismiss).toHaveBeenCalled();
    });
  });

  // ── delete flow ──────────────────────────────────────────────────────────

  describe('onDelete()', () => {
    it('opens DeleteEntryConfirmDialogComponent on delete', () => {
      createComponent();

      component.onDelete();

      expect(dialogSpy.open).toHaveBeenCalled();
    });

    it('calls EntriesService.delete and showUndoableDelete on dialog confirm', async () => {
      createComponent();
      component.onDelete();
      dialogAfterClosed$.next(true);
      dialogAfterClosed$.complete();

      await new Promise(r => setTimeout(r, 0));

      expect(entriesSpy.delete).toHaveBeenCalledWith(ENTRY.id);
      expect(notificationSpy.showUndoableDelete).toHaveBeenCalledWith(ENTRY);
      expect(bottomSheetRefSpy.dismiss).toHaveBeenCalled();
    });

    it('does NOT call EntriesService.delete on dialog cancel', async () => {
      createComponent();
      component.onDelete();
      dialogAfterClosed$.next(false);
      dialogAfterClosed$.complete();

      await new Promise(r => setTimeout(r, 0));

      expect(entriesSpy.delete).not.toHaveBeenCalled();
    });
  });

  // ── undo / finalize paths ─────────────────────────────────────────────────

  describe('undo snackbar', () => {
    it('calls restore when Undo button is tapped (onAction fires before afterDismissed)', async () => {
      const onAction$ = new Subject<void>();
      const afterDismissed$ = new Subject<void>();
      notificationSpy.showUndoableDelete.mockReturnValue({
        onAction: () => onAction$.asObservable(),
        afterDismissed: () => afterDismissed$.asObservable(),
      });
      createComponent();

      component.onDelete();
      dialogAfterClosed$.next(true);
      dialogAfterClosed$.complete();
      await new Promise(r => setTimeout(r, 0));

      onAction$.next();
      onAction$.complete();
      afterDismissed$.next();
      afterDismissed$.complete();
      await new Promise(r => setTimeout(r, 0));

      expect(entriesSpy.restore).toHaveBeenCalledWith(ENTRY);
      expect(entriesSpy.finalizeDelete).not.toHaveBeenCalled();
    });

    it('calls finalizeDelete when timeout expires without Undo tap', async () => {
      const onAction$ = new Subject<void>();
      const afterDismissed$ = new Subject<void>();
      notificationSpy.showUndoableDelete.mockReturnValue({
        onAction: () => onAction$.asObservable(),
        afterDismissed: () => afterDismissed$.asObservable(),
      });
      createComponent();

      component.onDelete();
      dialogAfterClosed$.next(true);
      dialogAfterClosed$.complete();
      await new Promise(r => setTimeout(r, 0));

      afterDismissed$.next();
      afterDismissed$.complete();
      await new Promise(r => setTimeout(r, 0));

      expect(entriesSpy.finalizeDelete).toHaveBeenCalledWith(ENTRY);
      expect(entriesSpy.restore).not.toHaveBeenCalled();
    });
  });
});
