import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<ng-content />`,
})
export class UofflineUindicatorComponent {}
