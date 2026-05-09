import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { MonthlyTotal } from '../../../core/models/entry.model';
import { getCssVar } from '../../utils/theme-token';
import { formatShortMonth } from '../../utils/month.util';

@Component({
  selector: 'app-sparkline-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseChartDirective],
  host: { '[attr.aria-label]': 'ariaLabel()' },
  templateUrl: './sparkline-chart.component.html',
  styleUrl: './sparkline-chart.component.scss',
})
export class SparklineChartComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly data = input.required<MonthlyTotal[]>();
  readonly selectedMonth = input.required<string>();
  readonly isLoading = input(false);
  readonly monthsToShow = input(7);

  private readonly themeVersion = signal(0);

  readonly chartData = computed<ChartData<'bar'>>(() => {
    this.themeVersion();
    const items = this.data().slice(-this.monthsToShow());
    const accent = getCssVar('--color-accent') || '#6366f1';
    const muted = getCssVar('--color-muted') || '#d4d4d8';
    return {
      labels: items.map(m => formatShortMonth(m.month)),
      datasets: [
        {
          data: items.map(m => m.total),
          backgroundColor: items.map(m =>
            m.month === this.selectedMonth() ? accent : muted,
          ),
          borderRadius: 2,
          barPercentage: 0.6,
        },
      ],
    };
  });

  readonly chartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
    animation: false,
  };

  readonly ariaLabel = computed(() => `Last ${this.monthsToShow()} months spending trend`);

  readonly srSummary = computed(() =>
    this.data()
      .slice(-this.monthsToShow())
      .map(m => {
        const label = formatShortMonth(m.month);
        const selected = m.month === this.selectedMonth() ? ' (selected)' : '';
        return `${label} CHF ${m.total.toFixed(2)}${selected}`;
      })
      .join(', '),
  );

  ngOnInit(): void {
    // Option B: MutationObserver on <html> class attribute (no ThemeService dependency)
    const observer = new MutationObserver(() => {
      this.themeVersion.update(v => v + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
