# Bug 001: Hydration — Schema Mismatch and Tab Name Pattern

Status: review

Priority: P0 — Critical. Hydration never runs. Zero entries visible. Breaks the core "Sheets as source of truth" contract.

## Background

Story 2.6 implemented multi-year entry hydration but was developed against an assumed sheet structure that does not match the user's actual spreadsheet. Confirmed via network trace: the app reads header rows (`!A1:F1`) for every tab then stops — no data rows (`!A2:F`) are ever requested. Two primary root causes block hydration entirely, and two secondary causes would have silently broken it even if the primaries were fixed.

### Actual sheet structure (confirmed from screenshots)

| Col A | Col B | Col C | Col D | Col E |
|---|---|---|---|---|
| Month | Date | Category | Price | Remarks |
| "01" | "03.01" | "Groceries" | 27.90 | "Assorted goods" |

- Tab names: `CH Daily Expenses 2026`, `CH Daily Expenses 2025`, `CH Daily Expenses 2027`, etc.
- Date format in col B: `DD.MM` (Swiss locale, e.g. `03.01` = January 3rd)
- Month in col A: two-digit month number (`01`, `02`, ...)
- Year: embedded in tab name — must be extracted
- No UUID column

### Root causes

| ID | Severity | Description |
|---|---|---|
| RC-1 | PRIMARY | `YEAR_TAB_PATTERN = /^\d{4}$/` requires tab names that are exactly four digits. "CH Daily Expenses 2026" never matches → schemaCache always empty → hydration has no tabs to process |
| RC-2 | PRIMARY | `detectSchema()` recognises only 2026 (`["Date","Category","Amount","Remarks","Month","UUID"]`) and 2025 (`["Date","Category","Amount","Remarks"]`). Actual headers `["Month","Date","Category","Price","Remarks"]` match neither → `type:'invalid'` → never enters schemaCache |
| RC-3 | SECONDARY | `hydratedAt` written unconditionally even when `validCount === 0` → tab permanently sealed as `already-hydrated` on next boot → no self-healing |
| RC-4 | SECONDARY | `readTabDataRows` uses default `FORMATTED_VALUE` → date cells written via `USER_ENTERED` return locale strings, not ISO → the strict `^\d{4}-\d{2}-\d{2}$` regex in `mapRowToLocalEntry` rejects every row |

## Story

As Nick,
I want the hydration system to read my actual Google Sheets tab names and column layout,
So that every existing entry is visible in the app immediately after connecting my sheet,
because the Sheet is the permanent source of truth and the app is a read wrapper over it.

**Scope constraints:**
- Read-only hydration only — this bug fix does not add write-back capability for the natural schema. Entries hydrated from natural-schema tabs carry `isReadOnly: true`. Write-back is a separate story.
- All four root causes must be fixed in a single deployment. RC-3 and RC-4 fixes are required to prevent the same failure mode recurring once RC-1 and RC-2 are resolved.
- A boot-time migration must clear any `hydratedAt` entries with `rowCount === 0` so users already stuck in the poisoned state are unblocked without manual intervention.

## Acceptance Criteria

1. **Given** a spreadsheet with tabs named `CH Daily Expenses 2026`, `CH Daily Expenses 2025`, `CH Daily Expenses 2027` (or any tab whose name contains a 4-digit year matching `/\b(20\d{2})\b/`) **When** the user connects the sheet via setup **Then** all qualifying tabs are detected and enter `schemaCache` with the correct schema type

2. **Given** a tab whose header row is `["Month","Date","Category","Price","Remarks"]` **When** `detectSchema()` reads it **Then** the result is `{ type: 'natural', tabName }` — not `invalid`, not `mismatch`

3. **Given** a qualifying natural-schema tab **When** hydration runs **Then** `readTabDataRows` fetches rows using `valueRenderOption=UNFORMATTED_VALUE` so raw numeric and text values are returned without locale formatting

4. **Given** a data row `["01","03.01","Groceries","27.90","Assorted goods from Migros"]` from a tab named `CH Daily Expenses 2026` **When** `mapNaturalRowToLocalEntry` processes it **Then** the result is a `LocalEntry` with `date:"2026-01-03"`, `month:"2026-01"`, `year:2026`, `category:"Groceries"`, `amount:27.90`, `remarks:"Assorted goods from Migros"`, `schemaVersion:'natural'`, `isReadOnly:true`, `syncStatus:'synced'`, and a deterministic `id` of `natural-CH Daily Expenses 2026-<rowIndex>`

5. **Given** a row with a non-numeric price, an unparseable date, or a missing category **When** `mapNaturalRowToLocalEntry` processes it **Then** it returns `null` — that row is skipped and counted as invalid without aborting the tab

6. **Given** hydration processes a tab but all rows fail mapping (`validCount === 0`) **When** the tab run ends **Then** `appMeta.hydratedAt` is NOT updated for that tab — the tab remains unhydrated so the next boot retries it (RC-3 fix)

7. **Given** a tab where `validCount === 0` and rows were present **When** the tab run ends **Then** a `{ type: 'deferred' }` result is recorded and `NotificationService` surfaces a descriptive error so the failure is visible, not silent

8. **Given** the app boots and `appMeta.hydratedAt` contains any entry with `rowCount === 0` (written by a prior buggy run) **When** `HydrationService.init()` runs **Then** those poisoned entries are removed from `hydratedAt` before hydration begins, so the affected tabs are re-attempted on this boot (migration, runs once per boot until clean)

9. **Given** hydration runs after the fix is deployed **When** natural-schema tabs are processed **Then** all entries from those tabs appear in the entries list with correct date, month, year, category, amount, and remarks — the `CHF 0.00` total is replaced by the correct monthly aggregate

10. **Given** a tab named `CH Daily Expenses 2026` has already been successfully hydrated (`rowCount > 0` in `hydratedAt`) **When** the user relaunches the app **Then** that tab is skipped as `already-hydrated` and `entries.init()` loads the persisted rows from IDB — no duplicate hydration

11. **Given** a tab whose name contains a year but whose headers do not match 2026, 2025, or natural schema **When** schema detection runs **Then** that tab is recorded as `{ type: 'skipped', reason: 'non-year-schema' }` and no data read is attempted

12. **Given** 2026-schema tabs exist alongside natural-schema tabs in the same spreadsheet **When** hydration runs **Then** both schema types are processed in the same hydration pass — 2026 tabs use `mapRowToLocalEntry`, natural tabs use `mapNaturalRowToLocalEntry`

## Tasks / Subtasks

### Task 1 — Tab year extraction (`sheets.model.ts`) — fixes RC-1

- [x] Replace `YEAR_TAB_PATTERN = /^\d{4}$/` with `YEAR_IN_TAB_PATTERN = /\b(20\d{2})\b/`
- [x] Export `extractYearFromTabName(tabName: string): number | null` — runs `YEAR_IN_TAB_PATTERN.exec(tabName)`, returns `Number(m[1])` or `null`
- [x] Update all existing references to `YEAR_TAB_PATTERN` throughout the codebase to use `YEAR_IN_TAB_PATTERN` or `extractYearFromTabName` as appropriate

### Task 2 — Natural schema types (`sheets.model.ts`) — fixes RC-2

- [x] Export `SCHEMA_NATURAL_HEADERS = ['Month', 'Date', 'Category', 'Price', 'Remarks']`
- [x] Export `schemaNaturalValidator = z.tuple([z.literal('Month'), z.literal('Date'), z.literal('Category'), z.literal('Price'), z.literal('Remarks')])`
- [x] Add `{ type: 'natural'; tabName: string }` variant to `TabSchemaResult` discriminated union
- [x] Update `HydrationTabResult` skipped reason: rename `'non-2026-schema'` to `'non-year-schema'` (more accurate — we now skip tabs that have no year in the name or an unrecognised schema, not merely non-2026)

### Task 3 — `LocalEntry` model update (`entry.model.ts`)

- [x] Add `'natural'` to the `schemaVersion` union: `'2025' | '2026' | 'natural'`
- [x] Verify `NewEntryInput.schemaVersion` defaulting logic in `EntriesService.add()` is unaffected (new entries continue to default to `'2026'`)

### Task 4 — `detectSchema` extension (`sheets.service.ts`) — fixes RC-2

- [x] After the existing 2025 check and before the `invalid` fallthrough, add:
  ```
  if (schemaNaturalValidator.safeParse(headers.slice(0, 5)).success)
    return { type: 'natural', tabName }
  ```
- [x] The detection order remains: 2026 full → 2026 mismatch → 2025 → natural → invalid
- [x] No change to existing 2026/2025 detection logic

### Task 5 — `mapNaturalRowToLocalEntry` (`sheets.service.ts`) — fixes RC-2

New pure helper method, no IO. Column positions are fixed for the natural schema:

| Index | Header | Value example | Mapped to |
|---|---|---|---|
| 0 | Month | "01" | (validation only — month derived from col B) |
| 1 | Date | "03.01" | date parsed as DD.MM + year from tabName |
| 2 | Category | "Groceries" | category |
| 3 | Price | "27.90" or "-200" | amount |
| 4 | Remarks | "Migros" | remarks |

- [x] Extract year via `extractYearFromTabName(tabName)` — return `null` if year not found
- [x] Parse col B as `DD.MM`: split on `'.'`, validate both parts are numeric 2-digit strings, construct `YYYY-MM-DD`
- [x] Validate `Number.isFinite(amount)` and amount string is non-empty
- [x] Validate category is non-empty
- [x] Return `null` for any validation failure
- [x] Deterministic id: `` `natural-${tabName}-${rowIndex}` ``
- [x] Set `schemaVersion: 'natural'`, `isReadOnly: true`, `syncStatus: 'synced'`
- [x] Set `month` as `YYYY-MM` derived from the parsed date (not from col A, which is redundant)
- [x] Set `year` as the extracted year number

### Task 6 — `readTabDataRows` fix (`sheets.service.ts`) — fixes RC-4

- [x] Append `&valueRenderOption=UNFORMATTED_VALUE` to the `values/{range}` URL
- [x] Verify the `map((res) => res?.values ?? [])` downstream handler is unaffected — `UNFORMATTED_VALUE` still returns `string[][]` for text cells and numeric strings for number cells

### Task 7 — `listYearTabs` update (`sheets.service.ts`)

- [x] Replace `YEAR_TAB_PATTERN.test(s.properties.title)` with `extractYearFromTabName(s.properties.title) !== null`
- [x] `listYearTabs` is not called by `_runHydration` in the current implementation (it uses `schemaCache` directly) but must be kept consistent for future use and spec alignment

### Task 8 — Setup flow update (`setup.component.ts`)

- [x] Extend schemaCache type annotation from `Record<string, '2026' | '2025'>` to `Record<string, '2026' | '2025' | 'natural'>`
- [x] In the `for (const r of results)` loop that builds `schemaCache`, add `r.type === 'natural'` to the condition
- [x] Natural tabs must NOT trigger the mismatch/invalid warning messages — they are a recognised valid schema. Ensure the `invalids` and `mismatches` filter arrays exclude `type: 'natural'` results
- [x] No change to the connect/navigate flow

### Task 9 — Hydration updates (`hydration.service.ts`) — fixes RC-1, RC-3

- [x] **Schema cache type**: update local `schemaCache` variable type to `Record<string, '2026' | '2025' | 'natural'>`

- [x] **Tab filter logic**: replace the current `schema !== '2026'` guard with a check that admits both `'2026'` and `'natural'` schema types, and also verifies the tab name contains a year (using `extractYearFromTabName`):
  ```
  const isYearTab = extractYearFromTabName(name) !== null;
  if (!isYearTab || (schema !== '2026' && schema !== 'natural')) {
    results.push({ type: 'skipped', tabName: name, reason: 'non-year-schema' });
    return false;
  }
  ```

- [x] **Row mapper dispatch**: inside the per-tab loop, dispatch to the correct mapper based on schema:
  ```
  const entry = schema === 'natural'
    ? this.sheets.mapNaturalRowToLocalEntry(tabName, sheetRowIndex, rows[r])
    : this.sheets.mapRowToLocalEntry(tabName, sheetRowIndex, rows[r]);
  ```

- [x] **`hydratedAt` guard** (RC-3 fix): gate the IDB write and `hydrated` result on `validCount > 0`. When `validCount === 0` and `rows.length > 0`, push `{ type: 'deferred', tabName, error: SCHEMA_VALIDATION }` and call `NotificationService.showError` instead of writing to `hydratedAt`. When `rows.length === 0` (genuinely empty tab), write `hydratedAt` with `rowCount: 0` — an empty tab is not a failure.

- [x] **Boot migration** (one-time unlock for users already in the poisoned state): add a private `clearPoisonedHydratedAt()` method called at the top of `init()` before `hydrate()`:
  - Read `appMeta.hydratedAt`
  - Filter out entries where `rowCount === 0` (poisoned by the old bug)
  - If any were removed, write the cleaned map back to IDB
  - This is safe to run on every boot — it is a no-op once the map is clean

### Task 10 — Unit tests

- [x] `sheets.service.spec.ts` — `extractYearFromTabName`:
  - `"CH Daily Expenses 2026"` → `2026`
  - `"CH Daily Expenses 2025"` → `2025`
  - `"2027"` → `2027` (exact four-digit name still works)
  - `"share"` → `null`
  - `"Sheet8"` → `null`
  - `"Preparations to CH budgets"` → `null`

- [x] `sheets.service.spec.ts` — `schemaNaturalValidator`:
  - `["Month","Date","Category","Price","Remarks"]` → passes
  - `["Date","Category","Amount","Remarks","Month","UUID"]` → fails
  - `["Month","Date","Category","Amount","Remarks"]` → fails (Price ≠ Amount)

- [x] `sheets.service.spec.ts` — `detectSchema`:
  - Natural headers → `{ type: 'natural', tabName }`
  - 2026 headers → unchanged `{ type: '2026', tabName }`
  - 2025 headers → unchanged `{ type: '2025', tabName }`

- [x] `sheets.service.spec.ts` — `mapNaturalRowToLocalEntry`:
  - Happy path: `("CH Daily Expenses 2026", 2, ["01","03.01","Groceries","27.90","Assorted goods"])` → `LocalEntry` with `date:"2026-01-03"`, `month:"2026-01"`, `year:2026`, `amount:27.90`, `schemaVersion:'natural'`, `isReadOnly:true`, `id:"natural-CH Daily Expenses 2026-2"`
  - Negative amount: `"-200"` → `amount:-200` (valid — credits/refunds exist in the sheet)
  - Tab with no year in name → returns `null`
  - Non-numeric price `"abc"` → returns `null`
  - Invalid date `"99.99"` → returns `null` (day/month out of range — basic sanity only, not full calendar validation)
  - Missing category → returns `null`

- [x] `hydration.service.spec.ts`:
  - Natural-schema tab with 3 valid rows → 3 `LocalEntry` records written to IDB, `hydratedAt[tabName]` written with `rowCount: 3`, `refreshFromIdb()` called
  - Tab where all rows fail parsing (`validCount === 0`, `rows.length > 0`) → `hydratedAt` NOT updated, `type: 'deferred'` in results, `NotificationService.showError` called
  - Empty tab (`rows.length === 0`) → `hydratedAt` written with `rowCount: 0` (legitimately empty, not a failure)
  - `clearPoisonedHydratedAt`: IDB has `{ '2026': { rowCount: 0 }, '2025': { rowCount: 150 } }` → after migration, only `'2025'` remains; `idb.set` called once with the cleaned map
  - `clearPoisonedHydratedAt`: IDB map is already clean → `idb.set` not called (no-op)
  - Mixed-schema spreadsheet: one `'2026'` tab and one `'natural'` tab both processed in the same hydration pass

## Dev Notes

### Date parsing for natural schema

The DD.MM format in col B is text, not a Sheets date serial. With `UNFORMATTED_VALUE`, it comes back as the raw string `"03.01"`. The year is always derived from the tab name, never from the cell. Parsing:

```typescript
const parts = ddMm.split('.');      // ["03", "01"]
const day   = parts[0].padStart(2, '0');
const month = parts[1].padStart(2, '0');
// validate: day 01-31, month 01-12 (range, not full calendar check)
const date  = `${year}-${month}-${day}`;  // "2026-01-03"
```

Full calendar validation (e.g. February 30th) is deliberately out of scope — the sheet is the source of truth; if the data is in the sheet it is treated as valid.

### `UNFORMATTED_VALUE` effect on other columns

With `UNFORMATTED_VALUE`:
- Text cells (Category, Remarks, Date "03.01"): returned as-is — no change
- Number cells (Price "27.90"): returned as a bare number string `"27.9"` or `"27.90"` — `Number()` handles both
- Negative numbers ("-200"): returned as `"-200"` — `Number()` handles correctly
- Existing 2026-schema tabs: the Date column there contains ISO strings written by `appendRow`; these come back unchanged as `"2026-01-03"` under `UNFORMATTED_VALUE` and continue to pass the ISO regex

### `isReadOnly: true` on natural schema entries

Natural-schema entries are marked `isReadOnly: true` because the app has no write path for this column layout. The edit/delete UI should suppress the edit button for these entries. This is consistent with the planned 2025-schema treatment in Story 3.6. A follow-up story will add write-back capability for natural-schema tabs if required.

### `schemaVersion: 'natural'` in LocalEntry

Adding `'natural'` to the `schemaVersion` union is a local model change with no IDB schema migration required (IDB schema version stays at 1 — the `schemaVersion` field is a plain string value stored inside the entry object, not a key or index). Existing IDB entries with `schemaVersion: '2026'` are unaffected.

### Boot migration safety

`clearPoisonedHydratedAt()` is a read-modify-write on a small object (`appMeta.hydratedAt`). It runs on every boot but is a no-op once the map is clean. It must complete before `hydrate()` is called. If the IDB read fails, the migration is silently skipped (boot must continue) — the next boot will retry.

### Tab skipped reason rename

`'non-2026-schema'` → `'non-year-schema'` in `HydrationTabResult`. This is a type-level rename. Any test or component that matches on the string literal needs updating. Search: `non-2026-schema`.

### What this bug fix does NOT change

- `appendRow` write path — new entries continue to be written in 2026 column format to the active 2026 tab
- `EntriesService.add()` — unaffected; always targets a 2026-schema tab
- `CategoriesService` — category seeding reads from a dedicated Categories tab or column B fallback; unaffected
- Story 3.6 scope — 2025-schema hydration remains owned by Story 3.6; this fix only adds the natural schema

### Files changed

```
src/app/core/models/sheets.model.ts          — YEAR_IN_TAB_PATTERN, extractYearFromTabName, schemaNaturalValidator, TabSchemaResult
src/app/core/models/entry.model.ts           — schemaVersion union
src/app/core/services/sheets.service.ts      — detectSchema, mapNaturalRowToLocalEntry, readTabDataRows, listYearTabs
src/app/core/services/hydration.service.ts   — schema dispatch, hydratedAt guard, clearPoisonedHydratedAt
src/app/features/setup/setup.component.ts    — schemaCache build loop
src/app/core/services/sheets.service.spec.ts — new tests (Tasks 5–6)
src/app/core/services/hydration.service.spec.ts — updated tests (Task 9)
```

## Dev Agent Record

### Completion Notes

All four root causes fixed in a single deployment:
- RC-1: `YEAR_TAB_PATTERN` → `YEAR_IN_TAB_PATTERN` + `extractYearFromTabName()` — "CH Daily Expenses 2026" now matches
- RC-2: `schemaNaturalValidator` + `mapNaturalRowToLocalEntry()` + `detectSchema()` extension — natural header layout recognised
- RC-3: `hydratedAt` now only written when `validCount > 0` or tab is genuinely empty; `clearPoisonedHydratedAt()` runs at boot to unblock users already stuck in poisoned state
- RC-4: `readTabDataRows` URL now includes `?valueRenderOption=UNFORMATTED_VALUE` — locale-formatted date strings no longer break the ISO regex in `mapRowToLocalEntry`

`NewEntryInput.schemaVersion` default is unaffected; new entries continue to target 2026-schema tabs.
439 tests pass (26 new tests added across both spec files).

## File List

- `src/app/core/models/sheets.model.ts` — added `YEAR_IN_TAB_PATTERN`, `extractYearFromTabName`, `SCHEMA_NATURAL_HEADERS`, `schemaNaturalValidator`; added `'natural'` to `TabSchemaResult`; renamed skipped reason to `'non-year-schema'`
- `src/app/core/models/entry.model.ts` — added `'natural'` to `schemaVersion` union
- `src/app/core/services/sheets.service.ts` — updated imports, signal types, `connectSheet()` signature; extended `detectSchema()`; added `mapNaturalRowToLocalEntry()`; fixed `readTabDataRows` URL; updated `listYearTabs()`
- `src/app/core/services/hydration.service.ts` — added `extractYearFromTabName` import; added `clearPoisonedHydratedAt()`, called from `init()`; updated schema cache type, tab filter, mapper dispatch, `hydratedAt` guard
- `src/app/features/setup/setup.component.ts` — extended `schemaCache` type; added `natural` to build loop
- `src/app/core/services/sheets.service.spec.ts` — added tests for `extractYearFromTabName`, `schemaNaturalValidator`, natural `detectSchema`, `mapNaturalRowToLocalEntry`, `UNFORMATTED_VALUE` URL; updated `listYearTabs` test
- `src/app/core/services/hydration.service.spec.ts` — updated reason string; added spy for `mapNaturalRowToLocalEntry`; added tests for RC-3, `clearPoisonedHydratedAt`, natural-schema tab, mixed-schema

## Change Log

- 2026-05-10: Bug ticket drafted. P0. Confirmed via network trace — zero data-row requests in the network log. RC-1 (tab name pattern) and RC-2 (schema mismatch) are the primaries; RC-3 (hydratedAt guard) and RC-4 (FORMATTED_VALUE) are secondaries that would have caused silent failure even if RC-1 and RC-2 were fixed. Fix scope: adapt the app to the sheet — sheet is always source of truth.
- 2026-05-10: Implemented. All 4 root causes fixed. 439 tests pass. Status → review.
