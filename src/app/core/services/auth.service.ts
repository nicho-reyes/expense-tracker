import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, EMPTY, from, map, catchError, finalize } from 'rxjs';
import { Router } from '@angular/router';
import { NotificationService } from './notification.service';
import { SyncQueueService } from './sync-queue.service';
import { ConfigService } from './config.service';
import { IdbService, PersistedAuth } from './idb.service';
import { environment } from '../../../environments/environment';
import type { GisClientConfigError, GisTokenClient, GisTokenResponse } from '../models/gis.types';

export interface AuthUser {
  accessToken: string;
  expiresAt: number;
}

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SILENT_REFRESH_TIMEOUT_MS = 10_000;
const SESSION_EXPIRY_KEY = 'auth_session_expiry'; // legacy — scheduled for removal after one release
const AUTH_KEY = 'auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly syncQueue = inject(SyncQueueService);
  private readonly config = inject(ConfigService);
  private readonly idb = inject(IdbService);

  private readonly _user = signal<AuthUser | null>(null);
  private tokenClient: GisTokenClient | null = null;
  private _loadGisScriptPromise: Promise<void> | null = null;

  private _isSignInContext = false;
  private _pendingCallbacks: { resolve: () => void; reject: (err: Error) => void } | null = null;
  private _refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private _isRefreshInProgress = false;

  readonly isAuthenticated = computed(
    () => !!this._user() && this._user()!.expiresAt > Date.now(),
  );

  readonly isReauthPending = signal(false);

  async init(): Promise<void> {
    try {
      if (!this.config.googleClientId) return;

      // Legacy cleanup — older installs wrote expiry to sessionStorage
      sessionStorage.removeItem(SESSION_EXPIRY_KEY);

      const persisted = await this.readPersistedAuth();

      // Path A: persisted token still valid — restore in memory, schedule refresh, done
      if (persisted && persisted.expiresAt > Date.now()) {
        this._user.set({ accessToken: persisted.accessToken, expiresAt: persisted.expiresAt });
        await this.loadGisScript();
        this.setupTokenClient();
        this.scheduleTokenRefresh(persisted.expiresAt);
        return;
      }

      // Path B: no persisted token, OR expired well-formed token — purge if expired, try silent re-auth
      // Malformed records are already purged inside readPersistedAuth() before it returns null.
      if (persisted) {
        await this.idb.delete('appMeta', AUTH_KEY);
      }
      await this.loadGisScript();
      this.setupTokenClient();
      await this.attemptBootSilentReauth();
    } catch {
      // init() must never reject — auth failure handled by authGuard redirecting to /auth
    }
  }

  async signIn(): Promise<void> {
    if (!this.config.googleClientId) {
      throw new Error('Google Client ID is not configured.');
    }
    if (!this.tokenClient) {
      await this.loadGisScript();
      this.setupTokenClient();
    }
    // Abort any in-flight silent refresh to free the _pendingCallbacks slot
    if (this._pendingCallbacks) {
      this._pendingCallbacks.resolve();
      this._pendingCallbacks = null;
    }
    this._isSignInContext = true;
    await this.requestToken({ prompt: 'consent' });
  }

  signOut(): void {
    if (this._refreshTimerId !== null) {
      clearTimeout(this._refreshTimerId);
      this._refreshTimerId = null;
    }
    this._user.set(null);
    this.isReauthPending.set(false);
    this.idb.delete('appMeta', AUTH_KEY).catch(() => {});
    sessionStorage.removeItem(SESSION_EXPIRY_KEY); // legacy cleanup
    this.router.navigate(['/auth']);
  }

  getAccessToken(): string | null {
    const user = this._user();
    if (!user || user.expiresAt <= Date.now()) return null;
    return user.accessToken;
  }

  handleUnauthorized(): Observable<string> {
    if (this._isRefreshInProgress) {
      return EMPTY;
    }
    this._isRefreshInProgress = true;
    this.isReauthPending.set(true);

    return from(this.attemptSilentRefresh()).pipe(
      map(() => {
        const token = this.getAccessToken();
        if (!token) throw new Error('Silent refresh produced no token');
        return token;
      }),
      catchError(() => {
        this.notification.showError({ type: 'AUTH_REVOKED' }, 'Sign in');
        this.isReauthPending.set(false);
        this.router.navigate(['/auth']);
        return EMPTY;
      }),
      finalize(() => {
        this._isRefreshInProgress = false;
      }),
    );
  }

  private scheduleTokenRefresh(expiresAt: number): void {
    if (this._refreshTimerId !== null) {
      clearTimeout(this._refreshTimerId);
    }
    const delay = expiresAt - Date.now() - 5 * 60 * 1000;
    if (delay <= 0) {
      this.triggerProactiveRefresh();
      return;
    }
    this._refreshTimerId = setTimeout(() => {
      this._refreshTimerId = null;
      this.triggerProactiveRefresh();
    }, delay);
  }

  private triggerProactiveRefresh(): void {
    if (this._isRefreshInProgress) return;
    this.attemptSilentRefresh().then(() => {
      if (!this.isAuthenticated()) {
        this.isReauthPending.set(true);
        this.router.navigate(['/auth']);
      }
    }).catch(() => {
      this.isReauthPending.set(true);
      this.router.navigate(['/auth']);
    });
  }

  private loadGisScript(): Promise<void> {
    if (this._loadGisScriptPromise) return this._loadGisScriptPromise;
    this._loadGisScriptPromise = new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${environment.gisScriptUrl}"]`,
      );
      if (existing) {
        // Script tag exists — check if it already finished loading
        if (window.google?.accounts?.oauth2) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('GIS script failed to load')),
          { once: true },
        );
        return;
      }
      const script = document.createElement('script');
      script.src = environment.gisScriptUrl;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('GIS script failed to load'));
      document.head.appendChild(script);
    });
    return this._loadGisScriptPromise;
  }

  private setupTokenClient(): void {
    if (!window.google?.accounts?.oauth2?.initTokenClient) {
      throw new Error('GIS OAuth2 API unavailable after script load');
    }
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.config.googleClientId,
      scope: SHEETS_SCOPE,
      callback: (response: GisTokenResponse) => this.handleTokenResponse(response),
      error_callback: (error: GisClientConfigError) => this.handleErrorCallback(error),
    });
  }

  private async readPersistedAuth(): Promise<PersistedAuth | null> {
    const raw = await this.idb.get<PersistedAuth>('appMeta', AUTH_KEY);
    if (!raw) return null;
    if (typeof raw.accessToken !== 'string' || raw.accessToken.length === 0) {
      await this.idb.delete('appMeta', AUTH_KEY);
      return null;
    }
    if (typeof raw.expiresAt !== 'number' || !Number.isFinite(raw.expiresAt) || raw.expiresAt <= 0) {
      await this.idb.delete('appMeta', AUTH_KEY);
      return null;
    }
    return raw;
  }

  private async attemptBootSilentReauth(): Promise<void> {
    if (this._isRefreshInProgress) return;
    this._isRefreshInProgress = true;
    try {
      await this.attemptSilentRefresh();
      if (!this.isAuthenticated()) {
        this.notification.showError({
          type: 'AUTH_SILENT_REAUTH_FAILED',
          reason: 'no-google-session',
          message: 'Your session has expired. Your data is safely stored — sign in to resume syncing.',
        });
        await this.idb.delete('appMeta', AUTH_KEY);
        this.isReauthPending.set(true);
        this.router.navigate(['/auth']);
      }
    } catch {
      this.notification.showError({
        type: 'AUTH_SILENT_REAUTH_FAILED',
        reason: 'unknown',
        message: 'Your session has expired. Your data is safely stored — sign in to resume syncing.',
      });
      await this.idb.delete('appMeta', AUTH_KEY);
      this.isReauthPending.set(true);
      this.router.navigate(['/auth']);
    } finally {
      this._isRefreshInProgress = false;
    }
  }

  private attemptSilentRefresh(): Promise<void> {
    const client = this.tokenClient;
    if (!client) return Promise.resolve();
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this._pendingCallbacks = null;
        resolve();
      }, SILENT_REFRESH_TIMEOUT_MS);

      // reject is intentionally wired to resolve — silent refresh never fails the boot chain
      this._pendingCallbacks = {
        resolve: () => { clearTimeout(timeoutId); resolve(); },
        reject: () => { clearTimeout(timeoutId); resolve(); },
      };

      this._isSignInContext = false;
      client.requestAccessToken({ prompt: '' });
    });
  }

  private requestToken(options: { prompt?: string }): Promise<void> {
    const client = this.tokenClient;
    if (!client) {
      return Promise.reject(new Error('Token client not initialized'));
    }
    return new Promise((resolve, reject) => {
      this._pendingCallbacks = { resolve, reject };
      client.requestAccessToken(options);
    });
  }

  private handleTokenResponse(response: GisTokenResponse): void {
    const callbacks = this._pendingCallbacks;
    const wasSignInContext = this._isSignInContext;
    this._pendingCallbacks = null;
    this._isSignInContext = false;

    if (response.error) {
      if (wasSignInContext) {
        this.notification.showError({ type: 'AUTH_DENIED' });
        sessionStorage.removeItem(SESSION_EXPIRY_KEY);
        callbacks?.reject(new Error('Sheets access is required to use this app.'));
      } else {
        callbacks?.resolve();
      }
      return;
    }

    const exp = parseInt(response.expires_in, 10);
    if (!isFinite(exp) || exp <= 0) {
      callbacks?.reject(new Error('Invalid token expiry in Google response'));
      return;
    }
    if (!response.access_token) {
      callbacks?.reject(new Error('Missing access token in Google response'));
      return;
    }

    const expiresAt = Date.now() + exp * 1000;
    const wasReauthPending = this.isReauthPending();

    this._user.set({ accessToken: response.access_token, expiresAt });
    // Fire-and-forget — IDB write must not block the token callback path
    const persisted: PersistedAuth = { accessToken: response.access_token, expiresAt };
    this.idb.set<PersistedAuth>('appMeta', AUTH_KEY, persisted).catch((err) => {
      this.notification.showError({
        type: 'IDB_ERROR',
        message: err instanceof Error ? err.message : 'Failed to persist auth token',
      });
    });

    this.scheduleTokenRefresh(expiresAt);

    if (wasReauthPending) {
      this.isReauthPending.set(false);
      this.syncQueue.retryAll().catch(() => {});
    }

    if (wasSignInContext) {
      this.router.navigate(['/']).catch(() => {});
    }

    callbacks?.resolve();
  }

  private handleErrorCallback(error: GisClientConfigError): void {
    const callbacks = this._pendingCallbacks;
    const wasSignInContext = this._isSignInContext;
    this._pendingCallbacks = null;
    this._isSignInContext = false;

    if (!wasSignInContext) {
      // Silent refresh failure — resolve quietly, not a boot error
      callbacks?.resolve();
      return;
    }

    let message: string;
    if (error.type === 'popup_closed') {
      this.notification.showError({ type: 'AUTH_DENIED' });
      message = 'Sheets access is required to use this app.';
    } else if (error.type === 'popup_failed_to_open') {
      this.notification.showError({ type: 'NETWORK', message: 'Please allow popups for this site.' });
      message = 'Please allow popups for this site.';
    } else {
      this.notification.showError({
        type: 'NETWORK',
        message: 'Network error during sign-in. Check your connection and try again.',
      });
      message = 'Network error during sign-in. Check your connection and try again.';
    }

    callbacks?.reject(new Error(message));
  }
}
