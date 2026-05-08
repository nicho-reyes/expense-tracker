import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-category-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<ng-content />`,
})
export class UcategoryUtileComponent {}
