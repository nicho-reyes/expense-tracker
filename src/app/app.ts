import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatFabButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.component';
import { SyncStatusBarComponent } from './shared/components/sync-status-bar/sync-status-bar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BottomNavComponent, SyncStatusBarComponent, MatFabButton, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly fabVisible = signal(true);
  readonly isDark = signal(false);

  ngOnInit(): void {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      this.isDark.set(true);
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }
}
