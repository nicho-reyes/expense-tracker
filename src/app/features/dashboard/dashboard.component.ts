import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { QuickAddSheetComponent } from '../entry-form/entry-form.component';
import { EntriesService } from '../../core/services/entries.service';
import { HeroCardComponent } from '../../shared/components/hero-card/hero-card.component';
import { SparklineChartComponent } from '../../shared/components/sparkline-chart/sparkline-chart.component';
import { KpiRowComponent } from '../../shared/components/kpi-row/kpi-row.component';
import { addMonths, currentMonthIso, formatMonthLabel } from '../../shared/utils/month.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, HeroCardComponent, SparklineChartComponent, KpiRowComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly entriesSvc = inject(EntriesService);

  @ViewChild('fabRef', { static: true }) fabRef!: ElementRef<HTMLButtonElement>;

  readonly sheetOpen = signal(false);
  readonly selectedMonth = signal<string>(currentMonthIso());

  readonly entriesForMonth = computed(() =>
    this.entriesSvc.entries().filter(e => e.month === this.selectedMonth()),
  );

  readonly monthTotal = computed(() =>
    this.entriesForMonth().reduce((sum, e) => sum + e.amount, 0),
  );

  readonly monthlyTotals = computed(() => this.entriesSvc.monthlyTotals());

  readonly selectedMonthEntryCount = computed(() => this.entriesForMonth().length);

  readonly isLoading = computed(() => !this.entriesSvc.isInitialized());

  readonly canGoNext = computed(() => this.selectedMonth() < currentMonthIso());

  readonly formatMonthLabel = formatMonthLabel;

  onOpenQuickAdd(): void {
    this.sheetOpen.set(true);
    const ref = this.bottomSheet.open(QuickAddSheetComponent, {
      autoFocus: false,
      panelClass: 'quick-add-sheet',
    });
    ref.afterDismissed().subscribe(() => {
      this.sheetOpen.set(false);
      this.fabRef.nativeElement.focus();
    });
  }

  onPrevMonth(): void {
    this.selectedMonth.update(m => addMonths(m, -1));
  }

  onNextMonth(): void {
    if (!this.canGoNext()) return;
    this.selectedMonth.update(m => addMonths(m, 1));
  }
}
