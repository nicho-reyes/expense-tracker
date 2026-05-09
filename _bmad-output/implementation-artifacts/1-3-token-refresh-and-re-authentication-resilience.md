# Story 1.3: Token Refresh and Re-Authentication Resilience

Status: done

## Story

As Nick,
I want the app to silently refresh my session and only prompt me to re-authenticate when absolutely necessary,
so that token expiry never causes data loss and the app remains usable during any auth interruption.

## Acceptance Criteria

1. **Given** my access token is nearing expiry **When** the GIS silent iframe refresh attempt succeeds **Then** the new token is swapped in memory with no visible interruption to my session
2. **Given** the silent iframe refresh attempt fails **When** the fallback triggers **Then** I am redirected to `/auth` without losing any locally stored data
3. **Given** I am on the re-authentication screen **When** I look at the entry list and sync queue indicator **Then** previously entered data is still visible and I can view all cached entries in read mode
4. **Given** I complete re-authentication **When** the app resumes **Then** `SyncQueueService.retryAll()` is called to flush the pending queue and the latest Sheet data is fetched
5. **Given** a Sheets API call returns HTTP 401 during an active session **When** the error is handled **Then** an `AppError.AUTH_REVOKED` is emitted, I am prompted to re-authenticate, and no data is lost

## Tasks / Subtasks

- [x] Add `isReauthPending` signal and `scheduleTokenRefresh()` to `AuthService` (AC: 1, 3)
  - [x] Add `readonly isReauthPending = signal(false)` as public signal
  - [x] Add private `_refreshTimerId: ReturnType<typeof setTimeout> | null = null`
  - [x] Implement `scheduleTokenRefresh(expiresAt: number)` — sets timeout at `expiresAt - 5 * 60 * 1000 - Date.now()` (5 min before expiry); on fire, calls `attemptSilentRefresh()`; on success: calls `scheduleTokenRefresh` recursively for new token; on failure: sets `isReauthPending(true)` and navigates to `/auth`
  - [x] Call `scheduleTokenRefresh(expiresAt)` from `handleTokenResponse()` after setting `_user` signal
  - [x] Clear timer on `signOut()` via `clearTimeout(this._refreshTimerId)`
- [x] Add `handleUnauthorized()` to `AuthService` for interceptor 401 path (AC: 4, 5)
  - [x] Method signature: `handleUnauthorized(): Observable<string>` (returns new access token or completes with EMPTY after redirect)
  - [x] Guard: if `_isRefreshInProgress` is already true, return `EMPTY` immediately to prevent concurrent refresh loops
  - [x] Set `_isRefreshInProgress = true`; set `isReauthPending(true)`
  - [x] Emit `AppError.AUTH_REVOKED` via `notification.showError({ type: 'AUTH_REVOKED' }, 'Sign in')`
  - [x] Attempt `from(this.attemptSilentRefresh())` — on success: `map()` to new token from `getAccessToken()`; on error/null: navigate to `/auth` and return `EMPTY`
  - [x] Clear `_isRefreshInProgress = false` in both success and error paths (use `finalize`)
  - [x] Import: `Observable`, `from`, `map`, `catchError`, `EMPTY`, `finalize` from `rxjs`
- [x] Inject `SyncQueueService` into `AuthService` and call `retryAll()` on re-auth success (AC: 4)
  - [x] Add `private readonly syncQueue = inject(SyncQueueService)` — no circular dependency; `SyncQueueService` has no `AuthService` dependency
  - [x] In `handleTokenResponse()`: if `this.isReauthPending()` is `true` when a valid token arrives → call `this.syncQueue.retryAll().catch(() => {})` (must not crash — stub throws until Story 2/3)
  - [x] After calling `retryAll()`, set `isReauthPending(false)`
- [x] Upgrade `AuthInterceptor` to handle HTTP 401 with retry (AC: 5)
  - [x] Import `catchError`, `switchMap`, `throwError` from `rxjs`; import `HttpErrorResponse` from `@angular/common/http`
  - [x] Import `AuthService` (already imported from Story 1.2)
  - [x] After adding Bearer token, pipe `next(clonedReq)` through `catchError`
  - [x] On `error.status === 401`: call `inject(AuthService).handleUnauthorized()` and `switchMap` the returned token to a cloned retry request
  - [x] On other errors or when `handleUnauthorized()` returns EMPTY: re-throw via `throwError(() => error)`
  - [x] **Do NOT add `X-Auth-Retry` or any custom header to the retry request** — use `_isRefreshInProgress` guard in `AuthService` to prevent loops
- [x] Update `authGuard` to allow read-only access when `isReauthPending` is true (AC: 3)
  - [x] Import `AuthService`
  - [x] Change guard condition: allow if `auth.isAuthenticated() || auth.isReauthPending()`
  - [x] When `isReauthPending()` is true, route access is permitted (IDB provides data); Sheets writes will queue
- [x] Update `AuthComponent` for re-auth mode (AC: 3, 4)
  - [x] Inject `AuthService` (already injected)
  - [x] Expose `readonly isReauthMode = inject(AuthService).isReauthPending` (alias for template clarity)
  - [x] In template: when `isReauthMode()` is true, show banner: "Your session has expired. Your data is safely stored — sign in to resume syncing." instead of the default "Sign in with Google" headline
  - [x] On successful `signIn()` in re-auth mode, `AuthService.handleTokenResponse` sets `isReauthPending(false)` and calls `retryAll()` — component does not need to handle this explicitly
- [x] Write Vitest tests for new `AuthService` behavior
  - [x] `scheduleTokenRefresh()` schedules a setTimeout (use `vi.useFakeTimers`)
  - [x] `scheduleTokenRefresh()` calls `attemptSilentRefresh` when the timer fires
  - [x] `handleUnauthorized()` sets `isReauthPending` to true
  - [x] `handleUnauthorized()` emits `AUTH_REVOKED` via `NotificationService`
  - [x] `handleUnauthorized()` returns `EMPTY` and navigates to `/auth` when silent refresh fails
  - [x] `handleUnauthorized()` is a no-op (returns `EMPTY`) when `_isRefreshInProgress` is already true
  - [x] After successful re-auth token, `retryAll()` is called when `isReauthPending` was true
  - [x] `signOut()` clears the refresh timer
- [x] Write Vitest tests for upgraded `AuthInterceptor`
  - [x] On 401: calls `AuthService.handleUnauthorized()` and retries the request with new token
  - [x] On non-401 HTTP error: error propagates through without calling `handleUnauthorized()`
  - [x] On 401 when `handleUnauthorized()` returns `EMPTY` (redirect path): original error is NOT re-emitted (EMPTY completes the stream)

## Dev Notes

### Architecture Overview for This Story

Story 1.3 wires three components together:
1. **Proactive refresh** — `AuthService` schedules a silent token refresh 5 minutes before expiry
2. **Reactive 401 handling** — `AuthInterceptor` catches HTTP 401 and triggers silent refresh → retry
3. **Re-auth UX** — `isReauthPending` signal coordinates between `AuthService`, `authGuard`, and `AuthComponent`

### `AuthService` Changes — Complete Shape

Add these fields and methods to the existing service:

```typescript
// NEW public signal
readonly isReauthPending = signal(false);

// NEW private fields
private _refreshTimerId: ReturnType<typeof setTimeout> | null = null;
private _isRefreshInProgress = false;

// NEW private injection (add at top with other injects)
private readonly syncQueue = inject(SyncQueueService);
```

`scheduleTokenRefresh(expiresAt: number)` implementation:

```typescript
private scheduleTokenRefresh(expiresAt: number): void {
  if (this._refreshTimerId !== null) {
    clearTimeout(this._refreshTimerId);
  }
  const delay = expiresAt - Date.now() - 5 * 60 * 1000; // 5 min before expiry
  if (delay <= 0) {
    // Token already expired or will expire within 5 min — try refresh immediately
    this.triggerProactiveRefresh();
    return;
  }
  this._refreshTimerId = setTimeout(() => this.triggerProactiveRefresh(), delay);
}

private triggerProactiveRefresh(): void {
  this.attemptSilentRefresh().then(() => {
    // handleTokenResponse will have run; if _user is still null, navigate
    if (!this.isAuthenticated()) {
      this.isReauthPending.set(true);
      this.router.navigate(['/auth']);
    }
  }).catch(() => {
    this.isReauthPending.set(true);
    this.router.navigate(['/auth']);
  });
}
```

`handleUnauthorized()` implementation — must use RxJS since interceptor is RxJS-based:

```typescript
handleUnauthorized(): Observable<string> {
  if (this._isRefreshInProgress) {
    return EMPTY;
  }
  this._isRefreshInProgress = true;
  this.isReauthPending.set(true);
  this.notification.showError({ type: 'AUTH_REVOKED' }, 'Sign in');

  return from(this.attemptSilentRefresh()).pipe(
    map(() => {
      const token = this.getAccessToken();
      if (!token) throw new Error('Silent refresh produced no token');
      return token;
    }),
    catchError(() => {
      this.router.navigate(['/auth']);
      return EMPTY;
    }),
    finalize(() => {
      this._isRefreshInProgress = false;
    }),
  );
}
```

Update `handleTokenResponse()` — call `scheduleTokenRefresh` and handle re-auth flush:

```typescript
private handleTokenResponse(response: GisTokenResponse): void {
  // ... existing validation logic (keep as-is from Story 1.2) ...

  const expiresAt = Date.now() + exp * 1000;
  const wasReauthPending = this.isReauthPending();

  this._user.set({ accessToken: response.access_token, expiresAt });
  sessionStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));

  // NEW: schedule proactive refresh for the new token
  this.scheduleTokenRefresh(expiresAt);

  // NEW: flush sync queue if this was a re-auth recovery
  if (wasReauthPending) {
    this.isReauthPending.set(false);
    this.syncQueue.retryAll().catch(() => {}); // no-op until Story 2/3 implements retryAll
  }

  if (wasSignInContext) {
    this.router.navigate(['/']).catch(() => {});
  }

  callbacks?.resolve();
}
```

Update `signOut()` — clear the refresh timer:

```typescript
signOut(): void {
  if (this._refreshTimerId !== null) {
    clearTimeout(this._refreshTimerId);
    this._refreshTimerId = null;
  }
  this._user.set(null);
  this.isReauthPending.set(false);
  sessionStorage.removeItem(SESSION_EXPIRY_KEY);
  this.router.navigate(['/auth']);
}
```

Import additions required:
```typescript
import { Observable, EMPTY, from, map, catchError, finalize } from 'rxjs';
import { SyncQueueService } from './sync-queue.service';
```

### `AuthInterceptor` Changes — Complete Shape

```typescript
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('https://sheets.googleapis.com')) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  const clonedReq = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        return auth.handleUnauthorized().pipe(
          switchMap((newToken) =>
            next(req.clone({ headers: req.headers.set('Authorization', `Bearer ${newToken}`) }))
          ),
        );
      }
      return throwError(() => error);
    }),
  );
};
```

Key difference from Story 1.2 shape: `next(clonedReq).pipe(catchError(...))`. The `EMPTY` return from `handleUnauthorized()` on the redirect path means `switchMap` never fires and the stream just completes — the original error is NOT propagated (which is correct; the user is redirected to `/auth` and the pending request is abandoned).

### `authGuard` Changes

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() || auth.isReauthPending()) {
    return true; // read-only mode: IDB data accessible, Sheets writes queue
  }
  return router.createUrlTree(['/auth']);
};
```

This is the minimal change. `isReauthPending() === true` means session expired mid-use — data is in IDB and accessible; `EntriesService` reads from IDB so the entry list renders normally. `isAuthenticated() === false` blocks write-through to Sheets (interceptor adds no token, calls will 401 again — but `handleUnauthorized()` guards against re-entry with `_isRefreshInProgress`).

### `AuthComponent` Changes

Add re-auth mode banner to the existing component. The component already has `isLoading` and `errorMessage` signals. Only template and the alias are new:

```typescript
// Add alias in component class
readonly isReauthMode = inject(AuthService).isReauthPending;
```

Template addition (add above the existing sign-in button, conditionally):
```html
@if (isReauthMode()) {
  <p class="reauth-notice">
    Your session has expired. Your data is safely stored — sign in to resume syncing.
  </p>
}
```

No new Angular Material components needed — use existing styles and layout. The notice can be a simple `<p>` with `color: var(--muted)` or the existing text styling.

### `SyncQueueService.retryAll()` — Stub Awareness

`SyncQueueService.retryAll()` currently throws `new Error('Not implemented')`. Story 1.3 calls it from `handleTokenResponse()` wrapped in `.catch(() => {})`. This is intentional — the call is wired now so the trigger is in place; Stories 2 and 3 implement the actual queue flush logic. Do NOT implement `retryAll()` in this story.

### Token Expiry Timing

GIS `initTokenClient` tokens expire in **3600 seconds (1 hour)**. The proactive refresh window is **5 minutes before expiry** (at 55 minutes). The 10-second silent refresh timeout from Story 1.2 (`SILENT_REFRESH_TIMEOUT_MS`) is reused in `attemptSilentRefresh()` — no change needed.

`scheduleTokenRefresh()` uses `Date.now()` to compute the delay. Timer is in milliseconds. Edge case: if `expiresAt - Date.now() - 5 * 60 * 1000 <= 0`, trigger refresh immediately (already handled by the `if (delay <= 0)` guard).

### Preventing 401 Infinite Loops

The `_isRefreshInProgress: boolean` flag on `AuthService` prevents two concurrent 401s from each spawning their own refresh attempt. Since the interceptor is a pure function invoked per request, all requests in-flight during a 401 will call `handleUnauthorized()` — the first wins, the rest receive `EMPTY` (abandoning their retry). The first call's refresh will either succeed (new token, manual retry would then work) or fail (redirect to `/auth`). In both cases the in-flight requests will fail, which is acceptable — the user either has a new token and can retry, or they're at `/auth`.

### `sessionStorage` Key

`SESSION_EXPIRY_KEY = 'auth_session_expiry'` — established in Story 1.2. Story 1.3 does NOT change this key or its behavior. `scheduleTokenRefresh()` uses `expiresAt` from the GIS response directly, not the `sessionStorage` value.

### Testing Notes — Use Existing Test Infrastructure

The existing `setupGisMock()` helper in `auth.service.spec.ts` is reusable for 1.3 tests. Key additions:

```typescript
describe('scheduleTokenRefresh()', () => {
  it('calls triggerProactiveRefresh after the computed delay', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(service as any, 'triggerProactiveRefresh').mockImplementation(() => {});
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    (service as any).scheduleTokenRefresh(expiresAt);
    vi.advanceTimersByTime(55 * 60 * 1000); // 55 minutes
    expect(spy).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('handleUnauthorized()', () => {
  it('sets isReauthPending to true', async () => {
    vi.spyOn(service as any, 'attemptSilentRefresh').mockResolvedValue(undefined);
    vi.spyOn(service, 'getAccessToken').mockReturnValue(null);
    const obs = service.handleUnauthorized();
    obs.subscribe(); // trigger
    expect(service.isReauthPending()).toBe(true);
  });

  it('emits AUTH_REVOKED notification', () => {
    vi.spyOn(service as any, 'attemptSilentRefresh').mockRejectedValue(new Error());
    service.handleUnauthorized().subscribe();
    expect(notificationSpy.showError).toHaveBeenCalledWith({ type: 'AUTH_REVOKED' }, 'Sign in');
  });

  it('returns EMPTY and navigates to /auth when refresh fails', async () => {
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
});
```

For `AuthInterceptor` test: use `HttpClientTestingModule` with `HttpTestingController` from `@angular/common/http/testing`. Intercept a Sheets API call, return 401, verify `AuthService.handleUnauthorized` was called and the request was retried.

Run tests with: `ng test --watch=false` (NOT `npx vitest run` directly — the `@angular/build:unit-test` builder manages Vitest; running Vitest directly fails because the builder sets up globals).

### Files to Create / Modify

| File | Action |
|------|--------|
| `src/app/core/services/auth.service.ts` | UPDATE — add `isReauthPending`, `scheduleTokenRefresh`, `handleUnauthorized`, inject `SyncQueueService` |
| `src/app/core/interceptors/auth.interceptor.ts` | UPDATE — add 401 handling with retry |
| `src/app/core/guards/auth.guard.ts` | UPDATE — allow `isReauthPending()` through |
| `src/app/features/auth/auth.component.ts` | UPDATE — add `isReauthMode` alias |
| `src/app/features/auth/auth.component.html` | UPDATE — add re-auth notice banner |
| `src/app/core/services/auth.service.spec.ts` | UPDATE — add Story 1.3 test cases |
| `src/app/core/interceptors/auth.interceptor.spec.ts` | CREATE — 401 retry tests |

### What This Story Does NOT Implement

- `SyncQueueService.retryAll()` actual logic — that is Story 2/3; this story only wires the call
- Sheet data re-fetch after re-auth — "latest Sheet data is fetched" in AC4 refers to `retryAll()` processing queued writes, not a read refresh; the read layer is IDB-primary and will re-sync in Story 2 flows
- Offline detection / `navigator.onLine` handling — Story 3.4
- Rate-limiting concurrent 401 retries across multiple in-flight requests — `_isRefreshInProgress` guard handles the single-user case; multi-request queueing deferred

### Project Structure Notes

- All new code follows existing patterns: `OnPush`, standalone, functional guard, functional interceptor
- `SyncQueueService` imported in `auth.service.ts` — already `providedIn: 'root'`; no registration changes needed
- No new routes, components, or Angular Material modules required
- `auth.interceptor.spec.ts` goes co-located with `auth.interceptor.ts` in `src/app/core/interceptors/`
- RxJS imports (`Observable`, `EMPTY`, `from`, `map`, `catchError`, `finalize`) are peer deps of Angular — no new `npm install` needed

### References

- Story 1.3 ACs: [Source: `_bmad-output/planning-artifacts/epics/epic-1-foundation-authentication-first-run-setup.md#Story-1.3`]
- Sequence diagram Path C (token expiry during session): [Source: `_bmad-output/planning-artifacts/sequence-diagrams.md#Diagram-4`]
- `AppError.AUTH_REVOKED` definition: [Source: `src/app/core/models/error.model.ts`]
- `SyncQueueService.retryAll()` stub: [Source: `src/app/core/services/sync-queue.service.ts:39`]
- `AuthService` current implementation (Story 1.2): [Source: `src/app/core/services/auth.service.ts`]
- `authInterceptor` current implementation (Story 1.2): [Source: `src/app/core/interceptors/auth.interceptor.ts`]
- `authGuard` current implementation: [Source: `src/app/core/guards/auth.guard.ts`]
- `AuthComponent` current implementation: [Source: `src/app/features/auth/auth.component.ts`]
- Session expiry key constant: [Source: `src/app/core/services/auth.service.ts:13` — `SESSION_EXPIRY_KEY = 'auth_session_expiry'`]
- `SILENT_REFRESH_TIMEOUT_MS` constant: [Source: `src/app/core/services/auth.service.ts:14`]
- Deferred: GIS callback teardown on service re-init: [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — "Deferred from: code review of 1-2"]
- Test runner: use `ng test --watch=false` not `npx vitest run`: [Source: `_bmad-output/implementation-artifacts/1-2-google-oauth-authentication-flow.md#Debug-Log-References`]
- Component boilerplate: standalone + OnPush: [Source: `_bmad-output/planning-artifacts/architecture.md#Component-Architecture`]
- Angular 21 root file naming: [Source: `_bmad-output/implementation-artifacts/1-2-google-oauth-authentication-flow.md#Angular-21-File-Naming-Reminder`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Node 16 does not have `os.availableParallelism()` — must use Node 24 (`~/.nvm/versions/node/v24.5.0/bin`) to run `ng test`.

### Completion Notes List

- Implemented `isReauthPending` signal, `scheduleTokenRefresh()` (with `triggerProactiveRefresh()` helper), and `handleUnauthorized()` on `AuthService`.
- Injected `SyncQueueService` into `AuthService`; `retryAll()` called on re-auth recovery wrapped in `.catch(() => {})` since the stub throws.
- `AuthInterceptor` now pipes `next(clonedReq)` through `catchError`: on 401 calls `handleUnauthorized()` + `switchMap` retry; on other errors rethrows.
- `authGuard` updated to allow `isAuthenticated() || isReauthPending()`.
- `AuthComponent` exposes `isReauthMode` alias; template shows session-expiry banner in re-auth mode, subtitle otherwise.
- 49 tests pass (8 test files) — all existing tests preserved, new tests added for all specified behaviors.

### File List

- `src/app/core/services/auth.service.ts` — updated
- `src/app/core/interceptors/auth.interceptor.ts` — updated
- `src/app/core/guards/auth.guard.ts` — updated
- `src/app/features/auth/auth.component.ts` — updated
- `src/app/features/auth/auth.component.html` — updated
- `src/app/core/services/auth.service.spec.ts` — updated
- `src/app/core/interceptors/auth.interceptor.spec.ts` — created

### Review Findings

- [x] [Review][Decision] AUTH_REVOKED notification shown before silent refresh outcome is known — resolved: move notification to catchError branch only (emit on failure, not on entry)
- [x] [Review][Decision] Concurrent 401s silently complete without retrying dropped requests — resolved: accepted, SyncQueueService retries externally
- [x] [Review][Patch] Move AUTH_REVOKED notification to catchError branch only [auth.service.ts:handleUnauthorized]
- [x] [Review][Patch] isReauthPending stuck true after handleUnauthorized failure [auth.service.ts:handleUnauthorized catchError]
- [x] [Review][Patch] triggerProactiveRefresh not guarded by _isRefreshInProgress — concurrent proactive timer + handleUnauthorized both call attemptSilentRefresh, overwriting _pendingCallbacks and orphaning handleUnauthorized's promise [auth.service.ts:triggerProactiveRefresh]
- [x] [Review][Patch] scheduleTokenRefresh does not null _refreshTimerId after timer callback fires [auth.service.ts:scheduleTokenRefresh]
- [x] [Review][Patch] AuthComponent injects AuthService twice [auth.component.ts:21]
- [x] [Review][Defer] attemptSilentRefresh overwrites _pendingCallbacks without resolving previous concurrent caller [auth.service.ts:requestToken] — deferred, pre-existing from Story 1.2

## Change Log

- 2026-05-08: Story 1.3 implemented — token refresh resilience, 401 interceptor retry, re-auth UX, and guard read-only mode. 49 tests pass.
