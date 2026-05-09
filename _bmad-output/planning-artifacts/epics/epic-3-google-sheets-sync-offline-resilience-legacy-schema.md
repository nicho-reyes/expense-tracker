# Epic 3: Google Sheets Sync, Offline Resilience & Legacy Schema

> **Highest-risk epic** — covers three distinct concern areas; stories are sub-grouped and sequenced to reduce integration risk.

All entries sync to Google Sheets reliably through full offline operation — the IndexedDB queue survives restarts, 2025 legacy entries appear in read-only mode, the pre-sync review screen works, PENDING/SYNC_ERROR states are visually distinguished, and exponential backoff retry handles network failures.

## Story 3.1: SyncQueueService full state machine with exponential backoff

As Nick,
I want failed sync attempts to retry automatically with increasing delays,
So that temporary network issues resolve themselves without me having to do anything.

**Acceptance Criteria:**

**Given** a PENDING queue item fails to sync (network error or API 5xx)
**When** `SyncQueueService.markError()` is called
**Then** the item transitions to SYNC_ERROR state, its `retryCount` is incremented, and `nextRetryAt` is written to IDB as `Date.now() + backoffMs` with ±20% random jitter applied (backoffMs schedule: 1s attempt 1, 2s attempt 2, 4s attempt 3, 8s attempt 4, 16s attempt 5, 32s attempt 6, 64s attempt 7, 120s cap attempt 8+)

**Given** an item in SYNC_ERROR state
**When** the retry scheduler fires
**Then** it reads `nextRetryAt` from the queue item and does not retry before that timestamp

**Given** an item is retried and the Sheets write succeeds
**When** `SyncQueueService.markSynced()` is called
**Then** the item is removed from the `syncQueue` IDB store and the entry's sync state in the UI updates to reflect success

**Given** the app is closed and reopened while SYNC_ERROR items exist in IDB
**When** the app restarts
**Then** the queue is reloaded from IDB and the retry scheduler uses each item's `nextRetryAt` to schedule the next attempt at the correct future time — backoff timing survives app restart, no immediate spurious retry

**Given** a browser tab is closed and reopened
**When** IDB is read on init
**Then** all PENDING and SYNC_ERROR items are present — no data loss across tab closes

**Given** multiple queued operations target the same Sheet tab
**When** `SheetsService` executes them
**Then** they are batched into a single Sheets API call where possible to stay within quota

**Given** N PENDING items exist in the sync queue at flush start
**When** a network error occurs mid-flush after K items have been successfully ACKed to Google Sheets
**Then** exactly N-K items remain in `syncQueue` with PENDING status — zero items lost, zero items duplicated (NFR-R1 pass/fail gate)

---

## Story 3.2: SyncStatusBar — PENDING/SYNC_ERROR visual states and manual retry

As Nick,
I want a persistent sync status indicator that shows me exactly what state my entries are in and lets me trigger a retry immediately,
So that I always know whether my data has reached Google Sheets and can act if it hasn't.

**Acceptance Criteria:**

**Given** the app renders any screen
**When** the `SyncStatusBar` DOM is inspected
**Then** it is permanently mounted with `aria-live="polite"` and empty initial content — never conditionally rendered

**Given** all entries are synced
**When** `SyncStatusBar` renders in Healthy state
**Then** it shows "synced Xm ago" in a quiet zinc-500 style

**Given** PENDING items exist in the queue
**When** `SyncStatusBar` renders
**Then** it shows an amber badge with the count of unsynced entries

**Given** SYNC_ERROR items exist
**When** `SyncStatusBar` renders
**Then** it shows a red "sync failed" indicator that is tappable

**Given** I tap the red SYNC_ERROR indicator
**When** the tap is registered
**Then** `SyncQueueService.retryAll()` is called immediately and a medium haptic fires

**Given** `retryAll()` is called
**When** the retry begins
**Then** the status updates to the PENDING amber state

**Given** both PENDING and SYNC_ERROR items are present simultaneously
**When** `SyncStatusBar` renders
**Then** SYNC_ERROR takes visual priority over PENDING

**Given** I am offline
**When** `SyncStatusBar` renders in Offline state
**Then** it shows a grey dot with the queued entry count

---

## Story 3.3: Last successful sync timestamp and persistent failure warning

As Nick,
I want to see when my data was last successfully synced and receive a prominent warning if sync has been failing for a long time,
So that I know my data is safe or can take action if it isn't.

**Acceptance Criteria:**

**Given** a Sheets write succeeds
**When** `SyncQueueService.markSynced()` is called
**Then** the current timestamp is written to the `appMeta` IDB store as `lastSyncedAt`

**Given** `lastSyncedAt` exists in `appMeta`
**When** `SyncStatusBar` renders in Healthy state
**Then** it shows the relative time (e.g., "synced 3m ago") derived from this timestamp

**Given** sync has been continuously failing for 1 hour
**When** the failure threshold is crossed
**Then** a user-visible warning is surfaced via `NotificationService` with a manual retry action

**Given** the persistent failure warning is shown
**When** I tap the retry action
**Then** `SyncQueueService.retryAll()` is called

**Given** the failure warning fires
**When** the notification is inspected
**Then** it is routed through `NotificationService` — not a direct `MatSnackBar` call from a service

---

## Story 3.4: Offline detection and offline-resilient browsing

As Nick,
I want to log and view entries normally while offline, with a clear indicator that I'm offline,
So that losing connectivity never interrupts my expense tracking.

**Acceptance Criteria:**

**Given** my device goes offline
**When** `navigator.onLine` changes to false
**Then** the `OfflineIndicator` shows a grey dot with an "Offline" label

**Given** I am online
**When** the `OfflineIndicator` renders
**Then** it is hidden or shows only a subtle green dot

**Given** I am reconnecting (the `online` event fires)
**When** the transition occurs
**Then** the `OfflineIndicator` shows a pulse animation for the reconnecting state

**Given** I am offline
**When** I open `QuickAddSheetComponent` and save an entry
**Then** the entry is written to IDB and enqueued as PENDING — no error is shown for the offline save itself

**Given** I am offline
**When** I browse the entry list and dashboard
**Then** all data from IDB is displayed normally — no blocking "you're offline" overlay

**Given** the app comes back online
**When** the `online` event fires
**Then** `SyncQueueService.retryAll()` is called automatically to flush the PENDING queue

---

## Story 3.5: Pre-sync review screen — view, edit, and cancel queued entries

As Nick,
I want to review everything in my sync queue before it goes to the Sheet and be able to edit or discard individual items,
So that I have full control over what gets written to my Google Sheet.

**Acceptance Criteria:**

**Given** PENDING entries exist in the queue
**When** I navigate to the sync review screen
**Then** all queued entries are listed

**Given** the review screen renders
**When** the header is shown
**Then** it displays "N entries ready to sync"

**Given** the "Sync all" primary CTA is visible
**When** I tap it
**Then** `SyncQueueService.retryAll()` is called

**Given** I tap an individual queued entry in the review list
**When** the edit sheet opens
**Then** I can modify date, category, amount, or remarks before it syncs

**Given** I save the edit
**When** the entry is updated
**Then** the `SyncQueue` item is updated in IDB with the new data and remains PENDING

**Given** I tap the cancel/discard action on a queued entry
**When** a `MatDialog` confirmation appears
**Then** the destructive action uses a ghost/text style button

**Given** I confirm the cancel
**When** `SyncQueueService.dequeue()` is called
**Then** the entry is removed from both the `syncQueue` IDB store and the entry list — it will not be written to the Sheet

**Given** an entry in the review list has been attempted and failed
**When** `SyncReviewRow` renders
**Then** it shows a red indicator with a retry button

**Given** an entry is currently being pushed to Sheets
**When** `SyncReviewRow` renders
**Then** it shows a spinner for that row

**Given** an entry has been acknowledged (synced)
**When** `SyncReviewRow` renders
**Then** it shows a green checkmark

---

## Story 3.6: 2025 legacy tab read-only mode with column mapping

As Nick,
I want to see my historical 2025 expenses in the app even though they use an older sheet format,
So that I have complete expense history without any manual migration.

**Acceptance Criteria:**

**Given** a 2025-schema tab is detected during Sheet discovery
**When** data is read from it
**Then** the 4-column legacy format is mapped to the current data model and entries are stored in IDB

**Given** a 2025 entry is stored in IDB
**When** it is written
**Then** it carries a `readOnly: true` flag

**Given** a 2025 entry renders in `EntryRowComponent`
**When** I tap it to open the detail view
**Then** the edit and delete actions are disabled or hidden

**Given** an edit or delete is attempted on a 2025 entry programmatically
**When** the attempt is made
**Then** the operation is blocked and an `AppError.SCHEMA_MISMATCH` is emitted — no write reaches IDB or Sheets

**Given** 2025 and 2026 entries coexist
**When** the entry list renders
**Then** all entries appear sorted by date — no visual segregation is required, but disabled edit controls make the read-only state evident

---

## Story 3.7: Past-year 2026-schema tab edit and delete with write-back

As Nick,
I want to edit or delete entries from previous years that use the current schema format,
So that I can correct historical entries without switching to the Sheet directly.

**Acceptance Criteria:**

**Given** a past-year tab uses the 2026 (6-column) schema
**When** I edit an entry from that tab and save
**Then** the UPDATE is written back to the originating tab — not the current year's tab

**Given** I delete an entry from a past-year 2026-schema tab and confirm
**When** `SheetsService` executes the DELETE
**Then** the corresponding row is deleted from the originating tab

**Given** a write-back to a past-year tab is enqueued
**When** `SheetsService` executes it
**Then** Zod validates the past-year tab's schema before writing — no silent mismap

**Given** schema validation fails for a past-year tab
**When** the error is caught
**Then** an `AppError.SCHEMA_VALIDATION` is emitted and the write is blocked with a user-visible error

**Given** a `SyncQueue` item for a past-year entry is processed
**When** `SyncQueueService` executes it
**Then** `SyncQueueItem.targetTabName` is used to target the correct originating tab — not the current year's active tab

**Given** an UPDATE or DELETE operation for a past-year 2026-schema entry is enqueued
**When** `SyncQueueService.enqueue()` is called
**Then** `targetTabName` is set from the originating entry's tab name; INSERT operations always set `targetTabName` to `null`

### End-to-End Tests (Playwright — Story 3.7 is Epic 3's last story)

**Tests — `e2e/offline.spec.ts` (replaces existing placeholder):**

| ID | Scenario |
|---|---|
| E3-01 | `page.context().setOffline(true)` → QuickAdd still saves → entry appears in list |
| E3-02 | Go back online → `SyncStatusBar` transitions: queued → syncing → synced |
| E3-03 | Offline + page reload → IDB entries still visible, no crash or blank screen |

**Tests — `e2e/sync-review.spec.ts` (replaces existing placeholder):**

| ID | Scenario |
|---|---|
| E3-04 | Pre-sync review screen lists pending entries with correct data |
| E3-05 | Approve sync → `sheets-mock.ts` stub receives correct write payload |
| E3-06 | Reject individual entry → removed from queue, not included in write payload |

**Tests — `e2e/sync-status.spec.ts` (new file):**

| ID | Scenario |
|---|---|
| E3-07 | Sheets stub returns 409 → `SyncStatusBar` shows conflict/error indicator |
| E3-08 | Manual retry on conflict → resolves to synced state |

---

## Story 3.8: Manual re-sync from Sheets with conflict resolution

As Nick,
I want to manually re-sync the app from my Sheet whenever I edit it directly (typo fixes, mass corrections, or imports done outside the app),
So that the Sheet remains the authoritative source of truth and my edits there are reflected in the app without reinstalling.

**Background:** Story 2.6 hydrates IDB on first connect, but treats Sheets as frozen afterward. This story reopens that channel as a user-controlled action — closing the loop on the PRD's "Sheets is the persistent source of truth" promise.

**Acceptance Criteria:**

**Given** the app has completed first-connect hydration (Story 2.6)
**When** I navigate to Settings
**Then** I see a "Re-sync from Sheets" action with a "Last re-synced: <relative-timestamp>" line, distinct from "Sync to Sheets" (the existing outbound queue retry)

**Given** I trigger Re-sync from Sheets
**When** the operation runs
**Then** every 2026-schema year tab is re-read using the same `HydrationService` enumeration logic from Story 2.6 — no parallel implementation; this story extends `HydrationService` rather than duplicating

**Given** a row read from Sheets has a column-F UUID matching an existing IDB entry whose `syncStatus` is `SYNCED`
**When** the row is reconciled
**Then** the IDB entry is overwritten with the Sheet row (Sheet wins) — this is the canonical source-of-truth behaviour

**Given** a row read from Sheets has a column-F UUID matching an existing IDB entry whose `syncStatus` is `PENDING` or `SYNC_ERROR`
**When** the row is reconciled
**Then** the IDB entry is preserved (local pending edit is NOT overwritten) and a per-row reconciliation report records "skipped — pending local change" so the user is not silently surprised

**Given** a row read from Sheets has no matching IDB entry
**When** the row is reconciled
**Then** the entry is inserted into IDB with `syncStatus: 'SYNCED'`, mirroring 2.6's hydration behaviour

**Given** an IDB entry with `syncStatus: 'SYNCED'` has no matching Sheet row in its `targetTabName` after a successful tab read
**When** the reconciliation completes
**Then** that entry is moved into a "Stale entries" list in the reconciliation report — NOT auto-deleted; the user reviews the list and can choose to delete or restore (deletion is destructive and must be explicit)

**Given** the operation completes (fully or partially)
**When** the reconciliation report is presented
**Then** the user sees per-tab counts: rows-added, rows-overwritten, rows-skipped-pending, rows-stale, rows-failed; `appMeta.hydratedAt[tab]` is updated for each successfully reconciled tab

**Given** any individual tab read fails (network, 5xx, quota)
**When** the failure surfaces
**Then** that tab is left as deferred in the reconciliation report (mirrors 2.6's per-tab partial-hydration semantics); successfully reconciled tabs retain their updated `appMeta.hydratedAt[tab]` so a retry resumes only the failed tab

**Given** a reconciliation is already in progress
**When** the user triggers Re-sync from Sheets again
**Then** the second trigger is debounced/no-op until the first completes — no concurrent reconciliations

**Given** the Sheet's `Categories` tab content has changed since first connect (categories added, renamed, or reordered)
**When** Re-sync runs
**Then** `CategoriesService.seedFromSheet()` from Story 1.5 is also re-invoked so category metadata remains consistent — re-sync is a holistic snapshot, not just entries

---

## Story 3.9: Automatic re-sync triggers and TTL-based refresh policy

As Nick,
I want the app to automatically refresh from my Sheet at sensible lifecycle moments — when I open the app, when I switch back to the tab after a break, when my network reconnects, and when I re-authenticate — without me having to remember to tap "Re-sync from Sheets",
So that the app stays in step with my Sheet by default and the manual re-sync action becomes a fallback rather than a routine.

**Background:** The PRD's NFR-P5 specifies "Sheet data is refreshed on every app open and tab focus; within a session, data is cached with a 5-minute TTL." FR46 specifies "On successful re-authentication, the pending queue is flushed and the latest Sheet data is fetched." The domain-specific requirements add "On reconnect after offline period, Sheet data is refreshed immediately regardless of remaining session TTL." Story 3.8 delivers the manual reconciliation engine; this story wires that engine to the four lifecycle triggers the PRD requires, behind a single TTL-aware gate so we don't burn quota on every micro-event.

**Acceptance Criteria:**

**Given** I cold-launch the app and `appMeta.lastReconciledAt` is older than 5 minutes (or absent)
**When** the boot chain runs (after `AuthService.init()` resolves successfully and after Story 2.6's first-connect hydration is complete)
**Then** `HydrationService.runReconciliation()` is auto-invoked exactly once; if `lastReconciledAt` is within the 5-minute TTL, the call is skipped to honour NFR-P5

**Given** I switch back to the app tab from another tab or window
**When** the `visibilitychange` event fires with `document.visibilityState === 'visible'`
**Then** `HydrationService.runReconciliation()` is auto-invoked **only if** `appMeta.lastReconciledAt` is older than 5 minutes — repeated focus events within the TTL window are no-ops to honour the cache contract

**Given** the app's `OnlineStatusService` (Story 3.4) transitions from offline → online after an offline period
**When** the transition fires
**Then** `HydrationService.runReconciliation()` is auto-invoked **immediately**, ignoring the 5-minute TTL — per the domain requirement "On reconnect after offline period, Sheet data is refreshed immediately regardless of remaining session TTL"

**Given** authentication succeeds (silent re-auth via Story 2.7's boot path, interactive re-auth via Story 1.3's `/auth` flow, or a fresh first-run auth via Story 1.2)
**When** the auth-success signal fires
**Then** `SyncQueueService.retryAll()` flushes the pending outbound queue (existing 1.3 behaviour) AND `HydrationService.runReconciliation()` is auto-invoked **immediately**, ignoring the TTL — per FR46 "the latest Sheet data is fetched"

**Given** any of the four triggers fire while a reconciliation is already running
**When** the trigger evaluates
**Then** the second trigger is no-op (reuses 3.8's `isReconciling` signal guard) — concurrency safety is inherited, not re-implemented

**Given** auto-triggered reconciliation surfaces stale entries or skipped-pending rows
**When** the reconciliation completes
**Then** the resulting `ReconciliationReport` from 3.8 is NOT auto-popped as a `MatDialog`; instead a passive sync indicator is updated (counts visible in `SyncStatusBar`) and the user can open the full report from Settings — auto-triggers must not interrupt active workflows

**Given** auto-triggered reconciliation fails (network, 5xx, quota, schema)
**When** the failure surfaces
**Then** failure is recorded silently to the same `ReconciliationReport` as 3.8 manual runs and surfaced via `SyncStatusBar`'s existing error state — `NotificationService.showError` is NOT used for auto-trigger failures (only manual triggers get loud errors per existing UX boundary that "errors only" snackbars are user-initiated)

**Given** I have signed out (Stories 1.3, 2.7)
**When** auto-triggers evaluate
**Then** every auto-trigger is gated on `AuthService.isAuthenticated() === true` — no reconciliation attempts fire while the user is signed out, even if `online` or `visibilitychange` events occur

**Given** the app is running in a background tab and the network reconnects
**When** the `online` event fires while `document.visibilityState === 'hidden'`
**Then** reconciliation still runs (visibility is not a gate for reconnect — reconnect is the user-impactful event); on next foreground, no duplicate trigger fires because 3.8's `isReconciling` guard plus the updated `lastReconciledAt` prevent it

**Given** auto-trigger logic introduces a new debounce window for `visibilitychange` (rapid Cmd-Tab between tabs)
**When** events fire in quick succession
**Then** events within a 1-second debounce window collapse to a single evaluation — protects against quota burn on rapid tab switching even before the TTL gate fires

---
