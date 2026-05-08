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

---
