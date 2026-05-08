import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-sync-status-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `<ng-content />`,
})
export class UsyncUstatusUbarComponent {}
