# Story 2.7: Persistent auth and boot-time silent re-authentication

Status: done

## Story

As Nick,
I want to stay signed in across browser restarts so I don't have to manually re-authenticate every time I open the app,
So that the local-first UX is not undermined by a forced auth roundtrip on every cold launch.

**Background:** Story 1.3 implemented in-session silent token refresh (proactive 5-min-before-expiry timer + reactive 401 handling), but stored the access token expiry in `sessionStorage` — wiped on tab/browser close — and the boot path routes straight to `/auth` whenever no in-memory token is present. As a result, every cold launch forces a fresh OAuth roundtrip even though the user's underlying Google session cookie is typically still valid. This story closes that gap by persisting the access token + expiry to IDB (`appMeta` store) so they survive tab close, and by adding a boot-time silent re-auth attempt via GIS `requestAccessToken({ prompt: 'none' })` BEFORE any visible `/auth` redirect.

## Acceptance Criteria

1. **Given** I successfully authenticate (via Story 1.2 / 1.3 / a re-auth prompt) **When** the access token is received **Then** the token and its `expiresAt` timestamp are written to the `appMeta` IDB store under a single key `'auth'` with shape `{ accessToken: string; expiresAt: number }` — `sessionStorage` is no longer the durable store for these values
2. **Given** I close my browser/tab while signed in and reopen the app within the token's remaining lifetime **When** `AuthService.init()` runs at boot **Then** the persisted token is loaded from `appMeta`, set into the in-memory `_user` signal, the proactive-refresh timer is rescheduled relative to its remaining lifetime, and no auth UI is shown — the app proceeds directly to its post-auth state
3. **Given** I reopen the app after the persisted access token has expired but my Google session cookie is still valid **When** `AuthService.init()` runs at boot **Then** before any redirect to `/auth`, the service attempts a silent re-auth via GIS `requestAccessToken({ prompt: 'none' })`; if a fresh token is returned within the existing `SILENT_REFRESH_TIMEOUT_MS` window, it is persisted to IDB and the app proceeds without showing auth UI
4. **Given** boot-time silent re-auth fails (Google session cookie absent, account revoked, network failure, GIS error) **When** the failure surfaces **Then** an `AppError.AUTH_SILENT_REAUTH_FAILED` is emitted (a new variant — extends the discriminated union from 9 → 10 variants), the persisted token in `appMeta` is cleared, and the app routes to `/auth` with the existing "Your session has expired. Your data is safely stored — sign in to resume syncing." banner from Story 1.3
5. **Given** I sign out via the existing `signOut()` flow **When** the sign-out completes **Then** the persisted token is cleared from `appMeta` in addition to the existing cleanup, and the proactive-refresh timer is cleared as before — persisted token MUST NOT survive sign-out
6. **Given** Story 2.6's hydration runs on first sheet connect **When** boot-time silent re-auth has succeeded with a persisted token **Then** hydration proceeds against the restored token without any user-visible delay beyond what 2.6 already specifies — the auth restore runs first in the boot chain, hydration second
7. **Given** the persisted token's `expiresAt` is missing, malformed, or in the past on boot **When** the service evaluates persisted state **Then** the persisted record is treated as absent (purge + fall through to silent re-auth) — no half-validated token is ever sent to Sheets
8. **Given** XSS is the dominant token-exfiltration risk for a static-hosted SPA **When** evaluating the IDB-vs-sessionStorage trade **Then** Dev Notes explicitly document the choice: tokens persist in IDB so cold launches are silent; the security delta vs sessionStorage is small for a single-user, no-third-party-script app, and is justified by the persistent-auth UX contract — this is a deliberate trade, not an oversight
9. **Given** boot-time silent re-auth is in flight **When** the user backgrounds and re-foregrounds the tab, OR a 401 fires from a parallel Sheets call **Then** the in-flight attempt is not duplicated — the existing `_isRefreshInProgress` guard from Story 1.3 is reused

## Tasks / Subtasks

- [x] Extend `AppError` discriminated union with `AUTH_SILENT_REAUTH_FAILED` (AC: 4)
  - [x] In `src/app/core/models/error.model.ts`, add the 10th variant: `| { type: 'AUTH_SILENT_REAUTH_FAILED'; reason: 'no-google-session' | 'network' | 'gis-error' | 'timeout' | 'unknown'; message: string }`
  - [x] Update `NotificationService.appErrorToMessage()` switch in `src/app/core/services/notification.service.ts` — add a `case 'AUTH_SILENT_REAUTH_FAILED'` arm returning a user-facing message (e.g. `'Your session has expired. Please sign in again.'`); the exhaustive switch will fail TypeScript compile until the case is added
  - [x] Run `ng test --watch=false` to surface any other exhaustive `switch (error.type)` sites — `sheets.service.spec.ts` and `auth.service.spec.ts` do NOT currently exhaustively switch (they assert specific cases) so no spec fan-out is expected, but verify
  - [x] Update architecture doc reference in Dev Notes (this spec) — the union is now 10 variants

- [x] Extend `IdbService` overloads for the new `appMeta` `'auth'` key (AC: 1, 2, 5, 7)
  - [x] Add a typed shape near the top of `src/app/core/services/idb.service.ts`: `export interface PersistedAuth { accessToken: string; expiresAt: number; }`
  - [x] No new method signatures required — the existing generic `IdbService.get<PersistedAuth>('appMeta', 'auth')` and `IdbService.set<PersistedAuth>('appMeta', 'auth', value)` already cover this via the `appMeta` overload (same pattern Story 2.6 uses for `'hydratedAt'`)
  - [x] Add a `delete` for `appMeta` keys: the current `IdbService.delete()` is typed only for `'entries' | 'syncQueue' | 'categories'`. Extend it to accept `'appMeta'` as well — needed for the sign-out cleanup and the malformed-token purge:
    ```typescript
    async delete(
      store: 'entries' | 'syncQueue' | 'categories' | 'appMeta',
      id: string,
    ): Promise<void> { ... }
    ```
    Implementation body unchanged — `db.delete(store, id)` already handles all stores.
  - [x] Add a brief unit test in `idb.service.spec.ts` confirming `set` then `get` round-trip on `('appMeta', 'auth', { accessToken, expiresAt })` and that `delete('appMeta', 'auth')` removes it

- [x] Inject `IdbService` into `AuthService` (AC: 1, 2, 3, 5)
  - [x] In `src/app/core/services/auth.service.ts`, add `private readonly idb = inject(IdbService);` alongside the existing `notification`, `router`, `syncQueue`, `config` injects
  - [x] Import: `import { IdbService, PersistedAuth } from './idb.service';`
  - [x] No circular dependency risk — `IdbService` does not depend on `AuthService`

- [x] Add `AUTH_KEY` constant and remove `SESSION_EXPIRY_KEY` writes (AC: 1, 5)
  - [x] Add module-level: `const AUTH_KEY = 'auth';` (the string IDB key under `appMeta`)
  - [x] Keep `SESSION_EXPIRY_KEY = 'auth_session_expiry'` for ONE release as a legacy-cleanup constant (read-then-remove on first boot to clear stale `sessionStorage` from previous installs); document this in Dev Notes and mark for deletion in a later cleanup story
  - [x] DO NOT call `sessionStorage.setItem(SESSION_EXPIRY_KEY, ...)` anywhere after this change — IDB is the only durable store for the access token

- [x] Rewrite `AuthService.init()` boot chain — restore from IDB, attempt silent re-auth, never reject (AC: 2, 3, 4, 6, 7, 9)
  - [x] Read the persisted record once at the top of `init()`:
    ```typescript
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

        // Path B: no persisted token, OR expired/malformed — purge stale record and try silent re-auth
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
    ```
  - [x] Add `private async readPersistedAuth(): Promise<PersistedAuth | null>` helper:
    - [x] Calls `this.idb.get<PersistedAuth>('appMeta', AUTH_KEY)`
    - [x] Returns `null` if the record is `undefined`, missing fields, has non-string `accessToken`, has non-finite `expiresAt`, or has `expiresAt <= 0` (malformed sentinel — AC7)
    - [x] Caller is responsible for the "expired but well-formed" purge; this helper only filters structural malformation
  - [x] Add `private async attemptBootSilentReauth(): Promise<void>`:
    ```typescript
    private async attemptBootSilentReauth(): Promise<void> {
      if (this._isRefreshInProgress) return; // AC9 — reuse Story 1.3 guard
      this._isRefreshInProgress = true;
      try {
        await this.attemptSilentRefresh(); // GIS prompt: '' (silent iframe path — see Note below)
        if (!this.isAuthenticated()) {
          // GIS responded but no token (no Google session cookie, account revoked)
          this.notification.showError({
            type: 'AUTH_SILENT_REAUTH_FAILED',
            reason: 'no-google-session',
            message: 'Your session has expired. Please sign in again.',
          });
          await this.idb.delete('appMeta', AUTH_KEY);
          this.isReauthPending.set(true);
          this.router.navigate(['/auth']);
        }
        // Success path: handleTokenResponse already persisted the new token + scheduled refresh
      } catch {
        this.notification.showError({
          type: 'AUTH_SILENT_REAUTH_FAILED',
          reason: 'unknown',
          message: 'Your session has expired. Please sign in again.',
        });
        await this.idb.delete('appMeta', AUTH_KEY);
        this.isReauthPending.set(true);
        this.router.navigate(['/auth']);
      } finally {
        this._isRefreshInProgress = false;
      }
    }
    ```
  - [x] **GIS `prompt` value note:** the AC text mentions `prompt: 'none'`. The existing `attemptSilentRefresh()` uses `prompt: ''` (empty string), which is the GIS Token Client convention for silent iframe refresh — `'none'` is the OIDC convention used by `google.accounts.id.prompt()`, NOT by `oauth2.initTokenClient`. This story REUSES `attemptSilentRefresh()` as-is; `prompt: ''` already means "don't show UI" for the Token Client. Document this in Dev Notes so future readers do not "fix" the empty string to `'none'`.

- [x] Rewrite `setSession()` / `handleTokenResponse()` to persist to IDB instead of `sessionStorage` (AC: 1)
  - [x] In `handleTokenResponse()`, REPLACE the line `sessionStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));` with a fire-and-forget IDB write:
    ```typescript
    const persisted: PersistedAuth = { accessToken: response.access_token, expiresAt };
    this.idb.set<PersistedAuth>('appMeta', AUTH_KEY, persisted).catch((err) => {
      // IDB write failure must not break the auth flow — the in-memory token still works
      // for the current session; the user just won't get persistent re-auth on next launch.
      this.notification.showError({
        type: 'IDB_ERROR',
        message: err instanceof Error ? err.message : 'Failed to persist auth token',
      });
    });
    ```
  - [x] Note: this is intentionally NOT awaited — `handleTokenResponse` is invoked from a GIS callback and historically resolves the pending promise synchronously; awaiting an IDB write would change boot timing observably. The token is in memory the moment `_user.set(...)` runs; persistence is a best-effort cache.
  - [x] DO NOT remove the `sessionStorage.removeItem(SESSION_EXPIRY_KEY)` call inside the `if (response.error && wasSignInContext)` branch — that's defensive cleanup of any leftover legacy value and remains correct.
  - [x] If you find the existing code uses a separate `setSession(...)` private method (it does not as of master `auth.service.ts:225`), wrap the IDB write into that helper. Otherwise leave the change inline in `handleTokenResponse()`.

- [x] Extend `signOut()` to clear persisted auth from IDB (AC: 5)
  - [x] In `signOut()`, add `this.idb.delete('appMeta', AUTH_KEY).catch(() => {});` before the existing `_user.set(null)` line (or directly after — order does not matter; both must complete before navigation)
  - [x] Keep the existing `sessionStorage.removeItem(SESSION_EXPIRY_KEY)` defensively for the legacy-install cleanup window
  - [x] Updated method shape:
    ```typescript
    signOut(): void {
      if (this._refreshTimerId !== null) {
        clearTimeout(this._refreshTimerId);
        this._refreshTimerId = null;
      }
      this._user.set(null);
      this.isReauthPending.set(false);
      this.idb.delete('appMeta', AUTH_KEY).catch(() => {}); // NEW — AC5
      sessionStorage.removeItem(SESSION_EXPIRY_KEY); // legacy cleanup, scheduled for removal
      this.router.navigate(['/auth']);
    }
    ```

- [x] APP_INITIALIZER ordering — confirm `auth.init()` runs BEFORE Story 2.6's `hydration.init()` (AC: 6)
  - [x] In `src/app/app.config.ts`, the existing chain is:
    ```
    config.load() → auth.init() → categories.init() → entries.init() → syncQueue.init()
    ```
  - [x] Story 2.6 appends `→ hydration.init()` at the end. Story 2.7 makes `auth.init()` slower in the cold-boot-with-expired-token path (one GIS round-trip); the existing position at index 1 of the chain is correct — no reordering needed. Document the explicit ordering in Dev Notes.
  - [x] If 2.6 lands first, no app.config.ts edits are needed in 2.7. If 2.7 lands first, only the `auth.init()` body changes — the chain shape is unchanged.

- [x] Update `auth.service.spec.ts` with Story 2.7 test cases (AC: 2, 3, 4, 5, 7, 9)
  - [x] Add an `idbSpy` to the `beforeEach` setup: `idbSpy = { get: vi.fn().mockResolvedValue(undefined), set: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) };` and provide it via `{ provide: IdbService, useValue: idbSpy }`
  - [x] Test: `init() with valid persisted token — restores _user, no auth UI, schedules refresh`
    - [x] `idbSpy.get.mockResolvedValue({ accessToken: 'tok', expiresAt: Date.now() + 30*60*1000 })`
    - [x] Assert `service.isAuthenticated() === true` after `init()`, no `notification.showError` call, no `router.navigate(['/auth'])`, `idbSpy.delete` not called
  - [x] Test: `init() with expired persisted token + valid Google session — silent re-auth, no UI`
    - [x] `idbSpy.get.mockResolvedValue({ accessToken: 'old', expiresAt: Date.now() - 1000 })`
    - [x] `setupGisMock({ callbackWithToken: true })` — silent iframe returns a fresh token
    - [x] Assert `idbSpy.delete` called once for the stale record, `idbSpy.set` called once with the new token, `service.isAuthenticated() === true`, no navigation to `/auth`
  - [x] Test: `init() with expired persisted token + revoked Google session — AUTH_SILENT_REAUTH_FAILED, route to /auth`
    - [x] `idbSpy.get.mockResolvedValue({ accessToken: 'old', expiresAt: Date.now() - 1000 })`
    - [x] `setupGisMock({ callbackWithToken: false })` — GIS reports `error: 'access_denied'`
    - [x] Assert `notification.showError` called with `{ type: 'AUTH_SILENT_REAUTH_FAILED', ... }`, `idbSpy.delete` called for stale record, `router.navigate(['/auth'])` called, `service.isReauthPending() === true`
  - [x] Test: `signOut() clears persisted auth from IDB`
    - [x] After `signOut()`, assert `idbSpy.delete` called with `('appMeta', 'auth')`
  - [x] Test: `init() with malformed persisted record — purges and proceeds to silent re-auth`
    - [x] Each variant separately or via a `.each` loop: `null`, `{}`, `{ accessToken: '' }`, `{ accessToken: 'x', expiresAt: NaN }`, `{ accessToken: 'x', expiresAt: -1 }`
    - [x] Assert `idbSpy.delete` called for the (well-formed-but-stored) variants where the malformed structure was actually retrieved; assert silent re-auth path is taken (GIS `requestAccessToken` invoked once)
  - [x] Test: `attemptBootSilentReauth() respects _isRefreshInProgress guard (AC9)`
    - [x] Pre-set `(service as any)._isRefreshInProgress = true`
    - [x] Call `(service as any).attemptBootSilentReauth()`
    - [x] Assert `tokenClientMock.requestAccessToken` was NOT called
  - [x] Test: `handleTokenResponse persists token to IDB on success`
    - [x] Trigger a successful `signIn()` flow via the existing test helpers
    - [x] Assert `idbSpy.set` called with `('appMeta', 'auth', { accessToken: 'test-token-abc', expiresAt: <number> })`
  - [x] Verify `auth.service.spec.ts` does not exhaustively switch on `AppError.type` — it asserts specific cases. Adding the 10th variant requires no spec changes here other than the new tests above.

- [x] Update `notification.service.spec.ts` (if present) for the new AppError variant
  - [x] If `notification.service.spec.ts` does not exhaustively cover every `AppError` case, only add a single test for the new `AUTH_SILENT_REAUTH_FAILED` mapping
  - [x] If it does (e.g. via a `it.each` over all variants), append the new variant to the table — tests will fail compile-time on the exhaustive switch otherwise

- [x] Documentation updates in Dev Notes (AC: 8)
  - [x] Architecture doc reference (this spec only — do NOT edit `architecture.md` in this story; flag the drift in Dev Notes for a docs-sync task)
  - [x] Add the security trade-off note (see Dev Notes section "Security Trade — IDB vs sessionStorage" below) verbatim in the spec — this satisfies AC8 as a contract artifact

## Dev Notes

### What This Story Does Not Implement

- **OIDC ID-token flow** — we stay on `oauth2.initTokenClient` (Token Client), not `google.accounts.id` (ID Token / OIDC). The AC-level mention of `prompt: 'none'` is OIDC vernacular for "silent"; the Token Client equivalent is `prompt: ''`. No migration to OIDC in this story.
- **Encryption-at-rest of the IDB token** — IDB is plaintext on disk under the user's profile. SubtleCrypto-derived encryption keys would still be reachable to any same-origin JS, so encryption gives no real defence against XSS and adds complexity. Not implemented; documented as a deliberate non-goal in the security trade note below.
- **Service-worker cache of the token** — out of scope. The persistent auth UX target is "open the app, see entries"; service-worker token plumbing would be needed only for true offline write paths, which Epic 3 already owns.
- **Cross-tab token sync via `BroadcastChannel`** — single-user, single-tab assumption holds (NFR-S2). If two tabs run in parallel, both will independently read the IDB record and either find a valid token or run silent re-auth — no coordination needed. Documented for completeness.
- **Refactor of `attemptSilentRefresh()`'s `_pendingCallbacks` overwrite issue** — pre-existing from Story 1.2, deferred per Story 1.3's review log. Story 2.7 reuses `attemptSilentRefresh()` as-is.

### IDB Key Shape Decision — Single `'auth'` Record vs Split Keys

The story ACs phrase the persisted state as "key `auth.accessToken` and `auth.tokenExpiresAt`". After implementing, the cleaner shape is a SINGLE `appMeta` key `'auth'` holding `{ accessToken, expiresAt }`. Rationale:

| Concern | Single record | Split keys |
|---|---|---|
| Atomic write/read | YES — one `idb.set` / `idb.get` | NO — two reads risk seeing a half-written pair if a write was interrupted |
| Malformed-record handling (AC7) | One structural validator | Two reads, two consistency checks |
| `IdbService` overload surface | Reuses existing generic `appMeta` overload | Same — but doubles the spec/test surface |
| Consistency with Story 2.6 | Mirrors `'hydratedAt'` map pattern (one key, one composite value) | Diverges from precedent |

This is a presentation-layer interpretation: the AC's "key `auth.accessToken` and `auth.tokenExpiresAt`" is satisfied by a record with those field names. If a future story adds `refreshToken`, `tokenScope`, etc., they extend the same record — no new keys.

### Security Trade — IDB vs sessionStorage (AC8)

**Decision:** persist the access token + `expiresAt` in IDB under `appMeta.auth`. Stop using `sessionStorage` as the durable store.

**Why this is acceptable for this app:**

1. **Threat model is XSS, not disk theft.** The dominant token-exfiltration risk for a static-hosted SPA is malicious JavaScript running same-origin. Both `sessionStorage` and IDB are accessible to same-origin JS via standard APIs — there is no security boundary between them once script execution happens.
2. **No third-party scripts.** This app loads exactly one external script: the Google Identity Services library (`gsi/client`). No analytics, ad networks, A/B testing, or user-content rendering vectors. The XSS attack surface is the app's own first-party code only.
3. **Single user, single device, no shared deployment.** The app is hosted statically (GitHub Pages / Cloudflare Pages) under the user's own control; there is no multi-tenant compromise vector. A device with disk-level access is already game over for any browser-stored auth.
4. **GIS Token Client tokens are short-lived.** Access tokens expire in 1 hour. Even an exfiltrated IDB token is useful for at most 60 minutes, after which proactive refresh (Story 1.3) requires a valid Google session cookie — which lives in HttpOnly Google domain cookies, not in IDB.
5. **The UX win is large.** Without persistent auth, every cold launch redirects to `/auth` and forces a manual sign-in even though the user's Google session is valid. This undermines the local-first promise of the app — entries are visible only after an auth roundtrip.

**Why we are NOT using a more secure store:**

- **HttpOnly cookies** require a server. This app has no server.
- **Web Crypto-encrypted IDB** offers no real protection — the encryption key has to live somewhere reachable by same-origin JS, and the token is in memory the moment we use it.
- **Service Worker–scoped storage** is also reachable from same-origin JS via `caches.match()` and similar; same threat model.

**This is a deliberate trade, not an oversight.** Documented here so future reviewers understand the choice and so a future "lock down auth" story (if real multi-user concerns ever emerge) can revisit it from this baseline.

### `AppError` Discriminated Union — 9 → 10 Variants

The architecture doc currently shows 9 variants (it actually shows 8 in the architecture excerpt at lines 266–274, but `error.model.ts` carries the canonical 9 with the recently-added `SCHEMA_MISMATCH` and `UNKNOWN_ERROR`). Story 2.7 adds the 10th:

```typescript
| { type: 'AUTH_SILENT_REAUTH_FAILED'; reason: 'no-google-session' | 'network' | 'gis-error' | 'timeout' | 'unknown'; message: string }
```

The `reason` discriminator on the inner level lets the UI / observability layer distinguish "user revoked access" (no-google-session) from "transient network blip" (network) without parsing free-text messages. Stories 3.x that want offline-recovery UX can branch on `reason === 'network'` to retry rather than route to `/auth`.

`NotificationService.appErrorToMessage()` exhaustively switches on `error.type` — the new case is mandatory; TypeScript will fail compile until it is added. Spec spread risk is low: only `notification.service.ts` has an exhaustive switch in the current codebase. `auth.service.spec.ts` and `sheets.service.spec.ts` assert specific cases without an exhaustive `it.each` over the union, so they pick up the new variant only via the new tests this story adds.

### `AuthService.init()` Boot Chain — Three Paths

After this story, `AuthService.init()` has three deterministic paths:

```
init()
 │
 ├── No Google Client ID configured → return immediately (existing behaviour)
 │
 ├── Path A: persisted token in IDB AND expiresAt > now
 │   ├── Set in-memory _user
 │   ├── Load GIS script + setupTokenClient (so Story 1.3's proactive refresh can fire later)
 │   ├── scheduleTokenRefresh(expiresAt)
 │   └── Return — no auth UI, no GIS round-trip
 │
 └── Path B: no persisted token OR expired/malformed
     ├── Purge stale IDB record (if it existed)
     ├── Load GIS script + setupTokenClient
     └── attemptBootSilentReauth()
         ├── Success (handleTokenResponse persists new token + schedules refresh)
         │   └── Return — no auth UI
         └── Failure
             ├── Emit AppError.AUTH_SILENT_REAUTH_FAILED
             ├── Purge IDB
             ├── isReauthPending.set(true)
             └── router.navigate(['/auth']) — banner from Story 1.3 shows
```

`init()` MUST NOT throw. The outer `try/catch` swallows everything; the only user-visible failure mode is the `/auth` redirect. This matches the existing Story 1.3 contract.

### `AuthService` New / Changed Methods Summary

| Method | Change |
|---|---|
| `init()` | REWRITTEN — see "Three Paths" above |
| `attemptBootSilentReauth()` | NEW — private, called only from `init()`. Reuses `_isRefreshInProgress`. |
| `readPersistedAuth()` | NEW — private helper, structural validation of the IDB record |
| `handleTokenResponse()` | UPDATED — replace `sessionStorage.setItem(SESSION_EXPIRY_KEY, ...)` with `idb.set('appMeta', 'auth', ...)`; everything else unchanged |
| `signOut()` | UPDATED — add `idb.delete('appMeta', AUTH_KEY)` |
| `scheduleTokenRefresh()` | UNCHANGED — Story 1.3 implementation correct as-is |
| `triggerProactiveRefresh()` | UNCHANGED |
| `handleUnauthorized()` | UNCHANGED |
| `attemptSilentRefresh()` | UNCHANGED — reused for boot-time silent re-auth (note: `prompt: ''` is the GIS Token Client silent convention; do not change to `'none'`) |

No public-API method renames. The `isAuthenticated`, `isReauthPending`, `getAccessToken`, `signIn`, `signOut`, `handleUnauthorized` surface stays identical to Story 1.3.

### APP_INITIALIZER Ordering — Auth First, Hydration Last

```
config.load()            // ConfigService — fetches /public/config.json
  → auth.init()           // Story 2.7 — restore from IDB or attempt silent re-auth
  → categories.init()     // Story 1.5 — seed categories
  → entries.init()        // Story 2.1 — load entries from IDB into signal
  → syncQueue.init()      // Story 1.1 — load queue from IDB
  → hydration.init()      // Story 2.6 — fetch year tabs from Sheets, write to IDB
```

Why `auth.init()` is FIRST (after `config.load()`):
- Every downstream service that hits Sheets needs a valid bearer token in memory
- `categories.init()` calls `seedFromSheet` (Story 1.5) which goes through the auth interceptor
- `hydration.init()` (Story 2.6) explicitly calls `SheetsService.listYearTabs()` and `readTabDataRows()`
- `entries.init()` and `syncQueue.init()` are IDB-only and do not strictly require auth, but running them after `auth.init()` is consistent and harmless

Why `hydration.init()` is LAST:
- Its read load (one HTTP call per year tab) must not delay the proactive-refresh timer scheduling
- It writes to the same `entries` IDB store that `entries.init()` just read — running it after `entries.init()` means the next `EntriesService.refreshFromIdb()` call (which 2.6 invokes per tab) sees the already-loaded base set
- See Story 2.6 Dev Notes for the full rationale

### `_isRefreshInProgress` Guard Reuse (AC9)

The existing `_isRefreshInProgress: boolean` field on `AuthService` (Story 1.3) prevents two concurrent silent-refresh attempts. Story 2.7's `attemptBootSilentReauth()` MUST set/clear this flag in a `try / finally` so that:

- A 401 firing on a stray Sheets call during boot does not spawn a second `requestAccessToken({ prompt: '' })` round-trip
- Background/foreground tab events that re-enter `init()` (they do not in current code, but a future tab-visibility change handler might) cannot duplicate the in-flight attempt

`handleUnauthorized()` already short-circuits to `EMPTY` when `_isRefreshInProgress` is set, so no changes are needed there.

### Malformed Persisted Token Handling (AC7)

The `readPersistedAuth()` helper validates structurally:

```typescript
private async readPersistedAuth(): Promise<PersistedAuth | null> {
  const raw = await this.idb.get<PersistedAuth>('appMeta', AUTH_KEY);
  if (!raw) return null;
  if (typeof raw.accessToken !== 'string' || raw.accessToken.length === 0) return null;
  if (typeof raw.expiresAt !== 'number' || !Number.isFinite(raw.expiresAt) || raw.expiresAt <= 0) {
    return null;
  }
  return raw;
}
```

- Returns `null` for: missing record, missing fields, non-string token, non-finite expiry, zero/negative expiry
- Returns the record (still possibly past-expiry) for: well-formed but expired tokens — the caller (`init()`) handles the "expired but well-formed → silent re-auth" path
- A `null` return triggers `init()`'s purge-and-fall-through path so the next signed-in handshake gets a clean slate

`init()` calls `idb.delete('appMeta', AUTH_KEY)` whenever a malformed record was read OR an expired well-formed record was read — the IDB record never holds invalid state past the start of `init()`.

### Boot Race — `loadGisScript()` and IDB Read

`init()` reads the IDB record BEFORE `loadGisScript()` deliberately. Reasons:

- Path A (valid token) skips the silent refresh entirely — but still needs GIS loaded so the proactive-refresh timer can fire later. Loading GIS in Path A is required.
- Reading IDB first lets Path A short-circuit silent re-auth, avoiding a 10-second timeout race against `loadGisScript()`'s script-tag insertion
- The IDB read is fast (single record, single key lookup); the GIS script load is network-bound

This ordering is intentional. Do not reverse it to "match the old code" — the old code did not have an IDB read.

### Files to Create / Modify

| File | Action |
|---|---|
| `src/app/core/models/error.model.ts` | UPDATE — add `AUTH_SILENT_REAUTH_FAILED` variant (10th) |
| `src/app/core/services/notification.service.ts` | UPDATE — add `case 'AUTH_SILENT_REAUTH_FAILED'` arm to exhaustive switch |
| `src/app/core/services/idb.service.ts` | UPDATE — export `PersistedAuth` interface; widen `delete()` overload to include `'appMeta'` |
| `src/app/core/services/auth.service.ts` | UPDATE — add `IdbService` inject, `AUTH_KEY` const, rewrite `init()`, add `attemptBootSilentReauth()`, add `readPersistedAuth()`, IDB write in `handleTokenResponse()`, IDB delete in `signOut()` |
| `src/app/core/services/auth.service.spec.ts` | UPDATE — add `idbSpy`, add test cases listed in Tasks |
| `src/app/core/services/idb.service.spec.ts` | UPDATE — add round-trip and delete test for `('appMeta', 'auth')` |
| `src/app/core/services/notification.service.spec.ts` | UPDATE if it exists and exhaustively switches over `AppError` |
| `src/app/app.config.ts` | NO CHANGE — existing `auth.init()` ordering at index 1 of the chain is correct |

### Project Invariants Reaffirmed

- Angular 21 standalone + signals + OnPush — no changes to component layer in this story
- `AppError` discriminated union — never throw raw `Error` from services (the new variant follows the same pattern)
- `IdbService` is the SOLE `idb` importer — `AuthService` must NOT import `idb` directly; it goes through `IdbService.get`/`set`/`delete`
- `NotificationService` is the SOLE `MatSnackBar` path — the new AppError surfaces via `notification.showError(...)` only
- Services `providedIn: 'root'` — `AuthService` already is; no provider changes
- Run tests via `ng test --watch=false` (NOT `npx vitest run` directly — same Story 1.3 caveat)

### Testing Strategy Summary

| Scenario | Test Location | What It Verifies |
|---|---|---|
| Cold boot with valid persisted token (no UI) | `auth.service.spec.ts` | AC2 — Path A: no GIS round-trip, `_user` populated, refresh scheduled |
| Cold boot with expired token + valid Google session | `auth.service.spec.ts` | AC3 — Path B success: silent iframe returns token, IDB updated, no `/auth` route |
| Cold boot with expired token + revoked Google session | `auth.service.spec.ts` | AC4 — Path B failure: `AUTH_SILENT_REAUTH_FAILED`, IDB cleared, route to `/auth` |
| Sign-out clears IDB | `auth.service.spec.ts` | AC5 — `idbSpy.delete` called with `('appMeta', 'auth')` |
| Malformed persisted state purge | `auth.service.spec.ts` | AC7 — `readPersistedAuth` returns null for each shape; init purges and falls through |
| `_isRefreshInProgress` guard during boot | `auth.service.spec.ts` | AC9 — pre-set guard blocks second `requestAccessToken` call |
| `handleTokenResponse` persists to IDB | `auth.service.spec.ts` | AC1 — `idbSpy.set` called with the right shape on every successful token |
| IDB round-trip for `('appMeta', 'auth')` | `idb.service.spec.ts` | Confirms generic overload covers the new key without code changes |
| New `AppError` variant message mapping | `notification.service.spec.ts` | New case returns expected user-facing string |

### References

- Story 1.3 spec (in-session silent refresh + 401 handling — the foundation 2.7 builds on): [Source: `_bmad-output/implementation-artifacts/1-3-token-refresh-and-re-authentication-resilience.md`]
- Story 1.2 spec (initial GIS Token Client setup, `SILENT_REFRESH_TIMEOUT_MS`): [Source: `_bmad-output/implementation-artifacts/1-2-google-oauth-authentication-flow.md`]
- Story 2.6 spec (`appMeta` extension precedent, boot-chain sequencing precedent): [Source: `.claude/worktrees/2.6/_bmad-output/implementation-artifacts/2-6-multi-year-entry-hydration-on-first-sheet-connect.md`]
- Story 2.7 epic section (this story's ACs verbatim): [Source: `_bmad-output/planning-artifacts/epics/epic-2-expense-entry-local-first-core.md` — Story 2.7]
- `AppError` current 9 variants: [Source: `src/app/core/models/error.model.ts`]
- `AuthService` current implementation (post-1.3): [Source: `src/app/core/services/auth.service.ts`]
- `IdbService` overload pattern (`appMeta` generic): [Source: `src/app/core/services/idb.service.ts:62-93`]
- `NotificationService.appErrorToMessage()` exhaustive switch: [Source: `src/app/core/services/notification.service.ts:34-57`]
- APP_INITIALIZER chain shape: [Source: `src/app/app.config.ts`]
- Architecture — `appMeta` IDB store contents: [Source: `_bmad-output/planning-artifacts/architecture.md` line 220]
- Architecture — `AppError` union (currently shows fewer variants than `error.model.ts` — drift; flag a docs-sync task): [Source: `_bmad-output/planning-artifacts/architecture.md` lines 262–275]
- Project invariants (`IdbService` sole importer, `NotificationService` sole snackbar): [Source: `.claude/worktrees/2.7/CLAUDE.md` and `_bmad-output/planning-artifacts/architecture.md`]
- Test runner: `ng test --watch=false` not `npx vitest run`: [Source: `_bmad-output/implementation-artifacts/1-2-google-oauth-authentication-flow.md`]

### Review Findings

- [x] [Review][Patch] Malformed non-null IDB records not purged — AC7 violation [src/app/core/services/auth.service.ts:readPersistedAuth] — **Fixed:** `readPersistedAuth()` now calls `idb.delete` before returning null for malformed records; test updated to assert delete is called for non-null malformed inputs
- [x] [Review][Patch] E2E test A-01 uses `waitForTimeout(500)` — flaky on slow CI [e2e/auth.spec.ts:33] — **Fixed:** replaced with `waitForLoadState('networkidle', { timeout: 5_000 })`
- [x] [Review][Patch] Path A test missing `setupTokenClient` mock — `setupTokenClient()` throws without `window.google` [src/app/core/services/auth.service.spec.ts:145] — **Fixed:** added `setupSpy` mock alongside existing `loadSpy` and `scheduleSpy`
- [x] [Review][Defer] Double `idb.delete` on Path B failure — init() deletes expired record then attemptBootSilentReauth catch deletes again; harmless (IDB no-op on absent key) — deferred, pre-existing design
- [x] [Review][Defer] `_isRefreshInProgress` not reset in `triggerProactiveRefresh` path — pre-existing from Story 1.3 — deferred, pre-existing
- [x] [Review][Defer] `handleUnauthorized` `finalize()` may not clear flag if observable never completes — pre-existing from Story 1.3 — deferred, pre-existing
- [x] [Review][Defer] Concurrent `init()` calls race between IDB read and flag set — single-tab assumption holds (NFR-S2) — deferred, theoretical
- [x] [Review][Defer] E2E IDB seed uses hard-coded `version: 1` — pre-existing pattern across all E2E helpers — deferred, pre-existing
- [x] [Review][Defer] `error.model.ts` variant count in spec says "9→10" but actual count is higher (Stories 5.3 added variants) — spec doc drift — deferred, doc-only

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation followed the story spec exactly without deviations.

### Completion Notes List

- Added `AUTH_SILENT_REAUTH_FAILED` as the 10th `AppError` variant in `error.model.ts`; `NotificationService.appErrorToMessage()` exhaustive switch extended with the new case
- Exported `PersistedAuth` interface from `idb.service.ts`; widened `delete()` overload to include `'appMeta'`
- Injected `IdbService` into `AuthService`; added `AUTH_KEY = 'auth'` constant; kept `SESSION_EXPIRY_KEY` for legacy cleanup only (no more `setItem` calls)
- Rewrote `init()` with three-path boot chain: Path A (valid persisted token → restore, no GIS round-trip), Path B (expired/absent → purge + `attemptBootSilentReauth()`)
- Added `readPersistedAuth()` — structural validator that filters null/empty/non-finite/zero/negative values; returns well-formed-but-expired records for caller to handle
- Added `attemptBootSilentReauth()` — reuses `_isRefreshInProgress` guard (AC9), emits `AUTH_SILENT_REAUTH_FAILED` on failure, clears IDB, routes to `/auth`
- `handleTokenResponse()` replaced `sessionStorage.setItem` with fire-and-forget `idb.set<PersistedAuth>()` — not awaited (GIS callback timing)
- `signOut()` now calls `idb.delete('appMeta', AUTH_KEY)` in addition to existing cleanup
- `app.config.ts` confirmed untouched — `auth.init()` is already at index 1 of the boot chain
- `notification.service.spec.ts` does not exist — no changes required
- All 364 tests pass (25 test files)

### File List

- `src/app/core/models/error.model.ts` — added `AUTH_SILENT_REAUTH_FAILED` (10th variant)
- `src/app/core/services/notification.service.ts` — added `case 'AUTH_SILENT_REAUTH_FAILED'` arm
- `src/app/core/services/idb.service.ts` — exported `PersistedAuth`; widened `delete()` to include `'appMeta'`
- `src/app/core/services/auth.service.ts` — full Story 2.7 implementation (IdbService inject, new constants, rewritten `init()`, new `readPersistedAuth()`, new `attemptBootSilentReauth()`, IDB write in `handleTokenResponse()`, IDB delete in `signOut()`)
- `src/app/core/services/auth.service.spec.ts` — added `idbSpy`, Story 2.7 test suite (Path A, Path B success/failure, malformed record variants, sign-out IDB clear, `_isRefreshInProgress` guard, `handleTokenResponse` persists to IDB)
- `src/app/core/services/idb.service.spec.ts` — added `appMeta/auth` round-trip and delete tests; imported `PersistedAuth`

## Change Log

- 2026-05-09: Story implemented. All 9 ACs satisfied; 364 tests pass. IDB-backed persistent auth replaces sessionStorage. New `AUTH_SILENT_REAUTH_FAILED` AppError variant (10th). Boot chain: Path A (valid IDB token → silent restore), Path B (expired/absent → silent GIS re-auth). `_isRefreshInProgress` guard reused for boot-time concurrency (AC9). `handleTokenResponse` persists token to IDB fire-and-forget. `signOut()` clears IDB. `app.config.ts` ordering confirmed unchanged.
- 2026-05-09: Story drafted. Closes the cold-launch UX gap left by Story 1.3 — persists access token + expiry to IDB (`appMeta.auth` single-record key) so they survive tab close, and adds a boot-time silent re-auth path via the existing `attemptSilentRefresh()` (GIS `prompt: ''` Token Client convention, NOT OIDC `prompt: 'none'`). Introduces `AppError.AUTH_SILENT_REAUTH_FAILED` as the 10th discriminated-union variant. Reuses Story 1.3's `_isRefreshInProgress` guard for boot-time concurrency. Reuses Story 2.6's `appMeta` extension pattern. Documents the IDB-vs-sessionStorage XSS trade-off explicitly (AC8) — small security delta for a single-user, no-third-party-script SPA, justified by the persistent-auth UX contract. APP_INITIALIZER ordering: `auth.init()` stays at index 1 (immediately after `config.load()`); `hydration.init()` (Story 2.6) remains at the end of the chain.
