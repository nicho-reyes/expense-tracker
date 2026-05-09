import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { By } from '@angular/platform-browser';
import { SparklineChartComponent } from './sparkline-chart.component';
import { MonthlyTotal } from '../../../core/models/entry.model';

// Chart.js requires canvas.getContext('2d') which JSDOM doesn't support
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

const sampleTotals: MonthlyTotal[] = [
  { month: '2025-11', total: 850, entryCount: 12 },
  { month: '2025-12', total: 1100, entryCount: 18 },
  { month: '2026-01', total: 950, entryCount: 14 },
  { month: '2026-02', total: 800, entryCount: 11 },
  { month: '2026-03', total: 1050, entryCount: 16 },
  { month: '2026-04', total: 900, entryCount: 13 },
  { month: '2026-05', total: 750, entryCount: 9 },
];

describe('SparklineChartComponent', () => {
  let fixture: ComponentFixture<SparklineChartComponent>;

  async function create(
    data: MonthlyTotal[],
    selectedMonth: string,
    opts: { isLoading?: boolean; monthsToShow?: number } = {},
  ) {
    await TestBed.configureTestingModule({
      imports: [SparklineChartComponent],
      providers: [provideCharts(withDefaultRegisterables())],
    }).compileComponents();

    fixture = TestBed.createComponent(SparklineChartComponent);
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('selectedMonth', selectedMonth);
    if (opts.isLoading !== undefined) fixture.componentRef.setInput('isLoading', opts.isLoading);
    if (opts.monthsToShow !== undefined) fixture.componentRef.setInput('monthsToShow', opts.monthsToShow);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('default monthsToShow=7 produces 7 labels and 7 data points', async () => {
    await create(sampleTotals, '2026-05');
    const cd = fixture.componentInstance.chartData();
    expect(cd.labels?.length).toBe(7);
    expect(cd.datasets[0].data.length).toBe(7);
  });

  it('monthsToShow=12 produces 12 labels and 12 data points', async () => {
    const long: MonthlyTotal[] = Array.from({ length: 12 }, (_, i) => ({
      month: `2025-${String(i + 1).padStart(2, '0')}`,
      total: 100 * (i + 1),
      entryCount: i + 1,
    }));
    await create(long, '2025-12', { monthsToShow: 12 });
    const cd = fixture.componentInstance.chartData();
    expect(cd.labels?.length).toBe(12);
    expect(cd.datasets[0].data.length).toBe(12);
  });

  it('selected-month bar gets accent color; others get muted color', async () => {
    await create(sampleTotals, '2026-05');
    const cd = fixture.componentInstance.chartData();
    const bgColors = cd.datasets[0].backgroundColor as string[];
    expect(bgColors.length).toBe(7);

    const selectedIdx = sampleTotals.findIndex(m => m.month === '2026-05');
    const accentColor = bgColors[selectedIdx];
    const mutedColors = bgColors.filter((_, i) => i !== selectedIdx);

    expect(accentColor).not.toBe('');
    mutedColors.forEach(c => expect(c).toBe(mutedColors[0]));
    expect(accentColor).not.toBe(mutedColors[0]);
  });

  it('isLoading=true renders skeleton, hides canvas wrapper', async () => {
    await create(sampleTotals, '2026-05', { isLoading: true });
    fixture.detectChanges();

    const skeleton = fixture.debugElement.query(By.css('.skeleton'));
    const canvas = fixture.debugElement.query(By.css('.canvas-wrapper'));
    expect(skeleton).toBeTruthy();
    expect(canvas).toBeNull();
  });

  it('isLoading=true skeleton is aria-hidden and does not carry aria-busy', async () => {
    await create(sampleTotals, '2026-05', { isLoading: true });
    fixture.detectChanges();

    const skeleton = fixture.debugElement.query(By.css('.skeleton'));
    expect(skeleton.nativeElement.getAttribute('aria-hidden')).toBe('true');
    expect(skeleton.nativeElement.getAttribute('aria-busy')).toBeNull();
  });

  it('empty data renders 7 zero bars without throwing', async () => {
    await create([], '2026-05');
    const cd = fixture.componentInstance.chartData();
    expect(cd.datasets[0].data.length).toBe(0);
    expect(cd.labels?.length).toBe(0);
  });

  it('host aria-label matches "Last N months spending trend"', async () => {
    await create(sampleTotals, '2026-05');
    expect(fixture.componentInstance.ariaLabel()).toBe('Last 7 months spending trend');
  });

  it('host aria-label updates when monthsToShow changes', async () => {
    await create(sampleTotals, '2026-05', { monthsToShow: 12 });
    expect(fixture.componentInstance.ariaLabel()).toBe('Last 12 months spending trend');
  });

  it('chartData recomputes when selectedMonth changes (no remount)', async () => {
    await create(sampleTotals, '2026-05');
    const cdBefore = fixture.componentInstance.chartData();
    const accentBefore = (cdBefore.datasets[0].backgroundColor as string[])[6];

    fixture.componentRef.setInput('selectedMonth', '2026-04');
    const cdAfter = fixture.componentInstance.chartData();
    const accentAfter = (cdAfter.datasets[0].backgroundColor as string[])[5];
    const mutedAfter = (cdAfter.datasets[0].backgroundColor as string[])[6];

    expect(accentAfter).toBe(accentBefore);
    expect(mutedAfter).toBe((cdBefore.datasets[0].backgroundColor as string[])[0]);
  });

  it('srSummary marks selected month with (selected) suffix', async () => {
    await create(sampleTotals, '2026-05');
    const summary = fixture.componentInstance.srSummary();
    expect(summary).toContain('(selected)');
    const parts = summary.split(', ');
    const selectedPart = parts.find(p => p.includes('(selected)'));
    expect(selectedPart).toContain('May');
  });
});
