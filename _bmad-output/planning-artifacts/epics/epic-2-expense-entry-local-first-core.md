# Epic 2: Expense Entry & Local-First Core

Nick can log, edit, and delete expenses — the ≤3-tap quick-add form works, entries appear instantly via optimistic local write, the full entry list is functional, and basic online Sheets write (INSERT) delivers data to the Sheet on the happy path.

> **Note:** E2 intentionally ships with PENDING entries visible in the sync indicator. The PENDING state resolves in E3 when the full sync state machine is implemented. This is expected during sprint development and does not represent a bug in E2.

## Story 2.1: EntriesService — IDB CRUD and optimistic signal update

As Nick,
I want expense entries to be saved instantly to local storage and reflected in the UI without waiting for any network call,
So that the app feels instantaneous regardless of connectivity.

**Acceptance Criteria:**

**Given** I submit a new expense entry
**When** `EntriesService.add()` is called
**Then** the entry is written to the `entries` IDB store and the entries signal is updated — all before any Sheets API call

**Given** the IDB write completes
**When** the UI re-renders
**Then** the new entry appears in the entry list within 200ms of the save action

**Given** I call `EntriesService.update()`
**When** the IDB write completes
**Then** the updated entry replaces the old one in both IDB and the entries signal

**Given** I call `EntriesService.delete()`
**When** the IDB write completes
**Then** the entry is removed from both IDB and the entries signal

**Given** the app starts
**When** IDB is queried on init
**Then** all entries are loaded into the entries signal from IDB — not from the Sheets API

**Given** an IDB write fails for any reason
**When** the error is caught
**Then** an `AppError.IDB_ERROR` is emitted and the signal is not updated — no phantom entries appear in the list

**Given** any signal update occurs
**When** change detection runs
**Then** only `OnPush` components that consume the affected signal re-render

**Given** PENDING and SYNC_ERROR items exist in the `syncQueue` IDB store
**When** the browser tab is closed and reopened
**Then** all queue items are present with their original `status`, `retryCount`, and `nextRetryAt` values intact — zero items missing (NFR-R2 pass/fail gate)

---

## Story 2.2: QuickAdd bottom sheet — category, amount, date, and remarks

As Nick,
I want to open a quick-add drawer from a FAB, select a category, enter an amount, and save a new expense in 3 taps or fewer,
So that logging an expense is fast enough to do immediately after spending.

**Acceptance Criteria:**

**Given** I tap the FAB
**When** `QuickAddSheetComponent` opens via `MatBottomSheet`
**Then** focus moves to the Date field

**Given** the drawer opens
**When** the Date field is rendered
**Then** it is pre-filled with today's date

**Given** I want a different date
**When** I tap the Date field and change it
**Then** the new date is used for the entry

**Given** I tap a `CategoryTileComponent` tile
**When** the category is selected
**Then** the Amount field auto-focuses and the tile shows a selected ring + fill visual state

**Given** the category tiles are rendered
**When** I inspect their order
**Then** they are sorted by recency/frequency — most-used at top

**Given** I tap the Amount field
**When** the mobile keyboard opens
**Then** `inputmode="decimal"` is set so a numeric keyboard is shown

**Given** I enter an amount of 0
**When** I attempt to save
**Then** the Save button is disabled and a validation message indicates zero is invalid

**Given** I enter a negative amount (e.g. −12.50)
**When** the entry is saved
**Then** it is stored as a negative number and the Save completes normally

**Given** I tap the Remarks field
**When** I type text
**Then** it is stored as remarks on the entry

**Given** all required fields are filled (category + non-zero amount)
**When** I tap Save
**Then** the entry is saved via `EntriesService.add()`, a light haptic fires, and the drawer closes

**Given** the drawer closes
**When** focus returns
**Then** it moves to the FAB

**Given** the FAB is present while the drawer is open
**When** the DOM is inspected
**Then** the FAB has `visibility: hidden` — not `*ngIf` or `display: none` — so focus return works correctly

**Given** the Save button renders
**When** inspected on a mobile viewport with an open keyboard
**Then** it is full-width and remains visible above the keyboard

**Given** I swipe down on the drawer
**When** the gesture completes
**Then** the drawer dismisses without saving

**Given** the FAB renders
**When** its accessible name is inspected
**Then** `aria-label="Add expense"` is set

---

## Story 2.3: Entry list view and EntryRowComponent

As Nick,
I want to see all my logged expenses in a scrollable list sorted by date,
So that I can review what I've entered and know the app has recorded each expense correctly.

**Acceptance Criteria:**

**Given** entries exist in IDB
**When** the entry list route renders
**Then** all entries are displayed sorted by date descending

**Given** an entry is rendered
**When** `EntryRowComponent` displays it
**Then** it shows: a date chip, a category color dot, the amount, and remarks (if present)

**Given** an entry has a negative amount
**When** rendered in `EntryRowComponent`
**Then** the amount displays with a green `+` prefix

**Given** an entry has `PENDING` sync state
**When** rendered in `EntryRowComponent`
**Then** its category dot is dimmed

**Given** an entry has `SYNC_ERROR` state
**When** rendered in `EntryRowComponent`
**Then** an amber indicator is shown on the row

**Given** the entry list container is scrollable
**When** `touch-action` is inspected on the scroll container
**Then** it is `pan-y`; on tappable rows inside the container it is `manipulation`

**Given** the app is on an iPhone with a home indicator
**When** the bottom nav and list render
**Then** `padding-bottom: env(safe-area-inset-bottom)` is applied so no content is hidden behind the system bar

**Given** no entries exist
**When** the entry list renders
**Then** the `EmptyState` component shows a specific contextual message with a CTA to add an expense — never a generic "nothing here"

---

## Story 2.4: Edit and delete entry with confirmation and undo

As Nick,
I want to edit a logged expense or delete it with a confirmation step and a brief undo window,
So that I can correct mistakes without accidentally losing entries.

**Acceptance Criteria:**

**Given** I tap an entry row
**When** the entry detail sheet opens
**Then** all fields (date, category, amount, remarks) are pre-filled with the entry's current values

**Given** I change one or more fields and tap Save
**When** `EntriesService.update()` completes
**Then** the entry is updated in IDB and the entries signal reflects the new values immediately

**Given** I tap the Delete action on an entry
**When** a `MatDialog` confirmation appears
**Then** the destructive action uses a ghost/text style button — never a primary button

**Given** I confirm deletion
**When** `EntriesService.delete()` runs
**Then** the entry is removed from the list and a `MatSnackBar` undo action appears for a short grace period

**Given** the undo snackbar is visible
**When** I tap "Undo"
**Then** the entry is restored in IDB and reappears in the list

**Given** the undo grace period expires without action
**When** the timer completes
**Then** the deletion is finalized and the snackbar dismisses

**Given** the entry I am editing has already been synced to Sheets
**When** I save the edit
**Then** `EntriesService` enqueues an UPDATE operation to `SyncQueue` using the `SyncQueueService` interface defined in Story 1.1

**Given** the entry I am deleting has already been synced to Sheets
**When** deletion is confirmed
**Then** `EntriesService` enqueues a DELETE operation to `SyncQueue`

---

## Story 2.5: SyncQueue INSERT — write new entries to Google Sheets

As Nick,
I want new entries I log while online to be written to my Google Sheet automatically,
So that my Sheet stays up to date without any manual export step.

**Acceptance Criteria:**

**Given** I save a new entry while online and authenticated
**When** `EntriesService.add()` enqueues to `SyncQueue`
**Then** `SyncQueueService.enqueue()` adds a PENDING item with operation type INSERT

**Given** a PENDING INSERT item exists in the queue
**When** the network is available and the token is valid
**Then** `SheetsService` writes the entry to the current year's active tab

**Given** the Sheets write succeeds
**When** `SyncQueueService.markSynced()` is called
**Then** the item is removed from the `syncQueue` IDB store

**Given** the new entry is written to the Sheet
**When** the row is inspected
**Then** column F contains the entry's `crypto.randomUUID()` UUID as an idempotency key

**Given** schema validation has not passed for the current year's tab
**When** an INSERT is attempted
**Then** the write is blocked and an `AppError.SCHEMA_VALIDATION` is emitted — no silent mismap

**Given** a Sheets API write returns a quota error (429) or transient 5xx
**When** the error is caught
**Then** the item remains PENDING in the queue with no data loss

**Given** I am offline when a new entry is saved
**When** `SyncQueueService.enqueue()` runs
**Then** the item is stored as PENDING in IDB and no network call is attempted — full retry is handled in Epic 3

### End-to-End Tests (Playwright — Story 2.5 is Epic 2's last story)

**Shared fixture infrastructure — build these first, used by all subsequent epics:**
- `e2e/fixtures/auth.fixture.ts` — `page.addInitScript()` seeds IDB with a non-expired token record, bypassing the GIS popup
- `e2e/fixtures/sheets-mock.ts` — `page.route('**/sheets.googleapis.com/**', ...)` stubs returning fixture JSON for reads and 200 for writes
- `e2e/support/idb-helpers.ts` — programmatic IDB seed/clear helpers

**Tests — `e2e/entry-form.spec.ts` (replaces existing placeholder):**

| ID | Scenario |
|---|---|
| E2-01 | QuickAdd bottom sheet opens on FAB tap |
| E2-02 | Valid entry submitted → appears in entry list with correct amount and category |
| E2-03 | Amount field empty → submit blocked, inline validation error visible |
| E2-04 | Edit entry → bottom sheet pre-fills values → save → list row updated |
| E2-05 | Delete entry → confirm dialog → row removed from list |
| E2-06 | Entry survives page reload — IDB persistence assertion via `idb-helpers.ts` |
| E2-07 | After entry save → `syncQueue` IDB store contains 1 PENDING record |

---

## Story 2.6: Multi-year entry hydration on first sheet connect

As Nick,
I want every existing entry in my Sheet's 2026-schema year tabs (current and any past years) to load into the app on first connect,
So that switching devices or reinstalling does not lose visibility into any data already in my Sheet.

**Scope note:** 2.6 hydrates the canonical 2026-schema year tabs only (e.g. `2026`, future `2027`, and any past-year tabs that already use the 2026 column layout). The legacy **2025** tab uses a different 4-column schema and is intentionally left to Story 3.6, which adds the legacy column mapping plus read-only enforcement. Once 3.6 ships, 2025 entries also become visible — but waiting on 3.6 must not block 2026-schema hydration.

**Acceptance Criteria:**

**Given** I have just completed first-run setup (Story 1.4) and the spreadsheet has been validated against the 2026 schema (Story 1.5's `schemaCache`)
**When** the app finishes connecting and before the entry list renders
**Then** `SheetsService` enumerates every tab in the spreadsheet whose name matches a year and whose header row passes 2026-schema validation, then reads every data row from each qualifying tab and maps it into a `LocalEntry` with `syncStatus: 'SYNCED'`, `isReadOnly: false`, and `targetTabName` set to the originating tab

**Given** a tab's name does not match a year pattern, or its header row fails 2026-schema validation
**When** hydration runs
**Then** that tab is skipped (no mapping attempted, no error surfaced); legacy 2025 mapping is explicitly out of scope here and is owned by Story 3.6

**Given** a row contains a column-F UUID
**When** the row is mapped to a `LocalEntry`
**Then** that UUID is used as the `LocalEntry.id` so re-hydration is idempotent — no duplicate IDB rows on a second connect, regardless of which tab the row came from

**Given** a row has no column-F UUID (entry predates 2.5's UUID idempotency convention)
**When** the row is mapped
**Then** a deterministic id `hydrated-<tabName>-<row>` is assigned and stored, so subsequent hydrations do not re-import the same row as a new entry

**Given** hydration is in progress
**When** the user opens the app shell
**Then** the entry list shows a hydration progress state distinguishable from the "no entries" empty state, the progress indicator reports per-tab progress (e.g. "Loading 2026 (1 of 2)…"), and the FAB QuickAdd remains tappable so logging is never blocked on hydration

**Given** any qualifying tab fails schema validation mid-hydration
**When** that specific tab is processed
**Then** that tab is skipped with `AppError.SCHEMA_VALIDATION` surfaced via `NotificationService`, and hydration continues with remaining tabs — partial hydration is preferred over total failure, and the user sees a per-tab inline status

**Given** hydration completes (fully or partially)
**When** the run ends
**Then** `appMeta.hydratedAt` is written with a per-tab map of `{ tabName: { lastHydratedAt, rowCount } }`; full hydration is NOT re-run on every launch — only when a tab is absent from the map or when the user explicitly triggers a re-sync (deferred to Epic 3)

**Given** a Sheets API read for any individual tab fails (network, 5xx, quota)
**When** the failure surfaces
**Then** that tab is left in "deferred" state in `appMeta.hydratedAt` so retry resumes only the failed tab — successfully hydrated tabs are not re-read

**Given** Story 3.6's legacy 2025 hydration and Story 3.7's past-year edit/delete write-back land later
**When** they integrate
**Then** 2.6 remains the canonical multi-tab hydration entry point — 3.6 plugs in the legacy mapper for 2025 tabs, and 3.7 reuses 2.6's hydrated rows for row-resolution rather than re-reading

---

## Story 2.7: Persistent auth and boot-time silent re-authentication

As Nick,
I want to stay signed in across browser restarts so I don't have to manually re-authenticate every time I open the app,
So that the local-first UX is not undermined by a forced auth roundtrip on every cold launch.

**Background:** Story 1.3 implemented in-session silent token refresh (proactive 5-min-before-expiry timer + reactive 401 handling), but stored the access token expiry in `sessionStorage` — wiped on tab/browser close — and the boot path routes straight to `/auth` whenever no in-memory token is present. As a result, every cold launch forces a fresh OAuth roundtrip even though the user's underlying Google session is typically still valid. This story closes that gap by persisting the token to IDB and adding a boot-time silent re-auth attempt before any visible `/auth` redirect.

**Acceptance Criteria:**

**Given** I successfully authenticate (via Story 1.2 / 1.3 / a re-auth prompt)
**When** the access token is received
**Then** the token and its `expiresAt` timestamp are written to the `appMeta` IDB store (key `auth.accessToken` and `auth.tokenExpiresAt`) — `sessionStorage` is no longer the durable store for these values

**Given** I close my browser/tab while signed in and reopen the app within the token's remaining lifetime
**When** `AuthService.init()` runs at boot
**Then** the persisted token is loaded from `appMeta`, the proactive-refresh timer is rescheduled relative to its remaining lifetime, and no auth UI is shown — the app proceeds directly to its post-auth state

**Given** I reopen the app after the persisted access token has expired but my Google session cookie is still valid
**When** `AuthService.init()` runs at boot
**Then** before any redirect to `/auth`, the service attempts a silent re-auth via GIS `requestAccessToken({ prompt: 'none' })`; if a fresh token is returned within the existing `SILENT_REFRESH_TIMEOUT_MS` window, it is persisted to IDB and the app proceeds without showing auth UI

**Given** boot-time silent re-auth fails (Google session cookie absent, account revoked, network failure, GIS error)
**When** the failure surfaces
**Then** an `AppError.AUTH_SILENT_REAUTH_FAILED` is emitted (a new variant — extends the discriminated union by one), the persisted token in `appMeta` is cleared, and the app routes to `/auth` with the existing "Your session has expired. Your data is safely stored — sign in to resume syncing." banner from Story 1.3

**Given** I sign out via the existing `signOut()` flow
**When** the sign-out completes
**Then** the persisted token and expiry are cleared from `appMeta` in addition to the existing `sessionStorage` cleanup, and the proactive-refresh timer is cleared as before

**Given** Story 2.6's hydration runs on first sheet connect
**When** boot-time silent re-auth has succeeded with a persisted token
**Then** hydration proceeds against the restored token without any user-visible delay beyond what 2.6 already specifies — the auth restore runs first in the boot chain, hydration second

**Given** the persisted token's `expiresAt` is missing, malformed, or in the past on boot
**When** the service evaluates persisted state
**Then** the persisted record is treated as absent (purge + fall through to silent re-auth) — no half-validated token is ever sent to Sheets

**Given** XSS is the dominant token-exfiltration risk for a static-hosted SPA
**When** evaluating the IDB-vs-sessionStorage trade
**Then** Dev Notes explicitly document the choice: tokens persist in IDB so cold launches are silent; the security delta vs sessionStorage is small for a single-user, no-third-party-script app, and is justified by the persistent-auth UX contract — this is a deliberate trade, not an oversight

**Given** boot-time silent re-auth is in flight
**When** the user backgrounds and re-foregrounds the tab
**Then** the in-flight attempt is not duplicated — the existing `_isRefreshInProgress` guard from Story 1.3 is reused

---

## Story 2.8: Multi-line expandable Remarks field

As Nick,
I want the Remarks field to be a multi-line, expandable text area instead of a single-line input,
So that I can write fuller notes ("Coffee with Anna at the Lindenhof place — discussed Q3 plans") without my text being truncated or hidden behind a scroll.

**Background:** Story 2.2 (merged) and Story 2.4 (backlog spec) both currently use `<input matInput>` for Remarks — single-line. The PRD's product-scope item **E3** explicitly requires "Large remarks field — multi-line, expandable on tap"; this is also reflected in FR4 ("free-text remarks of any length"). 2.8 closes this regression with a small targeted change.

**Acceptance Criteria:**

**Given** I open the QuickAdd bottom sheet (from Story 2.2)
**When** the Remarks field renders
**Then** it is a `<textarea matInput>` with `cdkTextareaAutosize`, `cdkAutosizeMinRows="1"`, `cdkAutosizeMaxRows="6"` — collapsed to a single visual row by default

**Given** the Remarks field is collapsed
**When** I focus or tap the field
**Then** the field expands to show the typed content's natural height (up to the 6-row max) without modal layout shift — the bottom sheet's pinned Save button stays visible

**Given** I type more than 6 visual rows of content
**When** the cap is reached
**Then** the textarea becomes internally scrollable (no further height growth) so the bottom sheet's overall height remains stable and the Save button stays reachable

**Given** I open the entry edit sheet (from Story 2.4)
**When** the Remarks field renders
**Then** it uses the same `<textarea matInput>` + `cdkTextareaAutosize` configuration so edit-mode visuals match QuickAdd-mode visuals — no behavioural divergence between create and edit flows

**Given** the field expands beyond the initial single-row collapsed height
**When** screen-reader users encounter the field
**Then** the field is announced as a multi-line text input (native `<textarea>` semantics) — no manual ARIA overrides required

**Given** I have entered multi-line remarks
**When** the entry is saved
**Then** newline characters are preserved exactly in `LocalEntry.remarks` and round-tripped to the Sheet (Sheets API accepts `\n` in cell values without transformation)

**Given** the entry list renders an entry with multi-line remarks (Story 2.3)
**When** the row is rendered
**Then** the row collapses multi-line remarks visually to a single-line preview using CSS `text-overflow: ellipsis` + `white-space: nowrap` — the row height does NOT vary by remarks length, preserving 2.3's stable list rhythm. The entry edit sheet (Story 2.4) is the surface where the full multi-line content is viewable and editable.

**Given** the change touches a merged story (2.2)
**When** the implementation lands
**Then** the patch is contained to the QuickAddSheetComponent's template + SCSS (no signal/service surface changes); migration risk is zero because the data shape (`LocalEntry.remarks: string`) is unchanged — single-line remarks already in IDB and Sheets continue to render correctly in the new textarea

---
