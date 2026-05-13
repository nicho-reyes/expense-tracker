import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LocalEntry } from '../../../core/models/entry.model';
import { Category, slugifyCategoryId } from '../../../core/models/category.model';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MatrixRow {
  category: Category;
  values: number[];
  total: number;
}

export interface ExclusionSet {
  label: string;
  excludeIds: string[];
}

@Component({
  selector: 'app-spending-matrix',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spending-matrix.component.html',
})
export class SpendingMatrixComponent {
  readonly entries = input.required<LocalEntry[]>();
  readonly categories = input.required<Category[]>();
  readonly year = input.required<number>();
  readonly exclusionSets = input<ExclusionSet[]>([]);

  readonly categoryClick = output<{ categoryId: string; month: string | null }>();

  readonly months = computed(() => {
    const y = this.year();
    const result: string[] = [];
    for (let m = 1; m <= 12; m++) {
      result.push(`${y}-${String(m).padStart(2, '0')}`);
    }
    return result;
  });

  readonly monthLabels = computed(() =>
    this.months().map(m => MONTH_LABELS[parseInt(m.split('-')[1]) - 1])
  );

  readonly rows = computed((): MatrixRow[] => {
    const months = this.months();
    const monthSet = new Set(months);
    const totalsMap = new Map<string, Map<string, number>>();

    for (const e of this.entries()) {
      if (!monthSet.has(e.month)) continue;
      const key = slugifyCategoryId(e.category);
      if (!totalsMap.has(key)) totalsMap.set(key, new Map());
      const m = totalsMap.get(key)!;
      m.set(e.month, (m.get(e.month) ?? 0) + e.amount);
    }

    return this.categories()
      .map(cat => {
        const monthMap = totalsMap.get(cat.id) ?? new Map();
        const values = months.map(m => monthMap.get(m) ?? 0);
        const total = values.reduce((s, v) => s + v, 0);
        return { category: cat, values, total };
      })
      .sort((a, b) => a.category.name.localeCompare(b.category.name));
  });

  readonly columnTotals = computed(() => {
    const rows = this.rows();
    return this.months().map((_, i) => rows.reduce((s, r) => s + r.values[i], 0));
  });

  readonly grandTotal = computed(() =>
    this.columnTotals().reduce((s, v) => s + v, 0)
  );

  readonly exclusionTotals = computed(() => {
    const rows = this.rows();
    return this.exclusionSets().map(set => {
      const excluded = new Set(set.excludeIds);
      const activeRows = rows.filter(r => !excluded.has(r.category.id));
      const monthTotals = this.months().map((_, i) =>
        activeRows.reduce((s, r) => s + r.values[i], 0)
      );
      const total = monthTotals.reduce((s, v) => s + v, 0);
      return { label: set.label, monthTotals, total };
    });
  });

  fmt(n: number): string {
    if (n === 0) return '—';
    return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  fmtTotal(n: number): string {
    return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }
}
