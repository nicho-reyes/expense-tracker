# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start        # Dev server at http://localhost:4201 (runs set-config first)
npm run build        # Production build with service worker
npm test             # Unit tests via Vitest
npx playwright test  # E2E tests (auto-starts dev server if not running)
npx playwright test e2e/auth.spec.ts  # Run a single E2E spec
```

`prestart` / `prebuild` auto-run `npm run set-config`, which reads `.env` and writes `public/config.json`. Ensure `.env` contains `NG_APP_GOOGLE_CLIENT_ID`.

## Architecture

**Single-user Angular 21 PWA** — Google Sheets as backend ledger, IndexedDB as local store, Google Identity Services (GIS) for OAuth2.

### State: Angular Signals (no RxJS store)

All state lives in `signal()` / `computed()`. Services expose read-only signals via `.asReadonly()`; components derive filtered/sorted views via `computed()`. No NgRx or RxJS state layer.

**Optimistic update pattern** (used throughout):
1. Update signal immediately
2. Persist to IDB
3. On error: rollback signal, show notification

### Data flow

```
User action → Service signal update (optimistic)
           → IDB write (local persistence)
           → Sheets API call (via SyncQueueService, when online)
```

### Boot sequence (`app.config.ts` APP_INITIALIZER)

1. `ConfigService.load()` — fetch `/public/config.json`
2. `AuthService.init()` — silent OAuth2 refresh (10s timeout, never crashes boot)
3. `CategoriesService.init()` — load from IDB, seed from sheet
4. `EntriesService.init()` — load all entries from IDB

Boot errors resolve to empty state — the app never crashes on init.

### Core services (`src/app/core/services/`)

| Service | Responsibility |
|---|---|
| `auth.service.ts` | GIS OAuth2, silent token refresh, 401 recovery |
| `entries.service.ts` | Entry CRUD, `_entries` signal, IDB persistence |
| `sheets.service.ts` | Sheets API v4, schema detection (2025/2026), tab validation |
| `categories.service.ts` | Category load, reorder, CSS custom property injection |
| `idb.service.ts` | Typed IndexedDB wrapper (4 stores: entries, syncQueue, categories, appMeta) |
| `sync-queue.service.ts` | **Stub** — queue management not yet implemented |
| `config.service.ts` | Loads `/public/config.json` at boot |
| `notification.service.ts` | MatSnackBar wrapper, maps `AppError` types to messages |

### Key models (`src/app/core/models/`)

- **`LocalEntry`**: `id` (UUID), `date` (YYYY-MM-DD), `month` (YYYY-MM), `year`, `category`, `amount`, `remarks`, `tabName`, `schemaVersion`, `sheetRowIndex`, `syncStatus`, `isReadOnly`
- **`AppError`**: Discriminated union — `AUTH_*`, `SHEETS_API`, `IDB_ERROR`, `SYNC_FAILED`, `SCHEMA_VALIDATION`, `SCHEMA_MISMATCH`, `NETWORK`, `UNKNOWN_ERROR`
- **`SyncQueueItem`**: `operation` (INSERT/UPDATE/DELETE), `status` (PENDING/SYNC_ERROR), retry metadata

### Google Sheets schema versions

Two tab layouts coexist. Schema is detected via Zod validators in `sheets.model.ts`:
- **2026**: 6 columns (includes UUID); preferred
- **2025**: 4 columns (legacy); read-only migration path

### Routes and guards

- `/auth` — unauthenticated landing
- `/setup` — `authGuard` only (sheet not yet connected)
- `/`, `/entries`, `/sync`, `/settings` — `authGuard` + `setupGuard`

### Shared components (`src/app/shared/components/`)

13 reusable components including `entry-row`, `empty-state`, `category-tile`, `sync-status-bar`, `amount-input`. All are standalone with `OnPush` change detection.

### Categories and CSS custom properties

`CategoriesService` assigns colors from a 12-color palette and injects `--color-{id}` CSS custom properties at runtime, decoupling category color from component styles.

## Testing

- **Unit** (Vitest): `src/**/*.spec.ts` — service and component specs; currently minimal coverage
- **E2E** (Playwright): `e2e/*.spec.ts` — covers auth, entry persistence (writes directly to IDB via `page.evaluate()`), category reorder, offline behavior, sync review
- E2E tests target `http://localhost:4200`; Playwright manages the dev server automatically

## Environment

`.env` (not committed):
```
NG_APP_GOOGLE_CLIENT_ID=<oauth-client-id>
```

`public/config.json` is generated at build/start time and loaded at runtime via `ConfigService`. Missing config causes `authGuard` to redirect to `/auth`.

## PWA

Service worker (`ngsw`) enabled in production only. Registration strategy: `registerWhenStable:30000`. Assets prefetched; lazy assets updated on next visit. IDB provides the offline-first data layer — entries created offline are queued for Sheets sync.
