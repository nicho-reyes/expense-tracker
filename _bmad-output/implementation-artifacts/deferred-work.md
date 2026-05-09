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

## Deferred from: code review of 1-2-google-oauth-authentication-flow (2026-05-08)

- GIS `callback` and `error_callback` closures captured at `initTokenClient` time have no teardown path — a stale callback can fire after the service is re-initialised in tests or if the app ever hot-replaces the service. No Angular `DestroyRef` or `ngOnDestroy` hook exists on the service. Acceptable for a `providedIn: 'root'` singleton with a single lifetime; add a destroy guard if the service scope ever changes. [auth.service.ts:119-124]

## Deferred from: code review of 1-6-app-shell-semantic-color-system-and-light-dark-theme (2026-05-08)

- FAB has no click handler — `<button mat-fab>` is visible and focusable but inert. Story 2.2 wires the tap handler to open `QuickAddSheetComponent`. [src/app/app.html:9-15]
- BottomNav and FAB render on all routes including unauthenticated `/auth` — shell elements display unconditionally. Story 1.2 activates the auth guard to redirect to `/auth` and Story 1.2 can conditionally suppress shell chrome on that route. [src/app/app.html]
- `App.isDark` signal declared but never bound in template — initialized in `ngOnInit` but `app.html` doesn't reference it; it's dead state. Intentional per spec pattern; remove or bind in a future story if theme-aware shell elements are added. [src/app/app.ts:19]
