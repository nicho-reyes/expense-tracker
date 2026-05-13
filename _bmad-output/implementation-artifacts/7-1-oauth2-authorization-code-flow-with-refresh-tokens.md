# Story 7.1: OAuth2 Authorization Code Flow with Refresh Tokens

Status: ready-for-dev

Priority: **Nice-to-have / Non-blocker** — implement only after all Epics 1–6 are complete.

## Story

As Nick,
I want the app to silently refresh my Google session indefinitely without ever prompting me to sign in again,
so that I never need to re-authenticate manually as long as I haven't explicitly revoked access.

## Background & Motivation

The current GIS token flow (`initTokenClient` / `requestAccessToken`) is an implicit grant — it issues 1-hour access tokens with no refresh token. Silent re-auth (`requestAccessToken({ prompt: '' })`) works only while the user's Google session cookie is alive (~14 days of inactivity before Google expires it). Once the cookie is gone, the user must manually sign in again.

The authorization code flow solves this permanently: the backend exchanges the authorization code for a `{access_token, refresh_token}` pair. The refresh token never expires (unless revoked) and lives server-side. The backend silently mints new access tokens on demand. The frontend never sees the refresh token.

**Trade-off:** This requires adding a backend service (Cloud Function or Cloud Run) and routing all Sheets API calls through a proxy. This is a significant architectural change from the "no backend" constraint in the original architecture — only viable once core functionality is stable.

## Acceptance Criteria

1. **Given** I open the app for the first time (or after revoking) **When** I sign in **Then** the GIS code flow (`requestCode`) triggers, the backend receives the authorization code, exchanges it for tokens, and stores the refresh token server-side — I am redirected back to the app fully authenticated
2. **Given** my 1-hour access token expires **When** the app (or backend proxy) detects expiry **Then** the backend automatically uses the stored refresh token to mint a new access token with no user interaction and no re-authentication prompt
3. **Given** I have been away from the app for more than 14 days **When** I return **Then** the backend silently refreshes the access token using the stored refresh token and the app loads normally without any sign-in screen
4. **Given** all Sheets API calls are now proxied **When** the frontend makes a Sheets read or write **Then** the request goes to the backend proxy endpoint, not directly to `sheets.googleapis.com`, and the backend attaches the current access token
5. **Given** I explicitly revoke app access from my Google account settings **When** I next open the app **Then** the backend detects the revoked token (HTTP 401 from Google on refresh attempt), clears the stored token, and redirects me to the sign-in screen

## Tasks / Subtasks

### Backend (new service — Cloud Function Gen 2 or Cloud Run)

- [ ] Set up backend project scaffold (AC: 1)
  - [ ] Create `backend/` folder at project root (Node.js / TypeScript, or Python)
  - [ ] Add OAuth2 client credentials to backend environment (never exposed to frontend): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - [ ] Add `SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'` constant
  - [ ] Provision a per-user storage for refresh tokens (Firestore collection `users/{userId}/tokens` or equivalent)

- [ ] Implement `/auth/callback` endpoint (AC: 1)
  - [ ] Accept POST with `{ code, redirect_uri }` from frontend
  - [ ] POST to `https://oauth2.googleapis.com/token` with `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `redirect_uri`
  - [ ] Receive `{ access_token, refresh_token, expires_in, id_token }`
  - [ ] Extract `sub` (user ID) from `id_token` JWT payload (no library needed — just base64-decode the middle segment)
  - [ ] Store `{ refresh_token, userId }` in Firestore (or equivalent); never return the refresh token to the client
  - [ ] Issue a signed, HttpOnly session cookie or short-lived JWT to the frontend containing only `userId` and `expiresAt`
  - [ ] Return `{ accessToken, expiresAt }` to the frontend for immediate use

- [ ] Implement `/api/sheets` proxy endpoint (AC: 4)
  - [ ] Accept any Sheets API request from the authenticated frontend (method, path, headers, body forwarded)
  - [ ] Validate the session cookie / JWT to identify the user
  - [ ] Look up the user's stored refresh token; if access token cached and not expired, use it; otherwise POST to `https://oauth2.googleapis.com/token` with `grant_type=refresh_token` to get a new one (AC: 2, 3)
  - [ ] Forward the request to `https://sheets.googleapis.com` with the current access token attached
  - [ ] If Google returns 401 on the refresh attempt → delete stored token → return 401 to frontend (triggers sign-in flow) (AC: 5)
  - [ ] Cache the new access token in memory (or Firestore) with its `expiresAt` to avoid redundant refresh calls

- [ ] CORS and security hardening
  - [ ] Restrict CORS to the frontend origin only
  - [ ] Validate all requests carry a valid session credential before proxying
  - [ ] Never log or expose `refresh_token` or `access_token` values

### Frontend changes

- [ ] Replace GIS token client with code client (AC: 1)
  - [ ] In `AuthService`, replace `initTokenClient` / `requestAccessToken` with `initCodeClient` / `requestCode`
  - [ ] `initCodeClient` config: `{ client_id, scope: SHEETS_SCOPE, ux_mode: 'popup', callback: handleCodeResponse }`
  - [ ] In `handleCodeResponse`, POST `{ code }` to the backend `/auth/callback` endpoint; receive `{ accessToken, expiresAt }` in response
  - [ ] Set `_user.set({ accessToken, expiresAt })` and persist to IDB as before
  - [ ] Remove all `attemptSilentRefresh` / `attemptBootSilentReauth` logic — silent refresh is now backend-side
  - [ ] Remove `SILENT_REFRESH_TIMEOUT_MS` constant (no longer needed)
  - [ ] Keep `scheduleTokenRefresh` but change it to POST to backend `/api/auth/refresh` (no-op if backend handles it transparently via the proxy) OR remove it entirely if proxy is stateless-refresh

- [ ] Replace direct Sheets API calls with proxy calls (AC: 4)
  - [ ] In `SheetsService`, change the base URL from `https://sheets.googleapis.com/v4/spreadsheets` to `/api/sheets/v4/spreadsheets` (the backend proxy path)
  - [ ] Remove `Authorization: Bearer` header injection from `AuthInterceptor` for Sheets requests — the backend handles auth
  - [ ] Update `AuthInterceptor`: strip auth header for proxied requests; the session cookie is sent automatically (HttpOnly)
  - [ ] On 401 from the proxy: call `AuthService.handleUnauthorized()` as before — this now means the backend's refresh token was revoked

- [ ] Update `AuthService.init()` boot sequence (AC: 2, 3)
  - [ ] On boot, POST to `/api/auth/status` to check if the backend session is valid (backend tries refresh internally if needed)
  - [ ] If valid: set `_user` signal with returned `{ accessToken, expiresAt }`; proceed normally
  - [ ] If invalid (no session, or refresh failed): clear IDB auth, set `isReauthPending = false`, let `authGuard` redirect to `/auth`
  - [ ] Remove `readPersistedAuth` / `attemptBootSilentReauth` — replaced by `/api/auth/status` check

- [ ] Update E2E tests
  - [ ] Mock the backend endpoints in Playwright (`page.route('/api/auth/*', ...)` and `page.route('/api/sheets/*', ...)`)
  - [ ] Update auth spec: sign-in now completes via code flow callback, not GIS popup mock

## Dev Notes

### Current Architecture Being Replaced

The existing auth flow lives entirely in `src/app/core/services/auth.service.ts` and uses GIS implicit token grant:
- `initTokenClient` + `requestAccessToken({ prompt: '' })` for silent re-auth at boot
- 1-hour tokens persisted to IDB (`appMeta['auth']`)
- `scheduleTokenRefresh` fires 5 min before expiry, retries silently
- `attemptSilentRefresh` with a 20-second timeout (recently bumped from 10s)
- All Sheets calls go directly to `https://sheets.googleapis.com` via `AuthInterceptor` which injects `Bearer` tokens

All of this changes. The new flow is:
1. Frontend requests a code via `requestCode`
2. Backend exchanges code → stores refresh token → returns access token
3. All Sheets calls hit `/api/sheets/...` proxy; backend adds auth
4. Backend refreshes access token transparently when needed

### GIS Code Client API (Frontend)

```typescript
// Replace initTokenClient with:
this.tokenClient = window.google.accounts.oauth2.initCodeClient({
  client_id: this.config.googleClientId,
  scope: SHEETS_SCOPE,
  ux_mode: 'popup',
  callback: (response: { code: string; error?: string }) =>
    this.handleCodeResponse(response),
});

// Replace requestAccessToken with:
this.tokenClient.requestCode();
```

The `callback` fires with `{ code }` on success or `{ error }` on failure/cancel. The code is a one-time-use string that must be sent to the backend immediately.

### Backend Token Exchange

POST to Google's token endpoint:
```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

code=AUTH_CODE_HERE
&client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
&redirect_uri=REDIRECT_URI
&grant_type=authorization_code
```

Response: `{ access_token, refresh_token, expires_in, token_type, id_token }`

`refresh_token` is only present on first grant or after explicit revocation + re-consent. Store it; it does not expire unless revoked.

### Backend Token Refresh

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
&refresh_token=STORED_REFRESH_TOKEN
&grant_type=refresh_token
```

Response: `{ access_token, expires_in }` (no new refresh token — original is still valid).

### Deployment Options (Cheapest First)

| Option | Notes |
|---|---|
| Cloud Functions Gen 2 (Node.js) | Free tier covers ~2M invocations/month; cold starts acceptable for single-user |
| Cloud Run | Always-on option; min-instances=1 avoids cold starts; more expensive |
| Vercel Edge Functions | Simple deploy if already on Vercel; KV store for refresh tokens |
| Netlify Functions | Similar to Vercel; easy if frontend is on Netlify |

For a single-user app, Cloud Functions Gen 2 with Firestore is the simplest production-grade choice.

### Refresh Token Storage in Firestore

```
/users/{googleUserId}/session:
  {
    refresh_token: "1//...",          // encrypted at rest by Firestore
    access_token_cache: "ya29...",    // current access token
    access_token_expires_at: 1234567890000
  }
```

The `googleUserId` is the `sub` claim from the `id_token` JWT.

### Files to Create / Modify

| File | Action |
|---|---|
| `backend/` | CREATE — new backend service (Cloud Function or similar) |
| `backend/src/auth.ts` | CREATE — `/auth/callback` and `/auth/status` handlers |
| `backend/src/proxy.ts` | CREATE — `/api/sheets` proxy handler |
| `src/app/core/services/auth.service.ts` | UPDATE — replace token client with code client; remove silent refresh; add `/api/auth/status` boot check |
| `src/app/core/services/sheets.service.ts` | UPDATE — change base URL to proxy path |
| `src/app/core/interceptors/auth.interceptor.ts` | UPDATE — remove Bearer injection; pass session cookie |
| `src/environments/environment.ts` | UPDATE — add `sheetsProxyBaseUrl` |
| `e2e/auth.spec.ts` | UPDATE — mock backend endpoints |

### What This Story Does NOT Change

- `EntriesService`, `IdbService`, `CategoriesService` — no changes
- IDB schema and local persistence — unchanged
- All Angular components and UI — unchanged
- `SyncQueueService` — unchanged (sync queue writes still go through Sheets proxy, just at a different URL)
- PWA/service worker configuration — unchanged

### Architectural Constraint Note

The original architecture spec (`architecture.md`) explicitly requires **"No backend server: pure SPA communicating directly with Google Sheets API v4"**. This story intentionally violates that constraint. It should only be implemented if the session expiry UX becomes genuinely painful in production. The constraint existed to keep the deployment simple; adding even a minimal Cloud Function changes the operational complexity.

### References

- GIS Code Model: [https://developers.google.com/identity/oauth2/web/guides/use-code-model]
- Google OAuth2 token endpoint: [https://developers.google.com/identity/protocols/oauth2/web-server]
- `AuthService` current implementation: [Source: `src/app/core/services/auth.service.ts`]
- `SheetsService` current base URL: [Source: `src/app/core/services/sheets.service.ts` — `environment.sheetsApiBaseUrl`]
- `AuthInterceptor` current Bearer injection: [Source: `src/app/core/interceptors/auth.interceptor.ts`]
- Original no-backend constraint: [Source: `_bmad-output/planning-artifacts/architecture.md#Technical-Constraints`]
- Story 1.3 (existing re-auth resilience, being replaced): [Source: `_bmad-output/implementation-artifacts/1-3-token-refresh-and-re-authentication-resilience.md`]
- Story 2.7 (persistent auth and boot-time silent re-auth, being replaced): [Source: `_bmad-output/implementation-artifacts/2-7-persistent-auth-and-boot-time-silent-reauth.md`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
