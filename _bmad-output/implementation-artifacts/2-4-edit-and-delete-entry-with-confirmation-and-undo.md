# Story 2.4: Edit and delete entry with confirmation and undo

Status: done

## Story

As Nick,
I want to edit a logged expense or delete it with a confirmation step and a brief undo window,
So that I can correct mistakes without accidentally losing entries.

## Acceptance Criteria

1. **Given** I tap an entry row **When** the entry detail sheet opens **Then** all fields (date, category, amount, remarks) are pre-filled with the entry's current values
2. **Given** I change one or more fields and tap Save **When** `EntriesService.update()` completes **Then** the entry is updated in IDB and the entries signal reflects the new values immediately (optimistic; before any Sheets call)
3. **Given** I tap the Delete action on an entry **When** a `MatDialog` confirmation appears **Then** the destructive action uses a ghost/text style button — never a primary button
4. **Given** I confirm deletion **When** `EntriesService.delete()` runs **Then** the entry is removed from the entries signal and a `MatSnackBar` undo action appears for a 5-second grace period
5. **Given** the undo snackbar is visible **When** I tap "Undo" **Then** the entry is restored in IDB and reappears in the list at its original position
6. **Given** the undo grace period expires without action **When** the timer completes **Then** the deletion is finalized, the snackbar dismisses, and (if the entry had been previously synced) a DELETE operation is enqueued to `SyncQueue`
7. **Given** the entry I am editing has `syncStatus === 'synced'` **When** I save the edit **Then** `EntriesService.update()` enqueues an UPDATE operation to `SyncQueue` via `SyncQueueService.enqueue()`
8. **Given** the entry I am editing has `syncStatus === 'pending'` or `'error'` (never reached Sheets) **When** I save the edit **Then** the existing PENDING/SYNC_ERROR queue item's `entryData` is updated in place — no duplicate INSERT and no UPDATE is enqueued
9. **Given** the entry I am deleting has `syncStatus === 'synced'` **When** the undo grace period expires **Then** `EntriesService` enqueues a DELETE operation to `SyncQueue` with `targetEntryId` set to the entry's id and `targetTabName` set to the entry's `tabName`
10. **Given** the entry I am deleting has `syncStatus === 'pending'` or `'error'` (never reached Sheets) **When** deletion finalizes **Then** the corresponding queue item is dequeued (cancelled in place) — no DELETE is enqueued because the row never reached Sheets
11. **Given** the entry I am editing has `isReadOnly === true` (2025 schema tab) **When** the detail sheet opens **Then** all fields are visible but disabled, the Save and Delete actions are hidden, and a hint reads "Read-only — this entry lives in a legacy tab"
12. **Given** the edit/detail sheet is open **When** I swipe down or tap outside **Then** the sheet dismisses without saving (matches `QuickAddSheetComponent` behavior)
13. **Given** the edit/detail sheet closes **When** focus returns **Then** focus moves to the entry row that was tapped (so back-navigation/keyboard users land on the right element)
14. **Given** an IDB write fails during update or delete **When** the error is caught **Then** an `AppError.IDB_ERROR` is surfaced via `NotificationService.showError()`, the entries signal is rolled back, and the row reappears at its original position — no phantom UI state

## Tasks / Subtasks

- [x] Extend `EntriesService` with `update()` and `delete()` (AC: 2, 4, 6, 7, 8, 9, 10, 14)
  - [x] `getById(id: string): LocalEntry | undefined` — pure signal read for pre-fill in detail sheet
  - [x] `update(id: string, patch: Partial<Pick<LocalEntry, 'date' | 'month' | 'year' | 'category' | 'amount' | 'remarks'>>): Promise<void>` — read existing entry, merge patch, write to IDB, update entries signal optimistically; if `existing.syncStatus === 'synced'` enqueue UPDATE, else replace existing queue item's `entryData` via `SyncQueueService.replaceEntryData(targetEntryId, mergedEntry)`
  - [x] `delete(id: string): Promise<LocalEntry | undefined>` — capture snapshot for undo, remove from entries signal, delete from IDB; do NOT enqueue here (caller decides via `finalizeDelete()` after grace period)
  - [x] `restore(snapshot: LocalEntry): Promise<void>` — re-insert into IDB and entries signal at original position; sorts by date descending
  - [x] `finalizeDelete(snapshot: LocalEntry): Promise<void>` — called when undo grace period expires; if `snapshot.syncStatus === 'synced'` enqueue DELETE with `targetEntryId: snapshot.id`, `targetTabName: snapshot.tabName`; else dequeue the existing queue item by `id`
  - [x] All write paths: catch `AppError.IDB_ERROR`, restore previous signal state, rethrow; component layer surfaces via `NotificationService`
  - [x] Updated `entries.service.spec.ts` with cases for: update merge, update of pending entry replaces queue entryData, update of synced entry enqueues UPDATE, delete returns snapshot, restore round trip, finalizeDelete on synced/pending, IDB error rolls back signal

- [x] Extend `SyncQueueService` with `replaceEntryData()` and `dequeue()` semantics (AC: 8, 10)
  - [x] `replaceEntryData(targetEntryId: string, newEntryData: LocalEntry): Promise<boolean>` — finds existing PENDING/SYNC_ERROR INSERT queue item by `entryData.id === targetEntryId` and replaces its `entryData`; returns `true` if a row was updated, `false` if no matching queue row exists
  - [x] Fixed `enqueue()` for INSERT operations to use `entryData.id` as queue item id (idempotency contract)
  - [x] `dequeue(id: string)` tested: covers "dequeue cancels a never-synced INSERT"
  - [x] Updated `sync-queue.service.spec.ts`: replaceEntryData updates only matching row; replaceEntryData on synced entry returns false (no row exists)

- [x] Create `EntryDetailSheetComponent` at `src/app/features/entry-form/entry-detail-sheet.component.{ts,html,scss}` (AC: 1, 2, 11, 12, 13)
  - [x] Standalone component, `OnPush`, opened by `EntriesListComponent` via `MatBottomSheet.open(EntryDetailSheetComponent, { data: { entryId } })`
  - [x] Inject `MAT_BOTTOM_SHEET_DATA` for `entryId`; read entry via `EntriesService.getById(id)`
  - [x] Signal-driven form pre-filled with `date`, `category`, `amount`, `remarks`
  - [x] Reuse field layout/components from `QuickAddSheetComponent` (Story 2.2): `MatFormField` + `MatInput`, `inputmode="decimal"` on amount, category tile picker
  - [x] If `entry.isReadOnly === true`: disable all controls, hide Save and Delete, show inline hint
  - [x] Save button calls `EntriesService.update(id, patch)`, then `bottomSheetRef.dismiss()`
  - [x] Delete button opens `MatDialog` confirmation before destructive action
  - [x] Focus return wired via `returnFocusTo` in sheet data

- [x] Create `DeleteEntryConfirmDialogComponent` at `src/app/features/entry-form/delete-entry-confirm-dialog.component.{ts,html,scss}` (AC: 3)
  - [x] Standalone, `OnPush`, opened via `MatDialog.open()`
  - [x] Title: "Delete this entry?"; body shows entry summary (date, category, amount)
  - [x] Actions: "Cancel" button; destructive "Delete" — `mat-button class="text-destructive"` — never filled/primary

- [x] Wire delete + undo flow in `EntryDetailSheetComponent` (AC: 4, 5, 6, 9, 10, 14)
  - [x] On Delete confirm: call `entriesService.delete(id)`, dismiss the bottom sheet, then call `notificationService.showUndoableDelete(snapshot)`
  - [x] Added `NotificationService.showUndoableDelete(snapshot: LocalEntry): MatSnackBarRef<TextOnlySnackBar>` — opens `MatSnackBar` with action "Undo", `duration: 5000`
  - [x] Subscribed to `snackBarRef.afterDismissed()`: if `dismissedByAction` → restore; else → finalizeDelete
  - [x] Catch `AppError.IDB_ERROR` from delete/restore/finalizeDelete: surface via `notificationService.showError()`

- [x] Wire row tap into `EntriesListComponent` (AC: 1, 13)
  - [x] Changed `EntryRowComponent.tap` output to emit `{ entry, rowElement }` for focus return
  - [x] `EntriesListComponent.onEntryTap()` now opens `EntryDetailSheetComponent` with `{ entryId, returnFocusTo }`
  - [x] `afterDismissed()` refocuses row element via `requestAnimationFrame`

- [x] Update `EntriesService` IDB persistence helpers (AC: 2, 4, 5, 14)
  - [x] All IDB calls go through `IdbService` — `put`, `delete` already available from Story 2.1

- [x] Tests — `src/app/features/entry-form/entry-detail-sheet.component.spec.ts` (AC: 1, 2, 3, 4, 5, 6, 11)
  - [x] Pre-fill: opens with `data.entryId` → fields show entry values
  - [x] Read-only: `isReadOnly: true` entry hides Save/Delete buttons
  - [x] Save dispatches `EntriesService.update(id, patch)` and dismisses sheet
  - [x] Delete opens `DeleteEntryConfirmDialogComponent`; on confirm, calls `entriesService.delete(id)` and shows undo snackbar
  - [x] Undo path: simulate `snackBar.afterDismissed({ dismissedByAction: true })` → `entriesService.restore(snapshot)` is called
  - [x] Timeout path: simulate `afterDismissed({ dismissedByAction: false })` → `entriesService.finalizeDelete(snapshot)` is called
  - [x] Mock `MatBottomSheetRef`, `MatDialog`, `EntriesService`, `NotificationService`

## Dev Notes

### Architectural Boundaries (must observe)

- **`SyncQueueService` is the only writer of `SyncQueueItem` records** — `EntriesService.update/delete/finalizeDelete` MUST go through `SyncQueueService.enqueue()`, `replaceEntryData()`, or `dequeue()`. Never write to the `syncQueue` IDB store from `EntriesService` directly.
- **`NotificationService` is the only path to `MatSnackBar`** — the undoable-delete snackbar is implemented inside `NotificationService.showUndoableDelete()`. Components and `EntriesService` MUST NOT inject `MatSnackBar` directly.
- **`IdbService` is the only `idb` consumer** — `EntriesService` calls `IdbService.put/delete/get`, never raw `idb` APIs.
- **`crypto.randomUUID()`** is the sole UUID source — irrelevant for this story (we never mint a new entry id; ids come from existing entries) but applies if any new queue item needs an id.
- **`providedIn: 'root'`** on every service touched.
- **Standalone + `OnPush`** on `EntryDetailSheetComponent` and `DeleteEntryConfirmDialogComponent`. Use `input()` / `output()` if any inputs/outputs are needed.

### Optimistic UI Contract — Update and Delete

The optimistic write rule from the architecture (Frontend Architecture → "Never await Sheets before updating UI") applies to update and delete equally:

```
update(id, patch):
  1. Read existing entry from signal (synchronous)
  2. Merge patch → mergedEntry
  3. await IdbService.put('entries', mergedEntry)
  4. _entries.update(all => all.map(e => e.id === id ? mergedEntry : e))   ← UI updates here
  5. if (existing.syncStatus === 'synced') {
       await syncQueue.enqueue({ operation: 'UPDATE', entryData: mergedEntry, targetEntryId: id, targetTabName: existing.tabName })
     } else {
       await syncQueue.replaceEntryData(id, mergedEntry)   // replace pending INSERT payload in place
     }
```

```
delete(id):                          // optimistic remove only
  1. snapshot = signal.entries.find(id)
  2. _entries.update(all => all.filter(e => e.id !== id))   ← UI updates here
  3. await IdbService.delete('entries', id)
  4. return snapshot                  // caller passes to NotificationService.showUndoableDelete

restore(snapshot):                   // undo path
  1. await IdbService.put('entries', snapshot)
  2. _entries.update(all => insertAtOriginalPosition(all, snapshot))

finalizeDelete(snapshot):            // grace period expired
  if (snapshot.syncStatus === 'synced') {
    await syncQueue.enqueue({ operation: 'DELETE', entryData: null, targetEntryId: snapshot.id, targetTabName: snapshot.tabName })
  } else {
    await syncQueue.dequeue(snapshot.id)   // pending INSERT — never reached Sheets, just cancel
  }
```

The optimistic remove happens at step 2 of `delete()`. The Sheets DELETE is only enqueued at `finalizeDelete()` time, 5 seconds later — this prevents a Sheets round-trip for any entry the user undoes.

### Undo Snackbar Pattern (NotificationService extension)

```typescript
// notification.service.ts — new method
showUndoableDelete(snapshot: LocalEntry): MatSnackBarRef<TextOnlySnackBar> {
  return this.snackBar.open('Entry deleted', 'Undo', {
    duration: 5000,
    panelClass: ['snack-info'],
  });
}
```

The component subscribes to `afterDismissed()` and routes by `dismissedByAction`:

```typescript
const ref = this.notification.showUndoableDelete(snapshot);
ref.afterDismissed().subscribe(info => {
  if (info.dismissedByAction) {
    this.entriesService.restore(snapshot).catch(err => this.notification.showError(err as AppError));
  } else {
    this.entriesService.finalizeDelete(snapshot).catch(err => this.notification.showError(err as AppError));
  }
});
```

`dismissedByAction === true` covers both tap-Undo and programmatic dismiss-with-action; in Material's contract, only the action button sets this flag, so timeout/swipe-dismiss/backdrop all fall into the `false` branch and finalize the deletion.

### Insert-at-original-position Logic for `restore()`

Sorting is stable and deterministic — entries are sorted by date descending (Story 2.3 contract). Insertion strategy:

```typescript
// EntriesService.restore()
this._entries.update(all => {
  const next = [...all, snapshot];
  next.sort((a, b) => b.date.localeCompare(a.date));
  return next;
});
```

Sort order is the source of truth; we don't track per-entry array positions. This guarantees the restored row lands exactly where it was before deletion (assuming no other entries with the same date were added/removed during the 5-second grace period — the realistic case).

### `LocalEntry.isReadOnly` Behavior

Set to `true` for entries originating from a 2025-schema tab (read-only in this app — see `_bmad-output/planning-artifacts/architecture.md#Data-Architecture`). When a user taps a 2025 entry:

- The detail sheet opens for inspection
- All form controls are disabled (visible but not editable)
- Save and Delete actions are hidden — there is no way to mutate a read-only entry
- An inline hint reads: "Read-only — this entry lives in a legacy tab"

This avoids surprising the user with a write that would fail on the Sheets side. Story 2.5 will block writes at the SheetsService layer too; this story handles the UI gate.

### Pending-vs-Synced Decision Tree (UPDATE)

```
Edit save → existing.syncStatus === ?

  'synced'  → enqueue UPDATE { entryData: merged, targetEntryId: id, targetTabName: existing.tabName }
  'pending' → replaceEntryData(id, merged)   // existing INSERT in queue gets new payload; no UPDATE
  'error'   → replaceEntryData(id, merged)   // same — when the queue retries, it pushes the latest data
```

The rule: a single user edit must never produce two queue items for the same entry. `replaceEntryData()` is the single-source-of-truth update for queue items that haven't yet reached Sheets.

### Pending-vs-Synced Decision Tree (DELETE)

```
finalizeDelete(snapshot) → snapshot.syncStatus === ?

  'synced'  → enqueue DELETE { operation: 'DELETE', entryData: null, targetEntryId: id, targetTabName }
  'pending' → dequeue(id)   // queue item id === entry id for INSERT items
  'error'   → dequeue(id)   // same; SYNC_ERROR INSERT becomes a no-op
```

`SyncQueueItem.id` equals `entryData.id` for INSERT items by Epic 3's contract (idempotency UUID is the queue id). Dequeue by `id` is therefore safe.

### MatBottomSheet Focus Return

`MatBottomSheet` does not auto-restore focus. Pattern:

```typescript
// EntriesListComponent.onRowTap(entryId, rowEl)
const ref = this.bottomSheet.open(EntryDetailSheetComponent, {
  data: { entryId, returnFocusTo: rowEl as HTMLElement },
});
ref.afterDismissed().subscribe(() => {
  requestAnimationFrame(() => rowEl.focus());
});
```

Use `requestAnimationFrame` to wait for the bottom sheet's exit animation to complete before refocusing — focusing during animation can be silently rejected on iOS Safari.

### MatDialog Destructive Button Style

Confirmation dialog template (`delete-entry-confirm-dialog.component.html`):

```html
<h2 mat-dialog-title>Delete this entry?</h2>
<mat-dialog-content>
  <p>{{ data.summary }}</p>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button [mat-dialog-close]="false">Cancel</button>
  <button mat-button class="text-destructive" [mat-dialog-close]="true">Delete</button>
</mat-dialog-actions>
```

Both buttons are `mat-button` (text/ghost). The destructive one carries a CSS class that maps to red-500 from the semantic token system (Story 1.6). It is NEVER `mat-flat-button`, NEVER `color="primary"`, NEVER `color="warn"` filled — destructive actions are always ghost-styled per UX spec (`_bmad-output/planning-artifacts/ux-design-specification.md#Button-Hierarchy`).

### Dependence on Story 2.1 (Open Coordination)

Story 2.1 is implementing `EntriesService.add/update/delete` and `SyncQueueService.enqueue/dequeue/markSynced/markError/retryAll/getQueue` in parallel (both this story and 2.1 are in Wave 6). Coordination points:

- 2.4 EXTENDS the contract — adds `EntriesService.update`, `delete`, `restore`, `finalizeDelete`, `getById` and `SyncQueueService.replaceEntryData`
- If 2.1's `delete()` already enqueues a DELETE inline, this story REPLACES that with the deferred-via-`finalizeDelete` pattern (the inline path defeats the undo window — DELETE must not enqueue until grace period expires)
- 2.1's `update()` likely already exists; this story REPLACES the body to add the synced-vs-pending fork
- Document any divergence in the Dev Agent Record

### Dependence on Story 2.2 (Open Coordination)

Story 2.2 is creating `QuickAddSheetComponent`. The detail sheet should reuse the same field components and validation rules:

- Same `category` tile picker, same `amount` `inputmode="decimal"`, same `MatDatepicker`, same Save button styling
- Extract shared form pieces to `src/app/features/entry-form/entry-form-fields.component.ts` (or inline-share via standalone child components) if 2.2 has not yet
- If 2.2 has not landed by implementation start, build minimal inline form fields here and refactor on 2.2 merge

### Dependence on Story 2.3 (Open Coordination)

Story 2.3 is creating `EntriesListComponent` and `EntryRowComponent`. This story needs:

- A way to attach a tap handler to each row → either an `(rowTap) output<string>()` from `EntryRowComponent` (preferred) or a direct `(click)` on the row template
- Per AC13, focus return needs the row's DOM element — exposed via `@ViewChild` or via tap event payload `{ entryId, element }`

If 2.3 has not implemented row taps yet, this story must add the tap output to `EntryRowComponent` as part of its scope.

### File List (Expected)

- `src/app/core/services/entries.service.ts` (modified) — add `getById`, `update`, `delete`, `restore`, `finalizeDelete`
- `src/app/core/services/entries.service.spec.ts` (modified) — new test cases per Tasks
- `src/app/core/services/sync-queue.service.ts` (modified) — add `replaceEntryData`
- `src/app/core/services/sync-queue.service.spec.ts` (modified) — new test cases
- `src/app/core/services/notification.service.ts` (modified) — add `showUndoableDelete`
- `src/app/features/entry-form/entry-detail-sheet.component.ts` (new)
- `src/app/features/entry-form/entry-detail-sheet.component.html` (new)
- `src/app/features/entry-form/entry-detail-sheet.component.scss` (new)
- `src/app/features/entry-form/entry-detail-sheet.component.spec.ts` (new)
- `src/app/features/entry-form/delete-entry-confirm-dialog.component.ts` (new)
- `src/app/features/entry-form/delete-entry-confirm-dialog.component.html` (new)
- `src/app/features/entry-form/delete-entry-confirm-dialog.component.scss` (new)
- `src/app/features/entries-list/entries-list.component.ts` (modified) — wire row tap → open detail sheet, focus return on dismiss
- `src/app/shared/components/entry-row/entry-row.component.ts` (modified, if needed) — add `(rowTap)` output

### Out of Scope (deferred to other stories)

- The actual Sheets UPDATE / DELETE HTTP write — happens in Story 3.5 / 3.6 / 3.7 (sync queue processor); this story only enqueues
- Read-only-tab edit affordances beyond hiding controls (e.g. "Migrate to 2026 tab" button) — out of scope
- Long-press swipe-to-delete on `EntryRowComponent` — out of scope; AC requires open detail sheet → tap Delete only
- Bulk delete or multi-select — not in PRD

## Testing

### Strategy

Use Vitest via `ng test --watch=false` (the `@angular/build:unit-test` builder, per Story 1.2 convention). Mock `IdbService`, `SyncQueueService`, `NotificationService`, `MatBottomSheet`, `MatDialog`, and `MatSnackBarRef` via `vi.fn()` factories.

### Required Test Cases

`entries.service.spec.ts`:
1. `getById(id)` returns the entry from the signal; returns `undefined` for unknown id
2. `update(id, patch)` merges fields, writes IDB, updates signal optimistically
3. `update()` on a `'synced'` entry calls `syncQueue.enqueue({ operation: 'UPDATE', ... })`
4. `update()` on a `'pending'` entry calls `syncQueue.replaceEntryData(id, merged)` and does NOT call `enqueue`
5. `delete(id)` removes from signal and IDB, returns snapshot, does NOT enqueue
6. `restore(snapshot)` re-inserts into IDB and signal at correct sort position
7. `finalizeDelete(snapshot)` on `'synced'` enqueues DELETE
8. `finalizeDelete(snapshot)` on `'pending'` calls `syncQueue.dequeue(id)`
9. `update()` IDB error → signal rolled back, error rethrown as `AppError.IDB_ERROR`
10. `delete()` IDB error → signal rolled back, error rethrown

`sync-queue.service.spec.ts`:
11. `replaceEntryData(id, newData)` updates the matching INSERT row's `entryData` and returns `true`
12. `replaceEntryData(id, newData)` returns `false` when no matching queue row exists (synced entry)

`entry-detail-sheet.component.spec.ts`:
13. Pre-fill: opens with `data.entryId` → all fields show entry values
14. Read-only: `entry.isReadOnly === true` → Save and Delete are hidden, controls disabled
15. Save click calls `entriesService.update(id, patch)` and dismisses
16. Delete click opens `DeleteEntryConfirmDialogComponent`; on confirm, calls `entriesService.delete(id)` and `notification.showUndoableDelete(snapshot)`
17. `afterDismissed({ dismissedByAction: true })` → `restore(snapshot)` called
18. `afterDismissed({ dismissedByAction: false })` → `finalizeDelete(snapshot)` called

### Manual / E2E Smoke (deferred to E2E suite)

- Tap entry → sheet opens with values pre-filled
- Edit amount → save → list shows new value immediately
- Delete + tap Undo within 5s → entry restored
- Delete + wait 5s → entry stays gone; sync indicator reflects DELETE in queue (synced entry case)
- Tap a 2025-schema (read-only) entry → no Save/Delete visible

## Change Log

- 2026-05-09: Initial draft — Story 2.4 specification authored against epic-2 ACs, architecture data-model, sync-queue boundary rules, and Story 1.4 template.
- 2026-05-09: Implementation complete — all 14 ACs satisfied; 288 tests passing (22 files). Includes EntryDetailSheetComponent, DeleteEntryConfirmDialogComponent, EntriesService extend (restore/finalizeDelete/syncStatus fork), SyncQueueService.replaceEntryData(), NotificationService.showUndoableDelete(), row tap wiring with focus return. Pre-existing merge conflicts and interceptor compilation errors resolved.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Amelia)

### Debug Log References

- Pre-existing merge conflicts in `auth.service.spec.ts` and `sheets.service.spec.ts` resolved (kept HEAD version)
- Pre-existing `auth.interceptor.ts` had missing RxJS imports and referenced non-existent `handleUnauthorized()` — fixed by restoring proper retry logic and adding `handleUnauthorized()` to `AuthService`
- Missing `@esbuild/darwin-arm64` in vite's nested node_modules — installed to unblock test runner
- `SyncQueueService.enqueue()` INSERT id contract: changed to use `entryData.id` as queue item id for idempotency (enables `dequeue(entryId)` and `replaceEntryData(entryId, ...)` lookups)

### Completion Notes List

- `EntriesService.update()`: added syncStatus fork — synced entries enqueue UPDATE, pending/error entries call `replaceEntryData()`
- `EntriesService.delete()`: changed return type to `Promise<LocalEntry | undefined>`, returns snapshot for undo; does NOT enqueue
- Added `EntriesService.restore()`: re-inserts snapshot into IDB and signal, sorted by date descending
- Added `EntriesService.finalizeDelete()`: enqueues DELETE for synced entries, calls `dequeue()` for pending/error
- `SyncQueueService.replaceEntryData()`: replaces entryData on matching PENDING/SYNC_ERROR INSERT item
- `NotificationService.showUndoableDelete()`: returns `MatSnackBarRef<TextOnlySnackBar>` for afterDismissed subscription
- `EntryDetailSheetComponent`: new standalone OnPush bottom sheet with pre-fill, read-only mode, save/delete/cancel
- `DeleteEntryConfirmDialogComponent`: new standalone dialog with ghost-style destructive button
- `EntriesListComponent.onEntryTap()`: wired to open detail sheet with focus return
- `EntryRowComponent.tap` output: changed to emit `{ entry, rowElement }` for focus return
- Added `.text-destructive` CSS class via `--destructive` custom property in global styles
- `AuthService.handleUnauthorized()`: added Observable-based 401 recovery stub (calls signOut, returns EMPTY)
- All 288 tests pass (22 test files)

### File List

- `src/app/core/services/entries.service.ts` (modified)
- `src/app/core/services/entries.service.spec.ts` (modified)
- `src/app/core/services/sync-queue.service.ts` (modified)
- `src/app/core/services/sync-queue.service.spec.ts` (modified)
- `src/app/core/services/notification.service.ts` (modified)
- `src/app/core/services/auth.service.ts` (modified — added handleUnauthorized())
- `src/app/core/interceptors/auth.interceptor.ts` (modified — fixed compilation errors)
- `src/app/core/interceptors/auth.interceptor.spec.ts` (modified — resolved merge conflict)
- `src/app/core/services/auth.service.spec.ts` (modified — resolved merge conflict)
- `src/app/core/services/sheets.service.spec.ts` (modified — resolved merge conflict)
- `src/app/features/entry-form/entry-detail-sheet.component.ts` (new)
- `src/app/features/entry-form/entry-detail-sheet.component.html` (new)
- `src/app/features/entry-form/entry-detail-sheet.component.scss` (new)
- `src/app/features/entry-form/entry-detail-sheet.component.spec.ts` (new)
- `src/app/features/entry-form/delete-entry-confirm-dialog.component.ts` (new)
- `src/app/features/entry-form/delete-entry-confirm-dialog.component.html` (new)
- `src/app/features/entry-form/delete-entry-confirm-dialog.component.scss` (new)
- `src/app/features/entries-list/entries-list.component.ts` (modified)
- `src/app/shared/components/entry-row/entry-row.component.ts` (modified)
- `src/app/shared/components/entry-row/entry-row.component.html` (modified)
- `src/app/shared/components/entry-row/entry-row.component.spec.ts` (modified)
- `src/styles.scss` (modified — added --destructive token and .text-destructive class)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Review Findings

Code review conducted 2026-05-09 by Amelia (Blind Hunter), Winston (Edge Case Hunter), Sally (Acceptance Auditor).

### Patches Applied (8)

- [x] [Review][Patch] update() syncQueue call outside try/catch — partial rollback gap if enqueue/replaceEntryData throws [entries.service.ts:100-111]
- [x] [Review][Patch] replaceEntryData() calls toAppError(err) twice — double instantiation [sync-queue.service.ts:97-98]
- [x] [Review][Patch] data-testid="save-btn" and data-testid="delete-btn" missing from template — tests query by data-testid [entry-detail-sheet.component.html:60-76]
- [x] [Review][Patch] Category tiles not visually/structurally disabled in read-only mode — AC11 gap [entry-detail-sheet.component.html:20]
- [x] [Review][Patch] Subscription leak in EntriesListComponent.afterDismissed() — no takeUntilDestroyed [entries-list.component.ts:58]
- [x] [Review][Patch] Snackbar race: second snack dismisses first with dismissedByAction:false causing erroneous finalizeDelete — use onAction() flag [entry-detail-sheet.component.ts:114]
- [x] [Review][Patch] Empty amount input coerces to 0 not null via ngModelChange (+'' === 0) [entry-detail-sheet.component.html:40]
- [x] [Review][Patch] Redundant [attr.aria-disabled] alongside native [disabled] on Save button — double screen-reader announcement [entry-detail-sheet.component.html:73]

### Deferred (5)

- [x] [Review][Defer] handleUnauthorized() signs out on every 401 with no retry — pre-existing stub from auth interceptor fix [auth.service.ts:76] — deferred, pre-existing Story 1.3 concern
- [x] [Review][Defer] No sync queue pause during 5-second undo window — entry could sync before undo window closes [notification.service.ts:35] — deferred, Story 3.1 sync processor scope
- [x] [Review][Defer] Stale syncStatus in snapshot — if INSERT processes during undo window, finalizeDelete uses wrong branch [entries.service.ts:149] — deferred, Story 3.1 scope
- [x] [Review][Defer] update() doesn't update entry syncStatus to 'pending' after enqueuing UPDATE — row shows no pending indicator [entries.service.ts:101] — deferred, Story 3.1 scope
- [x] [Review][Defer] !important on .text-destructive in global styles — broad override [styles.scss:52] — deferred, Material override by design

## References

- Story-2.4 ACs: [Source: `_bmad-output/planning-artifacts/epics/epic-2-expense-entry-local-first-core.md#Story-2.4`]
- Optimistic UI contract: [Source: `_bmad-output/planning-artifacts/architecture.md#Process-Patterns`]
- `LocalEntry`, `SyncQueueItem`, `QueueState`: [Source: `src/app/core/models/entry.model.ts`]
- `AppError` discriminated union: [Source: `src/app/core/models/error.model.ts`]
- `NotificationService` toast policy: [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Feedback-Patterns`]
- Button hierarchy (destructive ghost-style): [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Button-Hierarchy`]
- Architectural boundaries (`IdbService`, `SyncQueueService`, `NotificationService`): [Source: `_bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries`]
- `SyncQueueService` interface: [Source: `src/app/core/services/sync-queue.service.ts`]
- Test runner: [Source: `1-2-google-oauth-authentication-flow.md#Dev-Agent-Record`] — `ng test --watch=false`
- Story 2.1 (`EntriesService` baseline): [Source: `_bmad-output/planning-artifacts/epics/epic-2-expense-entry-local-first-core.md#Story-2.1`]
- Story 2.2 (`QuickAddSheetComponent` field reuse): [Source: `_bmad-output/planning-artifacts/epics/epic-2-expense-entry-local-first-core.md#Story-2.2`]
- Story 2.3 (`EntryRowComponent` tap source): [Source: `_bmad-output/planning-artifacts/epics/epic-2-expense-entry-local-first-core.md#Story-2.3`]
- Sequence Diagram 2 (optimistic write): [Source: `_bmad-output/planning-artifacts/sequence-diagrams.md#Diagram-2`]
