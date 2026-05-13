import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Category } from '../../core/models/category.model';
import { LocalEntry } from '../../core/models/entry.model';
import { ChfCurrencyPipe } from '../../shared/pipes/chf-currency.pipe';

export interface DrilldownData {
  category: Category;
  entries: LocalEntry[];
  month: string | null;
  year: number;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

@Component({
  selector: 'app-category-drilldown-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatDividerModule, ChfCurrencyPipe],
  template: `
    <div class="flex flex-col max-h-[80dvh]">

      <!-- Header -->
      <div class="flex items-center gap-3 px-4 pt-4 pb-3">
        <span class="w-3 h-3 rounded-full shrink-0"
              [style.background-color]="'var(--color-' + data.category.id + ')'"></span>
        <div class="flex-1 min-w-0">
          <h2 class="font-semibold text-base leading-tight">{{ data.category.name }}</h2>
          <p class="text-xs text-zinc-500 mt-0.5">
            {{ subtitle }} &bull; {{ data.entries.length }} {{ data.entries.length === 1 ? 'entry' : 'entries' }}
          </p>
        </div>
        <span class="font-semibold tabular-nums">{{ total | chfCurrency }}</span>
        <button mat-icon-button (click)="close()" aria-label="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-divider />

      <!-- Entry list -->
      <div class="flex-1 overflow-y-auto">
        @if (sortedEntries.length === 0) {
          <p class="text-sm text-zinc-500 text-center py-8">No entries</p>
        }
        @for (entry of sortedEntries; track entry.id) {
          <div class="flex items-start gap-3 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
            <span class="text-xs text-zinc-400 w-14 shrink-0 pt-0.5">{{ formatDate(entry.date) }}</span>
            <span class="flex-1 min-w-0 text-sm">
              {{ entry.remarks || '—' }}
            </span>
            <span class="text-sm tabular-nums shrink-0"
                  [class.text-red-600]="entry.amount < 0"
                  [class.text-zinc-800]="entry.amount >= 0"
                  [class.dark:text-zinc-200]="entry.amount >= 0">
              {{ entry.amount | chfCurrency }}
            </span>
          </div>
        }
      </div>

    </div>
  `,
})
export class CategoryDrilldownSheetComponent {
  readonly data = inject<DrilldownData>(MAT_BOTTOM_SHEET_DATA);
  private readonly sheetRef = inject(MatBottomSheetRef);

  get subtitle(): string {
    if (this.data.month) {
      const monthIndex = parseInt(this.data.month.split('-')[1]) - 1;
      return `${MONTH_NAMES[monthIndex]} ${this.data.year}`;
    }
    return String(this.data.year);
  }

  get total(): number {
    return this.data.entries.reduce((s, e) => s + e.amount, 0);
  }

  get sortedEntries(): LocalEntry[] {
    return [...this.data.entries].sort((a, b) => b.date.localeCompare(a.date));
  }

  formatDate(date: string): string {
    const [, m, d] = date.split('-');
    const monthAbbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d)} ${monthAbbr[parseInt(m) - 1]}`;
  }

  close(): void {
    this.sheetRef.dismiss();
  }
}
