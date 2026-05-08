# Deferred Work

## Deferred from: code review of 1-1-project-scaffold-toolchain-and-ci-cd-pipeline (2026-05-08)

- IDB `upgrade` callback has no `oldVersion` guard — `createObjectStore` calls unconditional; will throw `DOMException: IDBObjectStore already exists` on any future `DB_VERSION` bump. Add `if (oldVersion < 1)` guard before createObjectStore calls. [idb.service.ts:36]
- `SyncQueueItem` flat interface allows `entryData: null` on UPDATE and `targetEntryId: null` on DELETE — no type-level discriminated union enforces the per-operation nullability contracts. Consider a discriminated union in a future refactor. [entry.model.ts:21]
- `schema2026Validator`/`schema2025Validator` use strict `z.tuple` — rejects Sheets tabs with any extra trailing columns. Consider `.rest(z.unknown())` when implementing parsing in Story 1.4. [sheets.model.ts:6]
- `SheetsValueRange.values: string[][]` does not model sparse rows — Sheets API omits trailing empty cells; `row[3]` on a 4-column row with empty Remarks is `undefined`. Parsing layer (Story 1.4) must handle sparse rows explicitly.  [sheets.model.ts:21]
- `Category.id` used as CSS custom property suffix (`--color-[id]`) with no format constraint on the model. Category creation logic (Story 5.x) must sanitize ids to valid CSS ident characters. [category.model.ts:2]
- `IdbService.get<T>` / `set<T>` constrained to `'appMeta'` store; all other store access via raw `getDb()` with no centralized `IDB_ERROR` mapping. Acceptable for scaffold; revisit if IDB errors prove hard to trace. [idb.service.ts:52]
- `IdbService.get<T>` casts `unknown` to `T` with no runtime Zod validation — type safety is asserted not enforced for appMeta values. Low risk for single-user app; if corruption is observed, add per-key Zod schemas. [idb.service.ts:53]

## Deferred from: code review of 1-2-google-oauth-authentication-flow (2026-05-08)

- GIS `callback` and `error_callback` closures captured at `initTokenClient` time have no teardown path — a stale callback can fire after the service is re-initialised in tests or if the app ever hot-replaces the service. No Angular `DestroyRef` or `ngOnDestroy` hook exists on the service. Acceptable for a `providedIn: 'root'` singleton with a single lifetime; add a destroy guard if the service scope ever changes. [auth.service.ts:119-124]
