import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-entry-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<ng-content />`,
})
export class UentryUrowComponent {}
