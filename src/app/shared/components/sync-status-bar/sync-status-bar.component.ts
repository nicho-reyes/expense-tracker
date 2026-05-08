import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-sync-status-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './sync-status-bar.component.html',
  styleUrl: './sync-status-bar.component.scss',
})
export class SyncStatusBarComponent {}
