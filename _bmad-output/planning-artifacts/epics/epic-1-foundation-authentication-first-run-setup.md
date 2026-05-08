# Epic 1: Foundation, Authentication & First-Run Setup

Nick can open the app, authenticate with Google, have the app auto-discover his expense Sheet, validate the schema, seed the category registry, and land on a working connected app shell — the complete foundation enabling all subsequent epics.

## Story 1.1: Project scaffold, toolchain, and CI/CD pipeline

As Nick,
I want the project initialized with all required dependencies, toolchain configuration, and a working CI/CD pipeline,
So that I have a deployable app shell as the verified starting point for all subsequent stories.

**Acceptance Criteria:**

**Given** a clean environment with Node.js and Angular CLI installed
**When** `ng new expense-dashboard --style=scss --routing=true --strict=true --ssr=false` is run and all packages are installed
**Then** `ng serve` starts without errors and the default app shell renders at `/`

**Given** the project is initialized
**When** Angular Material (`ng add @angular/material`), PWA (`ng add @angular/pwa`), Tailwind CSS, ng2-charts, idb, Zod, and Playwright are added
**Then** all package imports resolve without errors and `ng build --configuration=production` produces a clean build

**Given** Tailwind is configured
**When** `tailwind.config.js` is inspected
**Then** `preflight: false` and `important: '#app'` are set, and no style conflicts exist between Tailwind and Angular Material

**Given** the `AppError` discriminated union is defined with variants: `SCHEMA_VALIDATION`, `SHEETS_API`, `AUTH_EXPIRED`, `AUTH_REVOKED`, `AUTH_DENIED`, `NETWORK`, `SYNC_FAILED`, `IDB_ERROR`, `SCHEMA_MISMATCH`
**When** any service emits an error in any subsequent story
**Then** the emitted type is `AppError` — no raw `Error` objects are thrown or emitted by services

**Given** the `SyncQueueService` interface contract is defined with full `SyncQueueItem` type, `QueueState` enum (`PENDING` | `SYNC_ERROR`), and method signatures (`enqueue()`, `dequeue()`, `markError()`, `markSynced()`, `retryAll()`, `getQueue()`)
**When** E2 and E3 implement `SyncQueueService`
**Then** both epics compile against this locked interface without modification

**Given** the `SyncQueueItem` type is defined
**When** its fields are inspected
**Then** it includes exactly: `id: string`, `operation: 'INSERT' | 'UPDATE' | 'DELETE'`, `entryData: LocalEntry | null`, `targetEntryId: string | null`, `targetTabName: string | null` (null for INSERT operations; set to the originating tab name for past-year UPDATE/DELETE operations — always present so that UPDATE/DELETE retries can target the correct originating tab without re-querying the entry), `enqueuedAt: number`, `status: QueueState`, `retryCount: number`, `lastAttemptAt: number | null`, `nextRetryAt: number | null` (written by `markError()` to persist the scheduled retry time across app restarts — the retry scheduler reads this on init to resume correct timing without reset), `errorMessage: string | null`

**Given** the IDB database is opened via the `idb` library
**When** the app initializes for the first time
**Then** four object stores exist: `entries`, `syncQueue`, `categories`, and `appMeta`

**Given** a commit is pushed to `main`
**When** the GitHub Actions `deploy.yml` workflow runs
**Then** it executes `npm ci` → `ng build --configuration=production` → deploys `dist/expense-dashboard/browser/` to the configured static host, and the workflow exits with status 0

**Given** `manifest.webmanifest` exists
**When** it is inspected
**Then** it has `display: standalone`, a theme color, and both 192×192 and 512×512 icon entries so the app is installable on iOS and Android

---

## Story 1.2: Google OAuth authentication flow

As Nick,
I want to sign in with my Google account via a standard OAuth flow,
So that the app can access my Google Sheets on my behalf with the minimum necessary permissions.

**Acceptance Criteria:**

**Given** I am not authenticated
**When** I open the app
**Then** I am redirected to `/auth` and shown a "Sign in with Google" prompt

**Given** I click "Sign in with Google"
**When** the Google Identity Services OAuth flow via `initTokenClient` completes successfully
**Then** I am redirected to the main app and my authentication state is `AUTHENTICATED`

**Given** I have previously authenticated
**When** I open the app in a new browser session
**Then** I am not prompted to sign in again (session is persisted across visits)

**Given** the access token is obtained
**When** it is stored
**Then** it is held in memory only and not written to `localStorage`, `sessionStorage`, cookies, or any URL parameter

**Given** any HTTP call to the Google Sheets API is made via `HttpClient`
**When** the `AuthInterceptor` processes the request
**Then** an `Authorization: Bearer <token>` header is present on the request

**Given** I am authenticated
**When** I navigate to any route other than `/auth`
**Then** the functional `auth.guard.ts` permits access

**Given** I am unauthenticated
**When** I navigate to any protected route
**Then** I am redirected to `/auth` with no data loss

**Given** the OAuth authorization request is constructed
**When** the scopes are inspected
**Then** only `https://www.googleapis.com/auth/spreadsheets` is requested — no Drive, Gmail, or other scopes (spreadsheet discovery uses a user-provided ID persisted to `appMeta`, not Drive file enumeration)

**Given** all API calls are made
**When** the request URL is inspected
**Then** the scheme is `https://` exclusively — no plain HTTP

**Given** I click "Sign in with Google" and close the Google consent screen without granting access
**When** the OAuth callback is processed
**Then** I am returned to `/auth` with the message "Sheets access is required to use this app"; `AppError.AUTH_DENIED` is emitted — `AUTH_REVOKED` is not used (no token was ever issued)

**Given** a network failure or timeout occurs during the initial OAuth redirect or token exchange
**When** the error is caught
**Then** I am returned to `/auth` with a "Connection failed — tap to retry" action; `AppError.NETWORK` is emitted

---

## Story 1.3: Token refresh and re-authentication resilience

As Nick,
I want the app to silently refresh my session and only prompt me to re-authenticate when absolutely necessary,
So that token expiry never causes data loss and the app remains usable during any auth interruption.

**Acceptance Criteria:**

**Given** my access token is nearing expiry
**When** the GIS silent iframe refresh attempt succeeds
**Then** the new token is swapped in memory with no visible interruption to my session

**Given** the silent iframe refresh attempt fails
**When** the fallback triggers
**Then** I am redirected to the full OAuth flow at `/auth` without losing any locally stored data

**Given** I am on the re-authentication screen
**When** I look at the entry list and sync queue indicator
**Then** previously entered data is still visible and I can view all cached entries in read mode

**Given** I complete re-authentication
**When** the app resumes
**Then** `SyncQueueService.retryAll()` is called to flush the pending queue and the latest Sheet data is fetched

**Given** a Sheets API call returns HTTP 401 during an active session
**When** the error is handled
**Then** an `AppError.AUTH_REVOKED` is emitted, I am prompted to re-authenticate, and no data is lost

---

## Story 1.4: First-run setup and Google Sheets discovery

As Nick,
I want the app to guide me through connecting my Google account on first launch and automatically find my expense Sheet,
So that I can start logging expenses without entering any Sheet URL or ID.

**Acceptance Criteria:**

**Given** this is my first app launch (no auth token in storage)
**When** I open the app
**Then** I see a first-run onboarding screen prompting me to sign in with Google and approve Sheets access

**Given** I complete authentication
**When** the app prompts for Sheet connection
**Then** I am asked to enter my Google Sheet URL or spreadsheet ID once; the app derives the `spreadsheetId`, validates the spreadsheet is accessible, and persists it to the `appMeta` IDB store — no Drive-level file search is performed and the `spreadsheets` scope is sufficient

**Given** a matching Sheet is found
**When** discovery completes
**Then** the app displays the connected Sheet name and waits for my confirmation before loading any data

**Given** a Sheet tab is found
**When** the app reads its header row
**Then** Zod validates the column schema before any read or write operation is attempted

**Given** Zod schema validation passes on a tab
**When** the header row is inspected
**Then** the app identifies the schema version as either 2026 (6-column, writable) or 2025 (4-column, read-only) and stores this classification per tab

**Given** a 2026-schema tab is identified
**When** column F (the app-managed UUID column) is absent
**Then** an `AppError.SCHEMA_MISMATCH` is emitted, no data is read or written, and I see an actionable error message explaining the missing column

**Given** Sheet discovery fails entirely (network error or no matching spreadsheet)
**When** the error is surfaced
**Then** I see an actionable `AppError.SHEETS_API` message with a retry option — no unhandled exception or blank screen

**Given** a tab's header row matches neither the 2026 nor 2025 schema
**When** it is encountered during discovery
**Then** an `AppError.SCHEMA_VALIDATION` is emitted, the tab is skipped, and I see a user-visible warning identifying the problematic tab

---

## Story 1.5: Category registry seeding and CSS custom property injection

As Nick,
I want the app to load my expense categories from the Sheet at startup and display them with distinct colors throughout the app,
So that my categories are ready to use immediately with full visual differentiation before I log a single entry.

**Acceptance Criteria:**

**Given** Sheet discovery and authentication are complete
**When** `APP_INITIALIZER` runs
**Then** `AuthService.init()` completes fully before `CategoriesService.init()` begins — no parallel initialization

**Given** `CategoriesService.init()` runs
**When** the category data is read from the Sheet
**Then** categories are stored in the `categories` IDB store and the registry is global across all years — not scoped to any individual tab

**Given** a category has no user-assigned color
**When** `CategoriesService.init()` processes it
**Then** it is assigned a color from a predefined default palette (indexed by position in the registry) so `--color-[category-id]` is always populated

**Given** all categories have colors (default or user-assigned)
**When** `CategoriesService.init()` completes
**Then** `--color-[category-id]` CSS custom properties are injected into `document.documentElement.style` for every category

**Given** `APP_INITIALIZER` finishes
**When** the first route renders
**Then** all category CSS custom properties are already set — no flash of un-colored bars, dots, or tiles on initial paint

**Given** I am a returning user and the app is offline
**When** `CategoriesService.init()` runs
**Then** categories are loaded from the `categories` IDB store with no network call required — app shell renders normally

**Given** both IDB and the Sheet network request fail during `CategoriesService.init()`
**When** the error is caught
**Then** `CategoriesService.init()` resolves without rejecting; the app boots with an empty category registry; a recoverable "Could not load categories — tap to retry" prompt is shown; no blank screen is displayed

**Given** `CategoriesService.init()` reads from the Sheet
**When** a tab named exactly `Categories` with a `Category` header in column A is present in the spreadsheet
**Then** categories are read from column A of that tab as the primary source

**Given** no `Categories` tab is present in the spreadsheet
**When** `CategoriesService.init()` falls back
**Then** unique non-empty values from column B of the active 2026-schema tab are used as the category list; values are deduplicated and sorted alphabetically

**Given** a new category is written back to the Sheet (Story 5.3)
**When** the write-back executes
**Then** if the `Categories` tab was the source, the new category is appended to column A of that tab; if the column B fallback was the source, the new row is appended to the active 2026-schema tab's column B range

---

## Story 1.6: App shell, semantic color system, and light/dark theme

As Nick,
I want a polished app shell with a semantic color system and a working light/dark theme toggle,
So that the app is visually consistent from day one and I can switch to dark mode to match my preference.

**Acceptance Criteria:**

**Given** the app loads
**When** component styles are inspected
**Then** all color values use CSS custom properties (`--background`, `--foreground`, `--card`, `--border`, `--muted`, `--accent`) — no hardcoded hex values in any component style

**Given** the app boots
**When** `localStorage['theme']` is `'dark'`
**Then** the `dark` class is applied to `<html>` and Angular Material's `[color-scheme]` attribute reflects dark mode before the first paint

**Given** `tailwind.config.js` is inspected
**When** the `darkMode` key is read
**Then** its value is `'class'`

**Given** I access the theme toggle in Settings
**When** I tap it
**Then** the `dark` class is toggled on `<html>`, `localStorage['theme']` is updated, and the entire UI transitions without a full page reload

**Given** `prefers-reduced-motion: reduce` is active in my OS settings
**When** any component with entrance animations renders
**Then** no animations play

**Given** the app shell renders on a mobile viewport
**When** I inspect the layout
**Then** a bottom navigation bar, a FAB placeholder, and the main content area are present with no horizontal overflow and correct safe-area-inset padding

**Given** `ngsw-config.json` and `manifest.webmanifest` are configured
**When** the app is served over HTTPS and Chrome's installability criteria are checked
**Then** the "Add to Home Screen" prompt is eligible on Android and the app is bookmarkable as a standalone app on iOS

**Given** the app is installed as a PWA and the user has previously authenticated
**When** the app is opened on a 4G connection with service worker cached assets
**Then** First Meaningful Paint occurs in under 3 seconds — measured via Lighthouse or Chrome DevTools Performance panel (NFR-P3 pass/fail gate)

---
