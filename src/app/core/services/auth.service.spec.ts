import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { SyncQueueService } from './sync-queue.service';

// Mock GIS window.google
function setupGisMock(options: {
  callbackWithToken?: boolean;
  callbackWithError?: boolean;
  silentFails?: boolean;
  errorType?: 'popup_closed' | 'popup_failed_to_open' | 'unknown';
} = {}) {
  let storedCallback: ((r: any) => void) | undefined;
  let storedErrorCallback: ((e: any) => void) | undefined;

  const tokenClientMock = {
    requestAccessToken: vi.fn(({ prompt }: { prompt?: string }) => {
      if (options.silentFails && prompt === '') {
        // Simulate GIS not calling back at all (timeout path)
        return;
      }
      if (options.callbackWithError && storedErrorCallback) {
        storedErrorCallback({ type: options.errorType ?? 'popup_closed' });
        return;
      }
      if (storedCallback) {
        if (options.callbackWithToken === false) {
          storedCallback({ error: 'access_denied' });
        } else {
          storedCallback({
            access_token: 'test-token-abc',
            expires_in: '3600',
            token_type: 'Bearer',
            scope: 'https://www.googleapis.com/auth/spreadsheets',
          });
        }
      }
    }),
  };

  const googleMock = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn((config: any) => {
          storedCallback = config.callback;
          storedErrorCallback = config.error_callback;
          return tokenClientMock;
        }),
        revoke: vi.fn(),
      },
    },
  };

  Object.defineProperty(window, 'google', { value: googleMock, writable: true });
  return { tokenClientMock, googleMock };
}

function clearGisMock() {
  Object.defineProperty(window, 'google', { value: undefined, writable: true });
}

describe('AuthService', () => {
  let service: AuthService;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let notificationSpy: { showError: ReturnType<typeof vi.fn>; showSuccess: ReturnType<typeof vi.fn>; showInfo: ReturnType<typeof vi.fn> };
  let syncQueueSpy: { retryAll: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    notificationSpy = {
      showError: vi.fn(),
      showSuccess: vi.fn(),
      showInfo: vi.fn(),
    };
    syncQueueSpy = { retryAll: vi.fn().mockResolvedValue(undefined) };

    // Stub environment with a googleClientId
    vi.stubGlobal('environment', undefined);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: SyncQueueService, useValue: syncQueueSpy },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    clearGisMock();
    sessionStorage.removeItem('auth_session_expiry');
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('isAuthenticated is false initially', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('getAccessToken returns null initially', () => {
      expect(service.getAccessToken()).toBeNull();
    });

    it('isReauthPending is false initially', () => {
      expect(service.isReauthPending()).toBe(false);
    });
  });

  describe('init()', () => {
    it('resolves (does not reject) when googleClientId is empty', async () => {
      // environment.googleClientId is '' by default from environment.ts stub
      await expect(service.init()).resolves.toBeUndefined();
    });

    it('resolves (does not reject) when GIS script fails to load', async () => {
      const loadSpy = vi.spyOn(service as any, 'loadGisScript').mockRejectedValue(new Error('load failed'));
      await expect(service.init()).resolves.toBeUndefined();
      loadSpy.mockRestore();
    });

    it('resolves (does not reject) when silent refresh times out', async () => {
      setupGisMock({ silentFails: true });
      const loadSpy = vi.spyOn(service as any, 'loadGisScript').mockResolvedValue(undefined);

      // Use fake timers to advance past the 10s timeout
      vi.useFakeTimers();
      const initPromise = service.init();
      vi.advanceTimersByTime(11_000);
      await expect(initPromise).resolves.toBeUndefined();
      vi.useRealTimers();
      loadSpy.mockRestore();
    });
  });

  describe('getAccessToken()', () => {
    it('returns null when expiresAt is in the past', () => {
      (service as any)._user.set({ accessToken: 'stale-token', expiresAt: Date.now() - 1000 });
      expect(service.getAccessToken()).toBeNull();
    });

    it('returns the token when expiresAt is in the future', () => {
      (service as any)._user.set({ accessToken: 'valid-token', expiresAt: Date.now() + 60_000 });
      expect(service.getAccessToken()).toBe('valid-token');
    });
  });

  describe('isAuthenticated signal', () => {
    it('is false when _user is null', () => {
      (service as any)._user.set(null);
      expect(service.isAuthenticated()).toBe(false);
    });

    it('is false when token is expired even if _user is set', () => {
      (service as any)._user.set({ accessToken: 'expired', expiresAt: Date.now() - 1 });
      expect(service.isAuthenticated()).toBe(false);
    });

    it('is true when _user is set with a future expiresAt', () => {
      (service as any)._user.set({ accessToken: 'valid', expiresAt: Date.now() + 3600_000 });
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('signOut()', () => {
    it('clears user, removes session expiry, and navigates to /auth', () => {
      (service as any)._user.set({ accessToken: 'token', expiresAt: Date.now() + 60_000 });
      sessionStorage.setItem('auth_session_expiry', String(Date.now() + 60_000));
      service.signOut();
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem('auth_session_expiry')).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth']);
    });

    it('clears the refresh timer on signOut', () => {
      vi.useFakeTimers();
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
      const timerId = setTimeout(() => {}, 100_000);
      (service as any)._refreshTimerId = timerId;
      service.signOut();
      expect(clearSpy).toHaveBeenCalledWith(timerId);
      expect((service as any)._refreshTimerId).toBeNull();
      vi.useRealTimers();
    });

    it('resets isReauthPending to false on signOut', () => {
      service.isReauthPending.set(true);
      service.signOut();
      expect(service.isReauthPending()).toBe(false);
    });
  });

  describe('handleErrorCallback()', () => {
    it('emits AUTH_DENIED AppError notification on popup_closed when in signIn context', () => {
      (service as any)._isSignInContext = true;
      (service as any).handleErrorCallback({ type: 'popup_closed' });
      expect(notificationSpy.showError).toHaveBeenCalledWith({ type: 'AUTH_DENIED' });
    });

    it('emits NETWORK AppError notification with popup message on popup_failed_to_open', () => {
      (service as any)._isSignInContext = true;
      (service as any).handleErrorCallback({ type: 'popup_failed_to_open' });
      expect(notificationSpy.showError).toHaveBeenCalledWith({
        type: 'NETWORK',
        message: expect.stringContaining('popups'),
      });
    });

    it('emits NETWORK AppError notification on unknown error type when in signIn context', () => {
      (service as any)._isSignInContext = true;
      (service as any).handleErrorCallback({ type: 'unknown', message: 'network timeout' });
      expect(notificationSpy.showError).toHaveBeenCalledWith({
        type: 'NETWORK',
        message: expect.stringContaining('Network error'),
      });
    });

    it('does not emit notification when not in signIn context (silent refresh failure)', () => {
      (service as any)._isSignInContext = false;
      (service as any).handleErrorCallback({ type: 'popup_closed' });
      expect(notificationSpy.showError).not.toHaveBeenCalled();
    });
  });

  describe('scheduleTokenRefresh()', () => {
    it('schedules a setTimeout for the computed delay', () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour from now
      (service as any).scheduleTokenRefresh(expiresAt);
      expect(setTimeoutSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('calls triggerProactiveRefresh when the timer fires at 55 minutes', () => {
      vi.useFakeTimers();
      const spy = vi.spyOn(service as any, 'triggerProactiveRefresh').mockImplementation(() => {});
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      (service as any).scheduleTokenRefresh(expiresAt);
      vi.advanceTimersByTime(55 * 60 * 1000); // advance 55 minutes
      expect(spy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('triggers immediately when token expires within 5 minutes', () => {
      const spy = vi.spyOn(service as any, 'triggerProactiveRefresh').mockImplementation(() => {});
      const expiresAt = Date.now() + 2 * 60 * 1000; // only 2 min left
      (service as any).scheduleTokenRefresh(expiresAt);
      expect(spy).toHaveBeenCalled();
    });

    it('clears existing timer before scheduling a new one', () => {
      vi.useFakeTimers();
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
      const existingId = setTimeout(() => {}, 999_999);
      (service as any)._refreshTimerId = existingId;
      const expiresAt = Date.now() + 60 * 60 * 1000;
      (service as any).scheduleTokenRefresh(expiresAt);
      expect(clearSpy).toHaveBeenCalledWith(existingId);
      vi.useRealTimers();
    });
  });

  describe('handleUnauthorized()', () => {
    it('sets isReauthPending to true', () => {
      vi.spyOn(service as any, 'attemptSilentRefresh').mockResolvedValue(undefined);
      vi.spyOn(service, 'getAccessToken').mockReturnValue(null);
      service.handleUnauthorized().subscribe();
      expect(service.isReauthPending()).toBe(true);
    });

    it('emits AUTH_REVOKED notification when silent refresh fails', async () => {
      vi.spyOn(service as any, 'attemptSilentRefresh').mockRejectedValue(new Error('fail'));
      await new Promise<void>((done) => {
        service.handleUnauthorized().subscribe({ complete: done });
      });
      expect(notificationSpy.showError).toHaveBeenCalledWith({ type: 'AUTH_REVOKED' }, 'Sign in');
    });

    it('does NOT emit AUTH_REVOKED notification when silent refresh succeeds', async () => {
      vi.spyOn(service as any, 'attemptSilentRefresh').mockResolvedValue(undefined);
      vi.spyOn(service, 'getAccessToken').mockReturnValue('fresh-token');
      await new Promise<void>((done) => {
        service.handleUnauthorized().subscribe({ complete: done });
      });
      expect(notificationSpy.showError).not.toHaveBeenCalled();
    });

    it('resets isReauthPending to false after silent refresh failure', async () => {
      vi.spyOn(service as any, 'attemptSilentRefresh').mockRejectedValue(new Error('fail'));
      await new Promise<void>((done) => {
        service.handleUnauthorized().subscribe({ complete: done });
      });
      expect(service.isReauthPending()).toBe(false);
    });

    it('returns EMPTY and navigates to /auth when silent refresh fails', async () => {
      vi.spyOn(service as any, 'attemptSilentRefresh').mockRejectedValue(new Error('fail'));
      const values: string[] = [];
      await new Promise<void>((done) => {
        service.handleUnauthorized().subscribe({ next: (v) => values.push(v), complete: done });
      });
      expect(values).toHaveLength(0);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth']);
    });

    it('returns EMPTY immediately when _isRefreshInProgress is true', () => {
      (service as any)._isRefreshInProgress = true;
      const values: string[] = [];
      service.handleUnauthorized().subscribe({ next: (v) => values.push(v) });
      expect(values).toHaveLength(0);
      expect(notificationSpy.showError).not.toHaveBeenCalled();
    });

    it('resets _isRefreshInProgress to false after success path', async () => {
      vi.spyOn(service as any, 'attemptSilentRefresh').mockResolvedValue(undefined);
      vi.spyOn(service, 'getAccessToken').mockReturnValue('new-token');
      await new Promise<void>((done) => {
        service.handleUnauthorized().subscribe({ complete: done, error: done });
      });
      expect((service as any)._isRefreshInProgress).toBe(false);
    });

    it('resets _isRefreshInProgress to false after failure path', async () => {
      vi.spyOn(service as any, 'attemptSilentRefresh').mockRejectedValue(new Error('fail'));
      await new Promise<void>((done) => {
        service.handleUnauthorized().subscribe({ complete: done, error: done });
      });
      expect((service as any)._isRefreshInProgress).toBe(false);
    });

    it('emits new token when silent refresh succeeds', async () => {
      vi.spyOn(service as any, 'attemptSilentRefresh').mockResolvedValue(undefined);
      vi.spyOn(service, 'getAccessToken').mockReturnValue('fresh-token');
      const values: string[] = [];
      await new Promise<void>((done) => {
        service.handleUnauthorized().subscribe({ next: (v) => values.push(v), complete: done });
      });
      expect(values).toEqual(['fresh-token']);
    });
  });

  describe('retryAll() on re-auth recovery', () => {
    it('calls retryAll() when isReauthPending was true on a successful token response', () => {
      service.isReauthPending.set(true);
      // Stub scheduleTokenRefresh so it doesn't kick off a real timer
      vi.spyOn(service as any, 'scheduleTokenRefresh').mockImplementation(() => {});
      // Simulate handleTokenResponse with a valid response
      (service as any).handleTokenResponse({
        access_token: 'new-token',
        expires_in: '3600',
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/spreadsheets',
      });
      expect(syncQueueSpy.retryAll).toHaveBeenCalled();
      expect(service.isReauthPending()).toBe(false);
    });

    it('does NOT call retryAll() when isReauthPending was false', () => {
      service.isReauthPending.set(false);
      vi.spyOn(service as any, 'scheduleTokenRefresh').mockImplementation(() => {});
      (service as any).handleTokenResponse({
        access_token: 'new-token',
        expires_in: '3600',
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/spreadsheets',
      });
      expect(syncQueueSpy.retryAll).not.toHaveBeenCalled();
    });
  });
});
