import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<ng-content />`,
})
export class UbottomUnavComponent {}
