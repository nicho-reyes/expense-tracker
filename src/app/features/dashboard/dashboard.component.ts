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
import { CategoriesService } from '../../core/services/categories.service';
import { SpendingMatrixComponent, ExclusionSet } from '../../shared/components/spending-matrix/spending-matrix.component';
import { ChfCurrencyPipe } from '../../shared/pipes/chf-currency.pipe';
import { CategoryDrilldownSheetComponent } from './category-drilldown-sheet.component';
import { slugifyCategoryId } from '../../core/models/category.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, SpendingMatrixComponent, ChfCurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly entriesSvc = inject(EntriesService);
  readonly categoriesSvc = inject(CategoriesService);

  @ViewChild('fabRef', { static: true }) fabRef!: ElementRef<HTMLButtonElement>;

  readonly sheetOpen = signal(false);
  readonly currentYear = new Date().getFullYear();

  readonly matrixExclusions: ExclusionSet[] = [
    { label: 'Excl. Taxes & Contributions', excludeIds: ['taxes', 'contributions'] },
    { label: 'Excl. Taxes, Contributions & Investment', excludeIds: ['taxes', 'contributions', 'investment'] },
  ];

  private readonly todayIso = new Date().toISOString().slice(0, 10);
  private readonly currentMonthIso = this.todayIso.slice(0, 7);

  readonly todayTotal = computed(() =>
    this.entriesSvc.entries()
      .filter(e => e.date === this.todayIso)
      .reduce((s, e) => s + e.amount, 0)
  );

  readonly monthTotal = computed(() =>
    this.entriesSvc.entries()
      .filter(e => e.month === this.currentMonthIso)
      .reduce((s, e) => s + e.amount, 0)
  );

  readonly yearTotal = computed(() =>
    this.entriesSvc.entries()
      .filter(e => e.year === this.currentYear)
      .reduce((s, e) => s + e.amount, 0)
  );

  readonly allTimeTotal = computed(() =>
    this.entriesSvc.entries().reduce((s, e) => s + e.amount, 0)
  );

  readonly yearEntries = computed(() =>
    this.entriesSvc.entries().filter(e => e.year === this.currentYear)
  );

  onCategoryDrilldown(event: { categoryId: string; month: string | null }): void {
    const category = this.categoriesSvc.categories().find(c => c.id === event.categoryId);
    if (!category) return;

    const entries = this.entriesSvc.entries().filter(e => {
      const key = slugifyCategoryId(e.category);
      if (key !== event.categoryId) return false;
      if (event.month) return e.month === event.month;
      return e.year === this.currentYear;
    });

    this.bottomSheet.open(CategoryDrilldownSheetComponent, {
      data: { category, entries, month: event.month, year: this.currentYear },
      panelClass: 'drilldown-sheet',
    });
  }

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
}
