import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { CategoryManagerComponent } from './category-manager/category-manager.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSlideToggleModule, MatDividerModule, CategoryManagerComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  isDark = signal(localStorage.getItem('theme') === 'dark');

  toggleTheme(): void {
    const newIsDark = !this.isDark();
    this.isDark.set(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('theme', 'light');
    }
  }
}
