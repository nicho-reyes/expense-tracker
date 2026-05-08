import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-amount-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<ng-content />`,
})
export class UamountUinputComponent {}
