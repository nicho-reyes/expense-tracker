import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-category-breakdown-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<ng-content />`,
})
export class UcategoryUbreakdownUbarComponent {}
