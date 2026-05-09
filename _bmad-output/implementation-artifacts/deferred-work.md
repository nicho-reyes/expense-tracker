# Deferred Work

## Deferred from: code review of 1-1-project-scaffold-toolchain-and-ci-cd-pipeline (2026-05-08)

- IDB `upgrade` callback has no `oldVersion` guard — `createObjectStore` calls unconditional; will throw `DOMException: IDBObjectStore already exists` on any future `DB_VERSION` bump. Add `if (oldVersion < 1)` guard before createObjectStore calls. [idb.service.ts:36]
- `SyncQueueItem` flat interface allows `entryData: null` on UPDATE and `targetEntryId: null` on DELETE — no type-level discriminated union enforces the per-operation nullability contracts. Consider a discriminated union in a future refactor. [entry.model.ts:21]
- `schema2026Validator`/`schema2025Validator` use strict `z.tuple` — rejects Sheets tabs with any extra trailing columns. Consider `.rest(z.unknown())` when implementing parsing in Story 1.4. [sheets.model.ts:6]
- `SheetsValueRange.values: string[][]` does not model sparse rows — Sheets API omits trailing empty cells; `row[3]` on a 4-column row with empty Remarks is `undefined`. Parsing layer (Story 1.4) must handle sparse rows explicitly.  [sheets.model.ts:21]
- `Category.id` used as CSS custom property suffix (`--color-[id]`) with no format constraint on the model. Category creation logic (Story 5.x) must sanitize ids to valid CSS ident characters. [category.model.ts:2]
- `IdbService.get<T>` / `set<T>` constrained to `'appMeta'` store; all other store access via raw `getDb()` with no centralized `IDB_ERROR` mapping. Acceptable for scaffold; revisit if IDB errors prove hard to trace. [idb.service.ts:52]
- `IdbService.get<T>` casts `unknown` to `T` with no runtime Zod validation — type safety is asserted not enforced for appMeta values. Low risk for single-user app; if corruption is observed, add per-key Zod schemas. [idb.service.ts:53]

## Deferred from: code review of 1-5-category-registry-seeding-and-css-custom-property-injection (2026-05-09)

- Stale CSS custom properties persist when categories are removed from the sheet — `injectCssProperties` never calls `removeProperty`; relevant when category management (Story 5.x) ships. [categories.service.ts:injectCssProperties]
- `getActive2026TabName` returns first '2026' entry via `Object.entries` — non-deterministic with multiple 2026-schema tabs; year-aware selection added in a later story per spec. [sheets.service.ts:getActive2026TabName]
- No IDB transaction wrapping the `clear` + per-category `set` loop — partial write on tab crash leaves categories store corrupted; requires IdbService architecture change. [categories.service.ts:seedFromSheet]
- `idb.set` for categories casts `value as Category` without runtime type check — TypeScript overloads enforce at compile time but a JS caller could bypass; pre-existing IdbService pattern. [idb.service.ts:set]


## Deferred from: code review of 1-4-first-run-setup-and-google-sheets-discovery (2026-05-08)

- `ensureLoaded` not concurrency-safe — two simultaneous guard activations both see `_loadedFromIdb === false` and race to read IDB; gate with a cached `Promise<void>`. Unlikely in serial Angular router navigation; revisit if guard is called from non-router contexts. [sheets.service.ts:ensureLoaded]
- `connectSheet` non-transactional IDB writes — two sequential `idb.set` calls; mid-flight crash leaves spreadsheetId persisted without schemaCache. Requires IdbService transaction support not yet implemented. [sheets.service.ts:connectSheet]
- 401 from Sheets API maps to generic SHEETS_API, not AUTH_EXPIRED — token expiry during setup shows "Sheets error (401)". Belongs to Story 1.3 (token refresh). [sheets.service.ts:fetchSpreadsheetMeta]
- `_loadedFromIdb` not reset if `idb.get` throws — every subsequent guard activation retries the failing IDB call with no error boundary or fallback state. IDB error handling strategy to be defined in a later story. [sheets.service.ts:ensureLoaded]

## Deferred from: code review of 2-1-entriesservice-idb-crud-and-optimistic-signal-update (2026-05-09)

- `init()` single-flight seals after transient IDB failure — no retry path for the lifetime of the service instance. By-design per spec ("boot must continue with empty list"). A retry/reset mechanism should be considered if offline resilience is required. [entries.service.ts]
- Concurrent `add()` calls: failed A rollback clobbers B's successful signal entry — both capture same `prev` snapshot; A's rollback `set(prev)` discards B's optimistic update even if B's IDB write succeeded. Requires a mutex or event queue. [entries.service.ts:add()]
- Concurrent `update()` + `delete()` stale-capture rollback: interleaved calls can resurface a deleted entry in the signal after a failed update restores its older snapshot. Same root cause as concurrent add() race. [entries.service.ts]
- `update()` allows patching `isReadOnly` and `syncStatus` with no guard — Story 2.4 owns read-only entry protection; guard should be added there. [entries.service.ts:update()]
- E2E `page.reload()` is an imperfect proxy for true tab close+reopen (AC8) — `page.close()` + `context.newPage()` + `page.goto('/')` would exercise full OS-level IDB durability. [e2e/entry-persistence.spec.ts]
- Module-level `fakeDb` mutable state in `idb.service.spec.ts` — concurrent runner risk under `--pool=threads`; tests should obtain db reference via `service.getDb()` rather than module-level variable if parallel runner is adopted. [idb.service.spec.ts]

## Deferred from: code review of 4-1-dashboardcomponent-with-monthly-total-and-month-navigation (2026-05-09)

- FAB button has no click handler — dead affordance; by design, Story 2.2 owns click wiring to MatBottomSheet. [dashboard.component.html]
- `isLoading` set to false after IDB init failure — dashboard shows CHF 0.00 instead of error state; by design per spec ("boot must continue with empty list"), notification service shows error separately. [entries.service.ts, dashboard.component.ts]
- `addMonths` with empty/invalid string produces NaN-NaN silently — not exposed via type-safe navigation UI; low risk for MVP. [month.util.ts]
- `canGoNext` doesn't re-evaluate when local clock crosses midnight without user interaction — minor UX edge case. [dashboard.component.ts]
- `initPromise` single-flight has no reset mechanism — pre-existing design from Story 2.1; relevant if offline resilience with retry is needed. [entries.service.ts]

## Deferred from: code review of 5-2-colorpicker-and-per-category-color-assignment (2026-05-09)

- `removeCssVar()` has no current caller — intentional cross-wave API for Story 5.3 (delete category); stale `--color-*` CSS props persist until then. [categories.service.ts]
- ColorPickerDialog preview area has no `aria-live` region — color selection changes via preset or custom hex are not announced to screen readers (hex text is visible but not live). Low impact given the visual ring indicator. [color-picker.dialog.html]
- Forced-colors / Windows High Contrast Mode: swatch selection ring (box-shadow) is suppressed; all swatches may render as system `ButtonFace`. No `outline` fallback exists. Enhancement for a future accessibility pass. [color-picker.dialog.html]

## Deferred from: code review of 2-5-syncqueue-insert-write-new-entries-to-google-sheets (2026-05-09)

- `_processItem` catch block leaves failed items in `PENDING` status forever — `retryAll()` only processes `SYNC_ERROR` items, so PENDING items that silently failed are permanently outside the retry path. Epic 3 Story 3.1 owns the full state machine with proper error state transitions. [`sync-queue.service.ts:146`]
- `dequeue()`/`markSynced()` decrement `pendingCount` unconditionally regardless of item status — if called on a `SYNC_ERROR` item (Story 3.5 pre-sync review), `pendingCount` underflows while `errorCount` stays inflated. Story 3.5 should differentiate the two methods. [`sync-queue.service.ts:79`]
- No in-flight guard in `_processItem` — concurrent `retryAll()` calls while `appendRow` is in-flight can submit the same item to Google Sheets twice, creating duplicate rows. Story 3.1 state machine should add an in-progress status. [`sync-queue.service.ts:125`]

## Deferred from: code review of 5-3-create-and-delete-categories-with-sheet-write-back (2026-05-09)

- E2E E5-08 IDB seeding race — `beforeEach` seeds categories into IDB before navigation with no `waitForFunction` guard; low-probability flakiness if IDB writes complete after `CategoriesService.init()` fires. [e2e/categories.spec.ts:E5-08]
- UUID vs slug ID inconsistency — categories created via `create()` use `crypto.randomUUID()` for id; `seedFromSheet` uses `slugifyCategoryId(name)` as id; delete+recreate with same name produces a duplicate after next seed import. Pre-existing architectural decision. [categories.service.ts:202]
- EntriesService signal may return empty `[]` if `delete()` is called before `EntriesService.init()` resolves (boot order: CategoriesService.init → EntriesService.init) — silently allows deletion of referenced categories. Theoretical, normal navigation requires user interaction after boot. [categories.service.ts:233]

## Deferred from: code review of 2-4-edit-and-delete-entry-with-confirmation-and-undo (2026-05-09)

- `handleUnauthorized()` in AuthService signs out on every 401 with no token-refresh retry — pre-existing stub added to fix auth interceptor compilation errors; proper retry belongs in Story 1.3. [auth.service.ts:76]
- No sync queue pause during 5-second undo window — a fast Sheets flush during the undo window could process a DELETE before finalization, or an INSERT before the user undoes; Story 3.1 sync processor should block flushes during active undo windows. [notification.service.ts, sync-queue.service.ts]
- `finalizeDelete()` uses stale `snapshot.syncStatus` — if the background processor marks the entry synced during the 5s window, finalizeDelete routes to `dequeue()` instead of `enqueue(DELETE)`, silently dropping the Sheets delete. Story 3.1 should re-read current syncStatus from the signal at finalization time. [entries.service.ts:149]
- `update()` does not update entry `syncStatus` to `'pending'` after enqueuing an UPDATE — the `isPending` indicator on EntryRowComponent stays false while the edit awaits sync; Story 3.1 should set syncStatus in both IDB and signal after enqueuing. [entries.service.ts:101]
- `.text-destructive { color: var(--destructive) !important; }` uses `!important` globally — intentional Material override; revisit if any component needs to locally suppress the destructive color. [styles.scss:52]

## Deferred from: code review of 1-2-google-oauth-authentication-flow (2026-05-08)

- GIS `callback` and `error_callback` closures captured at `initTokenClient` time have no teardown path — a stale callback can fire after the service is re-initialised in tests or if the app ever hot-replaces the service. No Angular `DestroyRef` or `ngOnDestroy` hook exists on the service. Acceptable for a `providedIn: 'root'` singleton with a single lifetime; add a destroy guard if the service scope ever changes. [auth.service.ts:119-124]

## Deferred from: code review of 1-6-app-shell-semantic-color-system-and-light-dark-theme (2026-05-08)

- FAB has no click handler — `<button mat-fab>` is visible and focusable but inert. Story 2.2 wires the tap handler to open `QuickAddSheetComponent`. [src/app/app.html:9-15]
- BottomNav and FAB render on all routes including unauthenticated `/auth` — shell elements display unconditionally. Story 1.2 activates the auth guard to redirect to `/auth` and Story 1.2 can conditionally suppress shell chrome on that route. [src/app/app.html]
- `App.isDark` signal declared but never bound in template — initialized in `ngOnInit` but `app.html` doesn't reference it; it's dead state. Intentional per spec pattern; remove or bind in a future story if theme-aware shell elements are added. [src/app/app.ts:19]

## Deferred from: code review of 2-7-persistent-auth-and-boot-time-silent-reauth (2026-05-09)

- Double `idb.delete` on Path B failure — `init()` deletes the expired/malformed record; `attemptBootSilentReauth()` catch block also calls delete. Harmless (IDB delete of absent key is a no-op); removing the second delete would require restructuring the catch path. [auth.service.ts:attemptBootSilentReauth]
- `_isRefreshInProgress` not cleared in `triggerProactiveRefresh` path — pre-existing from Story 1.3; `triggerProactiveRefresh` does not set the flag itself, so if it's concurrently held, the proactive refresh silently skips. [auth.service.ts:triggerProactiveRefresh]
- `handleUnauthorized()` `finalize()` may not clear `_isRefreshInProgress` if the RxJS observable never reaches the finalize operator (e.g. sync throw before subscription) — pre-existing from Story 1.3. [auth.service.ts:handleUnauthorized]
- Concurrent `init()` calls: both callers read IDB before either sets `_isRefreshInProgress`, so two callers can both enter `attemptBootSilentReauth()` before the guard fires — single-tab assumption (NFR-S2) makes this theoretical; add an init-level mutex if multi-tab sync is ever needed. [auth.service.ts:init]
- E2E IDB seeds use hard-coded `version: 1` — pre-existing pattern; if `IdbService.DB_VERSION` is ever bumped without creating a version-1 schema first, `onupgradeneeded` won't fire in tests, causing `objectStore('appMeta')` to throw. [e2e/support/idb-helpers.ts, e2e/auth.spec.ts]
- Spec `AppError` variant count says "9→10" but actual union has more variants (Stories 5.3 added `CATEGORY_IN_USE` and `CATEGORY_NAME_DUPLICATE`) — doc drift in the story spec; update architecture.md variant count in a docs-sync story. [_bmad-output/implementation-artifacts/2-7-persistent-auth-and-boot-time-silent-reauth.md:Dev Notes]

## Deferred from: code review of 2-6-multi-year-entry-hydration-on-first-sheet-connect (2026-05-10)

- `refreshFromIdb()` called once per tab in hydration loop — O(N tabs) full IDB scans; spec-intended "once per tab to merge into the live signal" per Dev Notes. Optimize to single post-loop call when performance profiling warrants it. [hydration.service.ts:~90]
- Tabs absent from `schemaCache` skipped with reason `'non-2026-schema'` — design intent: only confirmed-2026 tabs are hydrated; newly-added tabs picked up on next manual re-sync (Epic 3). Consider adding `'unknown-schema'` reason variant when Epic 3 ships. [hydration.service.ts:~50]
- `listYearTabs()` / `fetchSpreadsheetMeta()` 429 produces generic error instead of explicit quota message — `readTabDataRows()` has the 429-specific path; `fetchSpreadsheetMeta` uses a different error-mapping branch. Address when rate-limit resilience is tackled in Epic 3. [sheets.service.ts:~263]
- E2E helpers hardcode `'expense-dashboard'` / version `1` — currently correct; export `DB_NAME`/`DB_VERSION` constants from `idb.service.ts` when DB version bumps. [e2e/support/idb-helpers.ts]
- Schema version mismatch mid-hydration undetectable — tab cached as '2026' in `schemaCache` but Sheet headers changed; individual row validation in `mapRowToLocalEntry` provides partial protection. Story 3.6 adds proper schema re-validation. [hydration.service.ts:~44]
