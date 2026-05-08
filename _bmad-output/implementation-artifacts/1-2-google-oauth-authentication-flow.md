# Story 1.2: Google OAuth Authentication Flow

Status: done

## Story

As Nick,
I want to sign in with my Google account via a standard OAuth flow,
So that the app can access my Google Sheets on my behalf with the minimum necessary permissions.

## Acceptance Criteria

1. **Given** I am not authenticated **When** I open the app **Then** I am redirected to `/auth` and shown a "Sign in with Google" prompt
2. **Given** I click "Sign in with Google" **When** the GIS OAuth flow via `initTokenClient` completes successfully **Then** I am redirected to `/` and my authentication state is `AUTHENTICATED` (`isAuthenticated()` returns `true`)
3. **Given** I have previously authenticated in this browser session **When** `AuthService.init()` runs via `APP_INITIALIZER` **Then** a silent token refresh succeeds and I am not prompted to sign in again
4. **Given** the access token is obtained **When** it is stored **Then** it is held in memory only — never written to `localStorage`, `sessionStorage`, cookies, or any URL parameter
5. **Given** any HTTP call to `sheets.googleapis.com` is made via `HttpClient` **When** `AuthInterceptor` processes the request **Then** an `Authorization: Bearer <token>` header is present
6. **Given** I am authenticated **When** I navigate to any protected route (all except `/auth`) **Then** `authGuard` permits access
7. **Given** I am unauthenticated **When** I navigate to any protected route **Then** I am redirected to `/auth` with no data loss
8. **Given** the OAuth scope is inspected **When** `initTokenClient` is called **Then** only `https://www.googleapis.com/auth/spreadsheets` is requested — no Drive, Gmail, userinfo.email, or other scopes
9. **Given** the user closes the Google consent screen without granting access **When** GIS fires `error_callback` with `type: 'popup_closed'` **Then** `AppError { type: 'AUTH_DENIED' }` is emitted via `NotificationService`, the user stays on `/auth`, and a "Sheets access is required" message is shown — `AUTH_REVOKED` is NOT emitted (no token was ever issued)
10. **Given** a network timeout occurs during the OAuth flow **When** GIS fires `error_callback` **Then** `AppError { type: 'NETWORK', message: '...' }` is emitted via `NotificationService`, the user stays on `/auth` with a retry option visible
11. **Given** `APP_INITIALIZER` runs `AuthService.init()` **When** it completes (with or without a token) **Then** the Promise resolves — it NEVER rejects; auth failure is not a boot failure
12. **Given** all API calls are made **When** the request URL is inspected **Then** the scheme is `https://` exclusively

## Tasks / Subtasks

- [x] Create GIS TypeScript type declarations (AC: 2, 8)
  - [x] Create `src/app/core/models/gis.types.ts` with `TokenClient`, `TokenResponse`, `ClientConfigError` types
- [x] Implement `AuthService` full OAuth flow (AC: 2, 3, 4, 9, 10, 11)
  - [x] Dynamic GIS script loader (`loadGisScript()`) using `environment.gisScriptUrl`
  - [x] `initializeTokenClient()` — sets up token client with correct scope and callbacks
  - [x] `init()` — loads GIS script, sets up token client, attempts silent refresh (`prompt: ''`); resolves regardless of outcome (never rejects)
  - [x] `signIn()` — calls `requestAccessToken()` with default prompt (shows consent screen)
  - [x] `signOut()` — clears in-memory token, sets `isAuthenticated = false`
  - [x] `getAccessToken()` — returns token string if not expired, null if expired or absent
  - [x] Private `WritableSignal<AuthUser | null>` for token; public `readonly isAuthenticated = computed(() => ...)`
  - [x] Token expiry: compute `expiresAt = Date.now() + parseInt(response.expires_in) * 1000`
  - [x] On `error_callback` `popup_closed` → emit `AUTH_DENIED` via `NotificationService`, set auth state; on other errors → emit `NETWORK`
- [x] Wire `APP_INITIALIZER` in `app.config.ts` (AC: 3, 11)
  - [x] Add `APP_INITIALIZER` provider calling `() => authService.init()`
  - [x] `CategoriesService.init()` initializer NOT added here — that is Story 1.5
- [x] Implement `AuthInterceptor` (AC: 5, 12)
  - [x] Only inject Bearer token when URL contains `sheets.googleapis.com`
  - [x] Skip injection if `getAccessToken()` returns null
  - [x] Clone request, set `Authorization: Bearer <token>` header
- [x] Add `canActivate: [authGuard]` to all protected routes in `app.routes.ts` (AC: 6, 7)
  - [x] All routes except `{ path: 'auth', ... }` must have `canActivate: [authGuard]`
  - [x] Verify `authGuard` still redirects to `/auth` for unauthenticated requests
- [x] Implement `AuthComponent` sign-in UI (AC: 1, 9, 10)
  - [x] "Sign in with Google" button triggers `authService.signIn()`
  - [x] Loading state during OAuth flow (disable button + spinner)
  - [x] Error message area: show `AUTH_DENIED` ("Sheets access is required") and `NETWORK` ("Check connection — try again") messages
  - [x] On successful auth: inject `Router` and navigate to `/`
  - [x] `OnPush` + `standalone` — follows mandatory component boilerplate pattern
- [x] Write unit tests (Vitest) for `AuthService`
  - [x] Test `init()` resolves even when GIS returns error
  - [x] Test `getAccessToken()` returns null when token is expired
  - [x] Test `signIn()` sets `isAuthenticated` signal to true on success

### Review Findings

- [x] [Review][Patch] `popup_failed_to_open` needs distinct message — show "Please allow popups for this site" instead of AUTH_DENIED "Sheets access is required" [auth.service.ts:handleErrorCallback]
- [x] [Review][Patch] `NotificationService` typed AppError — add `AppError` interface; extend `showError` to accept `AppError` objects; update `handleErrorCallback` to emit typed `AppError { type: 'AUTH_DENIED' }` and `AppError { type: 'NETWORK' }` [notification.service.ts + auth.service.ts:handleErrorCallback]
- [x] [Review][Patch] AC3 session persistence — store token expiry metadata (not the token itself) in `sessionStorage`; on `init()` read the stored expiry to decide whether to skip GIS round-trip and stay authenticated across page reloads [auth.service.ts:init]
- [x] [Review][Patch] `loadGisScript` hangs if existing script tag already fired 'load' before new listener attaches — promise never resolves [auth.service.ts:loadGisScript]
- [x] [Review][Patch] `loadGisScript` listener leak — concurrent callers each append listener pairs with no cleanup, potential multiple resolves [auth.service.ts:loadGisScript]
- [x] [Review][Patch] `_pendingResolve` overwritten when `signIn()` called during `init()` 10s timeout — first caller's promise never resolves, component `isLoading` stuck [auth.service.ts:signIn]
- [x] [Review][Patch] `setupTokenClient` uses `window.google!` non-null assertion — throws TypeError if `accounts.oauth2` absent after partial GIS script load [auth.service.ts:setupTokenClient]
- [x] [Review][Patch] `expires_in` absent, empty, or non-numeric causes `expiresAt = NaN` — `isAuthenticated` always false after sign-in [auth.service.ts:handleTokenResponse]
- [x] [Review][Patch] Empty or absent `access_token` stored in `AuthUser` without error guard — interceptor sends bare `Authorization: Bearer ` header to Sheets API [auth.service.ts:handleTokenResponse]
- [x] [Review][Patch] `response.error` path resolves silently — `signIn()` returns normally with no `errorMessage` set; user sees spinner vanish with no feedback on access-denied [auth.service.ts:handleTokenResponse]
- [x] [Review][Patch] Network error from `handleErrorCallback` doesn't set `errorMessage` on `AuthComponent` — retry button never rendered for GIS error callbacks; AC10 violated [auth.service.ts:handleErrorCallback]
- [x] [Review][Patch] Wildcard `{ path: '**', redirectTo: '' }` creates two-hop redirect — unauthenticated users on unknown URLs hit guard then /auth rather than going direct [app.routes.ts]
- [x] [Review][Patch] Authenticated user landing on `/auth` sees sign-in screen — no redirect-if-authenticated logic on the auth route [auth.component.ts]
- [x] [Review][Patch] `onSignIn()` catch block is dead code — `signIn()` never throws; runtime/DI errors silently reset `isLoading` without user feedback [auth.component.ts:onSignIn]
- [x] [Review][Patch] `tokenClient` null guard missing in `requestToken` and `attemptSilentRefresh` — TypeError if `setupTokenClient` throws during `signIn()` flow [auth.service.ts:requestToken]
- [x] [Review][Patch] `router.navigate(['/'])` rejection unhandled in `handleTokenResponse` — unhandled promise rejection in console [auth.service.ts:handleTokenResponse]
- [x] [Review][Patch] `authInterceptor` attaches bearer token without verifying `https://` scheme — violates AC12 [auth.interceptor.ts]
- [x] [Review][Defer] Stale GIS callback fires after service teardown or test reinitialization — no destroy lifecycle mechanism in current design [auth.service.ts:init] — deferred, pre-existing

## Dev Notes

### Critical Architecture Decisions for This Story

**Use `initTokenClient`, NOT `initCodeClient`**
The sequence diagram (sequence-diagrams.md Diagram 4) contains a documentation error — it says `initCodeClient (PKCE)`. The canonical implementation decision (epics.md Epic 1 architecture section) specifies `initTokenClient` (implicit grant, token in memory only). `initCodeClient` requires a backend for authorization code exchange. This app has no backend. Use `initTokenClient` exclusively.

**Token in memory only — enforced in `AuthService`**
The token is a private `WritableSignal<AuthUser | null>` on the `AuthService` instance. It is never passed to `localStorage`, `sessionStorage`, `document.cookie`, `window.name`, URL params, or any other browser persistence mechanism. `getAccessToken()` is the sole external accessor. `AuthInterceptor` calls `getAccessToken()` — it does not have its own token reference.

**`APP_INITIALIZER` must NEVER reject**
A rejected `APP_INITIALIZER` factory crashes the Angular bootstrap chain. `AuthService.init()` must wrap all internal errors, catch them, and resolve the promise. Auth failure (no GIS session, script load failure) is NOT a boot failure — it is handled downstream by `authGuard` redirecting to `/auth`.

**`AUTH_DENIED` vs `AUTH_REVOKED`**
- `AUTH_DENIED` (Story 1.1 added this) = user closed consent screen without granting access; no token was ever issued; happens in `signIn()` error path
- `AUTH_REVOKED` = token was previously valid but has been revoked; a 401 on an active API call; handled in Story 1.3
- Never emit `AUTH_REVOKED` from `signIn()` — it is semantically wrong for consent cancellation

**Scope: `https://www.googleapis.com/auth/spreadsheets` only**
The architecture doc mentions `userinfo.email` in one place — that is superseded by the AC. NFR-S4 is explicit: minimum necessary scopes, Sheets read/write only. The GIS `initTokenClient` call uses exactly one scope string: `'https://www.googleapis.com/auth/spreadsheets'`.

**`authGuard` and `APP_INITIALIZER` ordering**
`APP_INITIALIZER` resolves before Angular processes any routes. By the time `authGuard` checks `isAuthenticated()`, `init()` has already run and set the signal. No race condition. The guard reads the signal synchronously — no async needed.

### GIS Type Declarations

GIS does not ship `@types/google.accounts`. Create `src/app/core/models/gis.types.ts` with the minimal types this story needs:

```typescript
// Minimal GIS OAuth2 type declarations for expense-dashboard
// Add fields as other stories require them

export interface GisTokenResponse {
  access_token: string;
  expires_in: string;      // GIS returns this as a string
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface GisClientConfigError {
  type: 'popup_failed_to_open' | 'popup_closed' | 'unknown';
  message?: string;
}

export interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
  error_callback?: (error: GisClientConfigError) => void;
}

export interface GisTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

// Extend Window — only used inside AuthService
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: GisTokenClientConfig): GisTokenClient;
          revoke(token: string, done: () => void): void;
        };
      };
    };
  }
}
```

### `AuthService` Implementation Shape

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';
import type { GisTokenClient, GisTokenResponse, GisClientConfigError } from '../models/gis.types';

export interface AuthUser {
  accessToken: string;
  expiresAt: number;
}

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(null);
  private tokenClient: GisTokenClient | null = null;

  // Public API
  readonly isAuthenticated = computed(
    () => !!this._user() && this._user()!.expiresAt > Date.now()
  );

  async init(): Promise<void> {
    try {
      await this.loadGisScript();
      await this.attemptSilentRefresh();
    } catch {
      // init() must never reject — auth failure handled by authGuard
    }
  }

  async signIn(): Promise<void> {
    // sets up tokenClient if not already done, calls requestAccessToken()
  }

  signOut(): void {
    this._user.set(null);
    this.router.navigate(['/auth']);
  }

  getAccessToken(): string | null {
    const user = this._user();
    if (!user || user.expiresAt <= Date.now()) return null;
    return user.accessToken;
  }

  private loadGisScript(): Promise<void> { ... }
  private attemptSilentRefresh(): Promise<void> { ... }
  private initTokenClient(): void { ... }
  private handleTokenResponse(response: GisTokenResponse): void { ... }
  private handleErrorCallback(error: GisClientConfigError): void { ... }
}
```

Key implementation notes:
- `loadGisScript()` checks `window.google?.accounts?.oauth2` first; if absent, dynamically appends `<script src="${environment.gisScriptUrl}">` and returns a Promise that resolves on `onload`, rejects on `onerror`
- `attemptSilentRefresh()` wraps `tokenClient.requestAccessToken({ prompt: '' })` in a Promise; the GIS callback resolves it; includes a 10-second timeout that resolves (not rejects) as unauthenticated
- `initTokenClient()` calls `window.google.accounts.oauth2.initTokenClient(config)` — stores the result in `this.tokenClient`
- The `callback` and `error_callback` are set once at `initTokenClient()` time and apply to all subsequent `requestAccessToken()` calls
- After `handleTokenResponse` sets the user signal and navigates in `signIn()` context, do NOT also navigate from `init()` context — guard handles that

### `AuthInterceptor` Implementation

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Only inject token for Sheets API calls
  if (!req.url.includes('sheets.googleapis.com')) {
    return next(req);
  }

  const token = auth.getAccessToken();
  if (!token) return next(req);

  return next(
    req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
  );
};
```

The interceptor is already wired in `app.config.ts` from Story 1.1 via `withInterceptors([authInterceptor])`. No changes to `app.config.ts` needed for the interceptor itself.

### `app.config.ts` — APP_INITIALIZER Addition

Import `APP_INITIALIZER` from `@angular/core` and add to providers:

```typescript
import { APP_INITIALIZER, ApplicationConfig, ... } from '@angular/core';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... existing providers from Story 1.1 ...
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => authService.init(),
      deps: [AuthService],
      multi: true,
    },
    // CategoriesService.init() APP_INITIALIZER added in Story 1.5
  ],
};
```

### `app.routes.ts` — Add Guard to All Protected Routes

All routes except `/auth` must have `canActivate: [authGuard]`:

```typescript
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'entries',
    loadComponent: () => import('./features/entries-list/entries-list.component').then(m => m.EntriesListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'sync',
    loadComponent: () => import('./features/sync-review/sync-review.component').then(m => m.SyncReviewComponent),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard],
  },
  { path: 'auth', loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent) },
  { path: '**', redirectTo: '' },
];
```

`/auth` has NO guard — unauthenticated users must be able to access it.

### `AuthComponent` UI Pattern

```typescript
@Component({
  selector: 'app-auth',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatProgressSpinnerModule, NgIf],
  template: `...`,
})
export class AuthComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async onSignIn(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    await this.auth.signIn();
    // signIn() is async; navigation and error handling happen inside AuthService callbacks
    // isLoading reset is handled in the callback/error paths
    this.isLoading.set(false);
  }
}
```

The component must handle two error display cases:
- `AUTH_DENIED` path: `AuthService` calls `NotificationService.showError()` AND sets an observable/signal that `AuthComponent` reads to show inline "Sheets access is required" — using only snackbar is insufficient for this required message; a persistent inline message is more appropriate for this specific AC
- `NETWORK` path: Show inline error with a "Try again" button that re-invokes `onSignIn()`

Do NOT inject `MatSnackBar` directly in `AuthComponent` — all snackbar calls go through `NotificationService`. The inline error message is a component-level `errorMessage` signal, not a toast.

### What Story 1.2 Does NOT Implement

- Silent token refresh DURING an active session (token expiry detection mid-session) → Story 1.3
- 401 handling in `AuthInterceptor` (retry with refresh) → Story 1.3
- `SyncQueueService.retryAll()` on re-auth → Story 1.3
- `CategoriesService.init()` APP_INITIALIZER → Story 1.5
- Sheet discovery → Story 1.4
- First-run onboarding multi-step flow → Story 1.4

### Angular 21 File Naming Reminder (from Story 1.1 debug log)

Angular 21 root component files are `app.ts` / `app.html` / `app.scss` (no `.component` infix). All other components follow the normal `<name>.component.ts` pattern. Do not rename root component files.

### Files to Create / Modify

| File | Action |
|------|--------|
| `src/app/core/models/gis.types.ts` | CREATE — GIS type declarations |
| `src/app/core/services/auth.service.ts` | UPDATE — full implementation |
| `src/app/core/interceptors/auth.interceptor.ts` | UPDATE — Bearer token injection |
| `src/app/features/auth/auth.component.ts` | UPDATE — sign-in UI |
| `src/app/features/auth/auth.component.html` | UPDATE — sign-in template |
| `src/app/features/auth/auth.component.scss` | UPDATE — auth screen styles |
| `src/app/app.config.ts` | UPDATE — add APP_INITIALIZER |
| `src/app/app.routes.ts` | UPDATE — add canActivate to protected routes |
| `src/index.html` | UPDATE — optionally remove commented GIS script tag (loaded dynamically) |

### Environment File Check

`src/environments/environment.ts` from Story 1.1 has:
```typescript
export const environment = {
  production: false,
  googleClientId: '',       // set via NG_APP_GOOGLE_CLIENT_ID at build time
  sheetsApiBaseUrl: 'https://sheets.googleapis.com/v4/spreadsheets',
  gisScriptUrl: 'https://accounts.google.com/gsi/client',
};
```

`environment.googleClientId` will be empty string in dev without the env var. `AuthService.init()` must handle the case where `googleClientId` is empty — skip GIS initialization and remain unauthenticated (guard redirects to `/auth` where the sign-in button will fail gracefully).

### Testing Guidance

Use Vitest (not Karma — Angular 21 dropped Karma). Test file location: `src/app/core/services/auth.service.spec.ts` (co-located).

Key test cases:
1. `init()` resolves (does not reject) when GIS script fails to load
2. `init()` resolves (does not reject) when silent refresh returns no token
3. `getAccessToken()` returns null when `expiresAt` is in the past
4. `getAccessToken()` returns the token when `expiresAt` is in the future
5. `isAuthenticated` signal is false when `_user` is null
6. `isAuthenticated` signal is false when token is expired even if `_user` is set

Mock `window.google` in tests — do not make real GIS calls in unit tests.

### Sequence Diagram Reference

Sequence diagram in `_bmad-output/planning-artifacts/sequence-diagrams.md` Diagram 4 shows the full auth lifecycle including Path A (first run), Path B (returning user), and Path C (token expiry during session). Path C (re-auth during session) is Story 1.3. This story covers Paths A and B only.

Note: Diagram 4 says `initCodeClient (PKCE)` — this is a documentation error. Implementation uses `initTokenClient` per epics.md architecture section.

### Project Structure Notes

- `gis.types.ts` goes in `src/app/core/models/` — shared types are always in `core/models/`
- `AuthService` is in `src/app/core/services/` — already stubbed from Story 1.1
- `AuthComponent` is in `src/app/features/auth/` — already stubbed from Story 1.1
- `authGuard` is in `src/app/core/guards/` — already stubbed from Story 1.1, just needs route wiring
- No new files in `src/app/features/` or `src/app/shared/` required by this story
- Services: always `providedIn: 'root'` — no exceptions
- Components: always `standalone: true` + `ChangeDetectionStrategy.OnPush` — no exceptions
- Component inputs: use `input()` signal API, not `@Input()` decorator
- Component outputs: use `output()`, not `@Output()` + EventEmitter

### References

- GIS `initTokenClient` decision: [Source: `_bmad-output/planning-artifacts/epics.md#Epic-1` architecture items — "GIS `initTokenClient` (implicit grant, token in memory only)"]
- Token in-memory only: [Source: `_bmad-output/planning-artifacts/architecture.md#Authentication-Security`]
- Single scope: [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.2` AC — "only `https://www.googleapis.com/auth/spreadsheets` is requested"]
- AUTH_DENIED variant: [Source: `_bmad-output/implementation-artifacts/1-1-project-scaffold-toolchain-and-ci-cd-pipeline.md#Dev-Notes` — AppError section]
- APP_INITIALIZER boot order: [Source: `_bmad-output/planning-artifacts/sequence-diagrams.md#Diagram-1` — boot sequence]
- Auth sequence: [Source: `_bmad-output/planning-artifacts/sequence-diagrams.md#Diagram-4`]
- Auth journey: [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Journey-5`]
- Pre-sprint failure path ACs: [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.2` — pre-sprint note]
- `environment.gisScriptUrl`: [Source: `_bmad-output/implementation-artifacts/1-1-project-scaffold-toolchain-and-ci-cd-pipeline.md#Dev-Notes` — Environment Files section]
- Component boilerplate pattern: [Source: `_bmad-output/planning-artifacts/architecture.md#Component-Architecture`]
- Interceptor pattern: [Source: `_bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns`]
- `NotificationService` interface: [Source: `_bmad-output/implementation-artifacts/1-1-project-scaffold-toolchain-and-ci-cd-pipeline.md#Dev-Notes` — NotificationService Contract]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Used `ng test --watch=false` (not `npx vitest run` directly) — the `@angular/build:unit-test` builder manages the Vitest runner under the hood; running vitest directly fails because the builder sets up the globals environment
- `NgIf` import in `AuthComponent` was removed — Angular 17+ control flow (`@if`) in templates does not require `NgIf` import
- GIS callback bridge: `_pendingResolve` field on `AuthService` bridges GIS's callback API into Promises; set before each `requestAccessToken()` call, cleared in callback handlers
- `environment.googleClientId` empty-string guard added to `init()` and `signIn()` — dev environment has no client ID so GIS initialization is safely skipped
- `init()` wraps entire flow in try/catch and never rejects — Angular bootstrap would crash if APP_INITIALIZER rejects

### Completion Notes List

- Story 1.2 fully implemented: AuthService with GIS `initTokenClient` OAuth flow, APP_INITIALIZER, AuthInterceptor, authGuard route protection, AuthComponent sign-in UI
- 19/19 unit tests pass (6 test files), zero TypeScript errors, production build clean
- GIS types created in `gis.types.ts` with Window augmentation; `initTokenClient` used (NOT `initCodeClient` — sequence-diagrams.md Diagram 4 had a documentation error)
- Token stored only in `_user` signal (memory only); interceptor calls `getAccessToken()` — no direct token reference
- Silent refresh timeout is 10 seconds (resolves, not rejects) — prevents APP_INITIALIZER from hanging on slow/absent GIS
- AUTH_DENIED (popup_closed) and NETWORK error paths both surface via `NotificationService.showError()` and inline component `errorMessage` signal

### File List

- src/app/core/models/gis.types.ts (CREATE)
- src/app/core/services/auth.service.ts (UPDATE)
- src/app/core/services/auth.service.spec.ts (CREATE)
- src/app/core/interceptors/auth.interceptor.ts (UPDATE)
- src/app/features/auth/auth.component.ts (UPDATE)
- src/app/features/auth/auth.component.html (UPDATE)
- src/app/features/auth/auth.component.scss (UPDATE)
- src/app/app.config.ts (UPDATE)
- src/app/app.routes.ts (UPDATE)
- _bmad-output/implementation-artifacts/sprint-status.yaml (UPDATE)
