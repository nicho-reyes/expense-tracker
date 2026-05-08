import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'chfCurrency', standalone: true })
export class ChfCurrencyPipe implements PipeTransform {
  transform(value: number): string {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(value);
  }
}
