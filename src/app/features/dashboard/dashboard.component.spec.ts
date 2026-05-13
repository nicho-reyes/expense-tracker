import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { DashboardComponent } from './dashboard.component';
import { EntriesService } from '../../core/services/entries.service';
import { CategoriesService } from '../../core/services/categories.service';
import { LocalEntry } from '../../core/models/entry.model';
import { Category } from '../../core/models/category.model';

function makeEntry(overrides: Partial<LocalEntry> = {}): LocalEntry {
  return {
    id: crypto.randomUUID(),
    date: '2026-05-10',
    month: '2026-05',
    year: 2026,
    category: 'food',
    amount: 10,
    remarks: '',
    tabName: '2026',
    schemaVersion: '2026',
    sheetRowIndex: null,
    syncStatus: 'pending',
    isReadOnly: false,
    ...overrides,
  };
}

const CAT_FOOD: Category = { id: 'food', name: 'Food', color: '#6366f1', position: 0 };

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let entriesSignal: ReturnType<typeof signal<LocalEntry[]>>;
  let bottomSheetSpy: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    entriesSignal = signal<LocalEntry[]>([]);

    bottomSheetSpy = {
      open: vi.fn().mockReturnValue({
        afterDismissed: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, NoopAnimationsModule],
      providers: [
        { provide: EntriesService, useValue: { entries: entriesSignal.asReadonly() } },
        { provide: CategoriesService, useValue: { categories: signal<Category[]>([CAT_FOOD]).asReadonly() } },
        { provide: MatBottomSheet, useValue: bottomSheetSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('FAB has aria-label="Add expense"', () => {
    const fab = fixture.nativeElement.querySelector('button[aria-label="Add expense"]');
    expect(fab).toBeTruthy();
  });

  it('FAB is visible before sheet opens', () => {
    const fab = fixture.nativeElement.querySelector('button[aria-label="Add expense"]') as HTMLElement;
    expect(fab.style.visibility).not.toBe('hidden');
  });

  it('FAB becomes hidden when sheetOpen is true', () => {
    component.sheetOpen.set(true);
    fixture.detectChanges();
    const fab = fixture.nativeElement.querySelector('button[aria-label="Add expense"]') as HTMLElement;
    expect(fab.style.visibility).toBe('hidden');
  });

  it('onOpenQuickAdd opens the bottom sheet', () => {
    component.onOpenQuickAdd();
    expect(bottomSheetSpy.open).toHaveBeenCalled();
  });

  it('todayTotal sums entries for today only', () => {
    const today = new Date().toISOString().slice(0, 10);
    entriesSignal.set([
      makeEntry({ date: today, month: today.slice(0, 7), amount: 40 }),
      makeEntry({ date: today, month: today.slice(0, 7), amount: 15 }),
      makeEntry({ date: '2026-04-01', month: '2026-04', year: 2026, amount: 999 }),
    ]);
    fixture.detectChanges();
    expect(component.todayTotal()).toBeCloseTo(55);
  });

  it('monthTotal sums entries for current month only', () => {
    entriesSignal.set([
      makeEntry({ month: '2026-05', amount: 50 }),
      makeEntry({ month: '2026-05', amount: 30 }),
      makeEntry({ month: '2026-03', amount: 999 }),
    ]);
    fixture.detectChanges();
    expect(component.monthTotal()).toBe(80);
  });

  it('yearTotal sums all entries for current year', () => {
    entriesSignal.set([
      makeEntry({ month: '2026-01', year: 2026, amount: 100 }),
      makeEntry({ month: '2026-05', year: 2026, amount: 200 }),
      makeEntry({ month: '2025-12', year: 2025, amount: 999 }),
    ]);
    fixture.detectChanges();
    expect(component.yearTotal()).toBe(300);
  });

  it('allTimeTotal sums all entries regardless of year', () => {
    entriesSignal.set([
      makeEntry({ year: 2026, amount: 100 }),
      makeEntry({ year: 2025, amount: 50 }),
    ]);
    fixture.detectChanges();
    expect(component.allTimeTotal()).toBe(150);
  });

  it('monthTotal handles negative amounts (refunds)', () => {
    entriesSignal.set([
      makeEntry({ month: '2026-05', amount: 85.5 }),
      makeEntry({ month: '2026-05', amount: -20 }),
    ]);
    fixture.detectChanges();
    expect(component.monthTotal()).toBeCloseTo(65.5);
  });
});
