import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMonthLabel } from '../../utils/month.util';

@Component({
  selector: 'app-hero-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-card.component.html',
  styleUrl: './hero-card.component.scss',
})
export class HeroCardComponent {
  readonly total = input.required<number>();
  readonly month = input.required<string>();
  readonly isLoading = input<boolean>(false);

  private readonly chfFormatter = new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  });

  readonly displayTotal = computed(() => this.chfFormatter.format(this.total()));
  readonly displayMonth = computed(() => formatMonthLabel(this.month()));
}
