import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { KpiRowComponent } from './kpi-row.component';
import { MonthlyTotal } from '../../../core/models/entry.model';

const historical: MonthlyTotal[] = [
  { month: '2025-11', total: 850, entryCount: 12 },
  { month: '2025-12', total: 1100, entryCount: 18 },
  { month: '2026-01', total: 950, entryCount: 14 },
  { month: '2026-02', total: 800, entryCount: 11 },
  { month: '2026-03', total: 1050, entryCount: 16 },
  { month: '2026-04', total: 900, entryCount: 13 },
  { month: '2026-05', total: 750, entryCount: 9 },
];

// Average of months excluding 2026-05: (850+1100+950+800+1050+900)/6 = 5650/6 ≈ 941.67
const SELECTED = '2026-05';
const SELECTED_TOTAL = 750;

describe('KpiRowComponent', () => {
  let fixture: ComponentFixture<KpiRowComponent>;

  async function create(opts: {
    selectedMonthTotal?: number;
    historicalMonthlyTotals?: MonthlyTotal[];
    selectedMonth?: string;
    selectedMonthEntryCount?: number;
    isLoading?: boolean;
  } = {}) {
    await TestBed.configureTestingModule({
      imports: [KpiRowComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(KpiRowComponent);
    fixture.componentRef.setInput('selectedMonthTotal', opts.selectedMonthTotal ?? SELECTED_TOTAL);
    fixture.componentRef.setInput('historicalMonthlyTotals', opts.historicalMonthlyTotals ?? historical);
    fixture.componentRef.setInput('selectedMonth', opts.selectedMonth ?? SELECTED);
    fixture.componentRef.setInput('selectedMonthEntryCount', opts.selectedMonthEntryCount ?? 9);
    if (opts.isLoading !== undefined) fixture.componentRef.setInput('isLoading', opts.isLoading);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('averageMonthlyTotal computed', () => {
    it('computes mean of months excluding selected month', async () => {
      await create();
      const avg = fixture.componentInstance.averageMonthlyTotal();
      expect(avg).toBeCloseTo((850 + 1100 + 950 + 800 + 1050 + 900) / 6, 1);
    });

    it('returns null when fewer than 2 historical months available', async () => {
      await create({ historicalMonthlyTotals: [{ month: SELECTED, total: 750, entryCount: 9 }] });
      expect(fixture.componentInstance.averageMonthlyTotal()).toBeNull();
    });

    it('returns null when exactly 1 other month available', async () => {
      await create({
        historicalMonthlyTotals: [
          { month: '2026-04', total: 900, entryCount: 13 },
          { month: SELECTED, total: 750, entryCount: 9 },
        ],
      });
      expect(fixture.componentInstance.averageMonthlyTotal()).toBeNull();
    });

    it('excludes zero-entryCount stub months from average', async () => {
      await create({
        historicalMonthlyTotals: [
          { month: '2025-11', total: 0, entryCount: 0 },
          { month: '2025-12', total: 0, entryCount: 0 },
          { month: '2026-01', total: 0, entryCount: 0 },
          { month: '2026-04', total: 900, entryCount: 13 },
          { month: '2026-03', total: 1050, entryCount: 16 },
          { month: SELECTED, total: 750, entryCount: 9 },
        ],
      });
      // Only the two real months (900 + 1050) / 2 = 975; stubs excluded
      expect(fixture.componentInstance.averageMonthlyTotal()).toBeCloseTo(975, 1);
    });
  });

  describe('delta computed', () => {
    it('positive delta when spending above average', async () => {
      await create({ selectedMonthTotal: 2000 });
      expect(fixture.componentInstance.delta()!).toBeGreaterThan(0);
    });

    it('negative delta when spending below average', async () => {
      await create({ selectedMonthTotal: 100 });
      expect(fixture.componentInstance.delta()!).toBeLessThan(0);
    });

    it('returns null when no average available', async () => {
      await create({ historicalMonthlyTotals: [{ month: SELECTED, total: 750, entryCount: 9 }] });
      expect(fixture.componentInstance.delta()).toBeNull();
    });
  });

  describe('deltaClass computed', () => {
    it('returns "over" for positive delta', async () => {
      await create({ selectedMonthTotal: 2000 });
      expect(fixture.componentInstance.deltaClass()).toBe('over');
    });

    it('returns "under" for negative delta', async () => {
      await create({ selectedMonthTotal: 100 });
      expect(fixture.componentInstance.deltaClass()).toBe('under');
    });

    it('returns "muted" when delta is null', async () => {
      await create({ historicalMonthlyTotals: [{ month: SELECTED, total: 750, entryCount: 9 }] });
      expect(fixture.componentInstance.deltaClass()).toBe('muted');
    });

    it('returns "flat" when delta is zero', async () => {
      // avg of [850,1100,950,800,1050,900] = 941.67; use that exact value
      const avg = (850 + 1100 + 950 + 800 + 1050 + 900) / 6;
      await create({ selectedMonthTotal: avg });
      expect(fixture.componentInstance.deltaClass()).toBe('flat');
    });
  });

  describe('DOM rendering — delta cell', () => {
    it('positive delta shows kpi-value over CSS classes and up-arrow icon', async () => {
      await create({ selectedMonthTotal: 2000 });
      const value = fixture.debugElement.query(By.css('.kpi-value.over'));
      expect(value).toBeTruthy();
      const icon = value.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent).toContain('arrow_upward');
    });

    it('negative delta shows kpi-value under CSS classes and down-arrow icon', async () => {
      await create({ selectedMonthTotal: 100 });
      const value = fixture.debugElement.query(By.css('.kpi-value.under'));
      expect(value).toBeTruthy();
      const icon = value.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent).toContain('arrow_downward');
    });

    it('null delta shows "—" muted display', async () => {
      await create({ historicalMonthlyTotals: [{ month: SELECTED, total: 750, entryCount: 9 }] });
      const muted = fixture.debugElement.query(By.css('.kpi-value.muted'));
      expect(muted.nativeElement.textContent.trim()).toBe('—');
    });

    it('zero delta (flat) shows "—" muted display, not CHF 0.00', async () => {
      const avg = (850 + 1100 + 950 + 800 + 1050 + 900) / 6;
      await create({ selectedMonthTotal: avg });
      const muted = fixture.debugElement.query(By.css('.kpi-value.muted'));
      expect(muted.nativeElement.textContent.trim()).toBe('—');
      const overOrUnder = fixture.debugElement.query(By.css('.kpi-value.over, .kpi-value.under'));
      expect(overOrUnder).toBeNull();
    });
  });

  describe('entry count label', () => {
    it('selectedMonthEntryCount=0 produces "0 entries"', async () => {
      await create({ selectedMonthEntryCount: 0 });
      expect(fixture.componentInstance.entryCountLabel()).toBe('0 entries');
    });

    it('selectedMonthEntryCount=1 produces "1 entry"', async () => {
      await create({ selectedMonthEntryCount: 1 });
      expect(fixture.componentInstance.entryCountLabel()).toBe('1 entry');
    });

    it('selectedMonthEntryCount=5 produces "5 entries"', async () => {
      await create({ selectedMonthEntryCount: 5 });
      expect(fixture.componentInstance.entryCountLabel()).toBe('5 entries');
    });
  });

  describe('loading skeleton', () => {
    it('isLoading=true renders two skeleton cards', async () => {
      await create({ isLoading: true });
      const skeletons = fixture.debugElement.queryAll(By.css('.kpi-card.skeleton'));
      expect(skeletons.length).toBe(2);
    });

    it('isLoading=false renders kpi cards without skeleton', async () => {
      await create({ isLoading: false });
      const skeletons = fixture.debugElement.queryAll(By.css('.kpi-card.skeleton'));
      expect(skeletons.length).toBe(0);
      const cards = fixture.debugElement.queryAll(By.css('.kpi-card'));
      expect(cards.length).toBe(2);
    });
  });

  describe('ARIA labels', () => {
    it('entry count card has correct aria-label', async () => {
      await create({ selectedMonthEntryCount: 3 });
      expect(fixture.componentInstance.entryCountAriaLabel()).toBe('3 entries this month');
    });

    it('singular entry count in aria-label', async () => {
      await create({ selectedMonthEntryCount: 1 });
      expect(fixture.componentInstance.entryCountAriaLabel()).toBe('1 entry this month');
    });

    it('null delta aria-label says No average available yet', async () => {
      await create({ historicalMonthlyTotals: [{ month: SELECTED, total: 750, entryCount: 9 }] });
      expect(fixture.componentInstance.deltaAriaLabel()).toContain('No average available yet');
    });

    it('zero delta aria-label also says No average available yet', async () => {
      const avg = (850 + 1100 + 950 + 800 + 1050 + 900) / 6;
      await create({ selectedMonthTotal: avg });
      expect(fixture.componentInstance.deltaAriaLabel()).toContain('No average available yet');
    });
  });
});
