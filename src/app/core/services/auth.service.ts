import { Injectable, signal, Signal } from '@angular/core';

export interface AuthUser {
  accessToken: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated: Signal<boolean> = signal(false);
  readonly user: Signal<AuthUser | null> = signal(null);

  async init(): Promise<void> {
    // Implemented in Story 1.2
  }

  async signIn(): Promise<void> {
    throw new Error('Not implemented — Story 1.2');
  }

  async signOut(): Promise<void> {
    throw new Error('Not implemented — Story 1.2');
  }

  getAccessToken(): string | null {
    return null;
  }
}
