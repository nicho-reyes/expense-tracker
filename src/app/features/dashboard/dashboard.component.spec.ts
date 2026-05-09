import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { DashboardComponent } from './dashboard.component';
import { EntriesService } from '../../core/services/entries.service';
import { LocalEntry, MonthlyTotal } from '../../core/models/entry.model';
import { currentMonthIso } from '../../shared/utils/month.util';

// Chart.js requires canvas.getContext('2d') which JSDOM doesn't implement
beforeAll(() => {
  const ctx = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'canvas') return document.createElement('canvas');
        if (prop === 'measureText') return vi.fn().mockReturnValue({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
        if (prop === 'createLinearGradient') return vi.fn().mockReturnValue({ addColorStop: vi.fn() });
        if (prop === 'createRadialGradient') return vi.fn().mockReturnValue({ addColorStop: vi.fn() });
        return vi.fn().mockReturnValue(undefined);
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
});

function makeEntry(overrides: Partial<LocalEntry> = {}): LocalEntry {
  return {
    id: crypto.randomUUID(),
    date: '2026-05-01',
    month: '2026-05',
    year: 2026,
    category: 'Food',
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

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let entriesSignal: ReturnType<typeof signal<LocalEntry[]>>;
  let initializedSignal: ReturnType<typeof signal<boolean>>;
  let bottomSheetSpy: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    entriesSignal = signal<LocalEntry[]>([]);
    initializedSignal = signal(true);

    const entriesServiceMock = {
      entries: entriesSignal.asReadonly(),
      isInitialized: initializedSignal.asReadonly(),
      monthlyTotals: computed<MonthlyTotal[]>(() => []),
    };

    bottomSheetSpy = {
      open: vi.fn().mockReturnValue({
        afterDismissed: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, NoopAnimationsModule],
      providers: [
        { provide: EntriesService, useValue: entriesServiceMock },
        { provide: MatBottomSheet, useValue: bottomSheetSpy },
        provideCharts(withDefaultRegisterables()),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('FAB has aria-label="Add expense" (AC15)', () => {
    const fab = fixture.nativeElement.querySelector('button[aria-label="Add expense"]');
    expect(fab).toBeTruthy();
  });

  it('FAB is visible (not hidden) before sheet opens (AC12)', () => {
    const fab = fixture.nativeElement.querySelector('button[aria-label="Add expense"]') as HTMLElement;
    expect(fab.style.visibility).not.toBe('hidden');
  });

  it('FAB visibility becomes hidden when sheetOpen is true (AC12)', () => {
    component.sheetOpen.set(true);
    fixture.detectChanges();
    const fab = fixture.nativeElement.querySelector('button[aria-label="Add expense"]') as HTMLElement;
    expect(fab.style.visibility).toBe('hidden');
  });

  it('onOpenQuickAdd opens the bottom sheet (AC1)', () => {
    component.onOpenQuickAdd();
    expect(bottomSheetSpy.open).toHaveBeenCalled();
  });

  it('displays correct total for current month entries', () => {
    const currentMonth = currentMonthIso();
    entriesSignal.set([
      makeEntry({ month: currentMonth, amount: 50 }),
      makeEntry({ month: currentMonth, amount: 30 }),
      makeEntry({ month: '2026-03', amount: 999 }),
    ]);
    fixture.detectChanges();
    expect(component.monthTotal()).toBe(80);
  });

  it('reduces total by negative amounts (refunds)', () => {
    const currentMonth = currentMonthIso();
    entriesSignal.set([
      makeEntry({ month: currentMonth, amount: 85.5 }),
      makeEntry({ month: currentMonth, amount: 12 }),
      makeEntry({ month: currentMonth, amount: -20 }),
    ]);
    fixture.detectChanges();
    expect(component.monthTotal()).toBeCloseTo(77.5);
  });

  it('onPrevMonth decrements selectedMonth and monthTotal updates', () => {
    const currentMonth = currentMonthIso();
    const prevMonth = '2026-04';
    entriesSignal.set([
      makeEntry({ month: currentMonth, amount: 100 }),
      makeEntry({ month: prevMonth, amount: 42 }),
    ]);
    fixture.detectChanges();

    component.onPrevMonth();
    fixture.detectChanges();

    expect(component.selectedMonth()).toBe(prevMonth);
    expect(component.monthTotal()).toBe(42);
  });

  it('onNextMonth is no-op when canGoNext is false (current month)', () => {
    const currentMonth = currentMonthIso();
    component.selectedMonth.set(currentMonth);
    fixture.detectChanges();

    expect(component.canGoNext()).toBe(false);
    component.onNextMonth();
    expect(component.selectedMonth()).toBe(currentMonth);
  });

  it('canGoNext is true when selectedMonth is in the past', () => {
    component.selectedMonth.set('2026-03');
    fixture.detectChanges();
    expect(component.canGoNext()).toBe(true);
  });

  it('prev button has aria-label "Previous month"', () => {
    const prevBtn = fixture.debugElement.query(By.css('button[aria-label="Previous month"]'));
    expect(prevBtn).toBeTruthy();
  });

  it('next button has aria-label "Next month"', () => {
    const nextBtn = fixture.debugElement.query(By.css('button[aria-label="Next month"]'));
    expect(nextBtn).toBeTruthy();
  });

  it('next button is disabled when on current month', () => {
    const currentMonth = currentMonthIso();
    component.selectedMonth.set(currentMonth);
    fixture.detectChanges();

    const nextBtn = fixture.debugElement.query(By.css('button[aria-label="Next month"]'));
    expect(nextBtn.nativeElement.disabled).toBe(true);
  });

  it('next button is enabled when on a past month', () => {
    component.selectedMonth.set('2026-03');
    fixture.detectChanges();

    const nextBtn = fixture.debugElement.query(By.css('button[aria-label="Next month"]'));
    expect(nextBtn.nativeElement.disabled).toBe(false);
  });

  it('isLoading is true when service not initialized', () => {
    initializedSignal.set(false);
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);
  });

  it('isLoading is false when service is initialized', () => {
    initializedSignal.set(true);
    fixture.detectChanges();
    expect(component.isLoading()).toBe(false);
  });
});
