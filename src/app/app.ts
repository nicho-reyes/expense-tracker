import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatFabButton, MatButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.component';
import { SyncStatusBarComponent } from './shared/components/sync-status-bar/sync-status-bar.component';
import { CategoriesService } from './core/services/categories.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BottomNavComponent, SyncStatusBarComponent, MatFabButton, MatButton, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly fabVisible = signal(true);
  readonly isDark = signal(false);
  protected readonly categoriesService = inject(CategoriesService);

  async onRetryCategories(): Promise<void> {
    await this.categoriesService.retry();
  }

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
