import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isReauthMode = this.auth.isReauthPending;

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  async onSignIn(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.signIn();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
