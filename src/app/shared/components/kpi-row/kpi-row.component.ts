import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ChfCurrencyPipe } from '../../pipes/chf-currency.pipe';
import { MonthlyTotal } from '../../../core/models/entry.model';

@Component({
  selector: 'app-kpi-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, ChfCurrencyPipe],
  templateUrl: './kpi-row.component.html',
  styleUrl: './kpi-row.component.scss',
})
export class KpiRowComponent {
  readonly selectedMonthTotal = input.required<number>();
  readonly historicalMonthlyTotals = input.required<MonthlyTotal[]>();
  readonly selectedMonth = input.required<string>();
  readonly selectedMonthEntryCount = input.required<number>();
  readonly isLoading = input(false);

  private readonly chfPipe = new ChfCurrencyPipe();

  readonly averageMonthlyTotal = computed<number | null>(() => {
    const others = this.historicalMonthlyTotals().filter(
      t => t.month !== this.selectedMonth() && t.entryCount > 0,
    );
    if (others.length < 2) return null;
    return others.reduce((sum, t) => sum + t.total, 0) / others.length;
  });

  readonly delta = computed<number | null>(() => {
    const avg = this.averageMonthlyTotal();
    if (avg === null) return null;
    return this.selectedMonthTotal() - avg;
  });

  readonly deltaClass = computed(() => {
    const d = this.delta();
    if (d === null) return 'muted';
    if (d > 0) return 'over';
    if (d < 0) return 'under';
    return 'flat';
  });

  readonly deltaAriaLabel = computed(() => {
    const d = this.delta();
    if (d === null || d === 0) return 'vs-average delta: No average available yet';
    const sign = d >= 0 ? '+' : '';
    return `vs-average delta: ${sign}${this.chfPipe.transform(d)}`;
  });

  readonly entryCountLabel = computed(() => {
    const n = this.selectedMonthEntryCount();
    return n === 1 ? '1 entry' : `${n} entries`;
  });

  readonly entryCountAriaLabel = computed(() => `${this.entryCountLabel()} this month`);
}
