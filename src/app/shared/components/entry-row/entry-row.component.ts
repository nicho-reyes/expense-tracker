import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LocalEntry } from '../../../core/models/entry.model';
import { Category } from '../../../core/models/category.model';

const CHF_FORMATTER = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

@Component({
  selector: 'app-entry-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './entry-row.component.html',
  styleUrl: './entry-row.component.scss',
})
export class EntryRowComponent {
  readonly entry = input.required<LocalEntry>();
  readonly category = input<Category | null>(null);
  readonly tap = output<{ entry: LocalEntry; rowElement: HTMLElement }>();

  readonly displayAmount = computed(() => {
    const amt = this.entry().amount;
    if (amt < 0) {
      return { text: '+' + CHF_FORMATTER.format(-amt), cssClass: 'text-green-600 font-medium' };
    }
    return { text: CHF_FORMATTER.format(amt), cssClass: 'text-zinc-900 dark:text-zinc-100' };
  });

  readonly dateChip = computed(() => this.entry().date.slice(8, 10) + '.' + this.entry().date.slice(5, 7));

  readonly isPending = computed(() => this.entry().syncStatus === 'pending');
  readonly isErrored = computed(() => this.entry().syncStatus === 'error');

  onClick(event: MouseEvent): void {
    this.tap.emit({ entry: this.entry(), rowElement: event.currentTarget as HTMLElement });
  }
}
