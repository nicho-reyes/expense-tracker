# Sequence Diagrams — expense-dashboard

Generated: 2026-05-08
Source: architecture.md + epics.md

---

## Diagram 1 — App Boot & APP_INITIALIZER Chain (Stories 1.2, 1.5, 1.6)

The boot sequence is the highest-risk ordering problem in the project. `AuthService.init()` must fully complete before `CategoriesService.init()` begins, and all CSS custom properties must be injected before any component renders.

```mermaid
sequenceDiagram
    participant Browser
    participant main.ts
    participant APP_INITIALIZER
    participant AuthService
    participant GIS as Google Identity Services
    participant CategoriesService
    participant IdbService
    participant SheetsService
    participant DOM

    Browser->>main.ts: bootstrap application
    main.ts->>APP_INITIALIZER: run initializers (sequential)

    APP_INITIALIZER->>AuthService: init()
    AuthService->>GIS: check session state (silent iframe)
    alt Valid session exists
        GIS-->>AuthService: token (in-memory only)
        AuthService-->>APP_INITIALIZER: AUTHENTICATED ✓
    else No session
        GIS-->>AuthService: no session
        AuthService->>Browser: redirect → /auth
        note over Browser: Auth flow (see Diagram 4)
        Browser-->>AuthService: OAuth complete, token in memory
        AuthService-->>APP_INITIALIZER: AUTHENTICATED ✓
    end

    APP_INITIALIZER->>CategoriesService: init() [only after AuthService resolves]
    CategoriesService->>IdbService: read categories store
    alt IDB has categories (returning user)
        IdbService-->>CategoriesService: categories[]
    else First run or cache miss
        CategoriesService->>SheetsService: fetchCategories()
        SheetsService-->>CategoriesService: categories[]
        CategoriesService->>IdbService: write categories store
    end
    CategoriesService->>DOM: inject --color-[id] on documentElement.style (all categories)
    CategoriesService-->>APP_INITIALIZER: CSS custom properties injected ✓

    APP_INITIALIZER-->>Browser: initializers complete → first route renders
    note over Browser: All --color-[id] properties guaranteed present before any component paints
```

---

## Diagram 2 — Add Expense: Optimistic Write + Sync Queue Enqueue (Story 2.2, 2.5)

The core write path. The UI must update in <200ms via IDB — the Sheets write is fully background. Developers must never await the Sheets call before updating the signal.

```mermaid
sequenceDiagram
    participant User
    participant QuickAddSheet as QuickAddSheetComponent
    participant EntriesService
    participant IdbService
    participant SyncQueueService
    participant SheetsService
    participant SyncStatusBar

    User->>QuickAddSheet: tap Save (category + non-zero amount)
    QuickAddSheet->>EntriesService: addEntry(entry)

    EntriesService->>IdbService: put('entries', newEntry) [syncStatus: 'pending']
    IdbService-->>EntriesService: write confirmed
    EntriesService->>EntriesService: _entries.update() → signal updated
    EntriesService-->>QuickAddSheet: resolves (<200ms target)

    QuickAddSheet->>QuickAddSheet: light haptic, close drawer
    QuickAddSheet->>QuickAddSheet: return focus → FAB
    note over QuickAddSheet: User sees entry in list immediately (optimistic)

    EntriesService->>SyncQueueService: enqueue({ operation: INSERT, entryData })
    SyncQueueService->>IdbService: put('syncQueue', { status: PENDING, retryCount: 0 })
    SyncStatusBar->>SyncQueueService: pendingCount signal update → shows amber badge

    alt Device is online and token is valid
        SyncQueueService->>SheetsService: appendRow(entry, currentYearTab)
        SheetsService->>SheetsService: Zod validate tab schema first
        alt Schema valid
            SheetsService-->>SyncQueueService: 200 OK, row written (UUID in col F)
            SyncQueueService->>IdbService: dequeue item, update entry syncStatus → 'synced'
            SyncStatusBar->>SyncStatusBar: update lastSyncedAt, show Healthy state
        else Schema invalid
            SheetsService-->>SyncQueueService: AppError.SCHEMA_VALIDATION
            SyncQueueService->>IdbService: item stays PENDING (no data loss)
        end
    else Offline or token invalid
        note over SyncQueueService: Item stays PENDING in IDB — retry handled in Epic 3
    end
```

---

## Diagram 3 — Sync Queue State Machine: Retry & Exponential Backoff (Stories 3.1, 3.2, 3.3)

The full state machine for queue items. This is Epic 3's core complexity. The PENDING → SYNC_ERROR transition and exponential backoff schedule must be clear before implementation begins.

```mermaid
sequenceDiagram
    participant SyncQueueService
    participant IdbService
    participant SheetsService
    participant RetryScheduler
    participant NotificationService
    participant SyncStatusBar
    participant User

    note over SyncQueueService: Item in PENDING state

    SyncQueueService->>SheetsService: attempt Sheets write
    SheetsService-->>SyncQueueService: network error / 5xx

    SyncQueueService->>IdbService: markError(item) → retryCount++, status = SYNC_ERROR
    SyncStatusBar->>SyncStatusBar: show red "sync failed" (tappable)
    SyncQueueService->>SyncQueueService: medium haptic

    SyncQueueService->>RetryScheduler: schedule retry
    note over RetryScheduler: Backoff: 1s → 2s → 4s → 8s → 16s (cap)

    loop Until success or manual action
        RetryScheduler->>SyncQueueService: fire retry (after delay)
        SyncQueueService->>IdbService: item → status = PENDING
        SyncStatusBar->>SyncStatusBar: show amber PENDING state
        SyncQueueService->>SheetsService: attempt Sheets write again

        alt Write succeeds
            SheetsService-->>SyncQueueService: 200 OK
            SyncQueueService->>IdbService: dequeue, entry syncStatus → 'synced'
            SyncQueueService->>IdbService: write lastSyncedAt to appMeta
            SyncStatusBar->>SyncStatusBar: Healthy — "synced Xm ago"
        else Write fails again
            SheetsService-->>SyncQueueService: error
            SyncQueueService->>IdbService: markError(item) → retryCount++
            SyncStatusBar->>SyncStatusBar: back to red SYNC_ERROR state
        end
    end

    note over SyncQueueService: After 1 hour of continuous failure:
    SyncQueueService->>NotificationService: showError("Sync failing — tap to retry")
    NotificationService-->>User: snackbar with retry action

    User->>SyncStatusBar: tap red SYNC_ERROR indicator
    SyncStatusBar->>SyncQueueService: retryAll()
    SyncQueueService->>IdbService: all SYNC_ERROR items → PENDING
    SyncStatusBar->>SyncStatusBar: amber PENDING state
```

---

## Diagram 4 — OAuth PKCE + Token Refresh + Re-auth Resilience (Stories 1.2, 1.3)

Token lifecycle is a hidden complexity axis. Silent refresh is the happy path; the fallback to redirect must preserve all queued data. This diagram covers all three auth transitions developers will need to handle.

```mermaid
sequenceDiagram
    participant Browser
    participant AuthService
    participant GIS as Google Identity Services (GIS)
    participant AuthInterceptor
    participant SheetsService
    participant SyncQueueService

    note over Browser: Path A — First Run / No Session
    Browser->>AuthService: init()
    AuthService->>GIS: check session (silent iframe)
    GIS-->>AuthService: no session
    AuthService->>Browser: navigate → /auth
    Browser->>AuthService: user taps "Sign in with Google"
    AuthService->>GIS: initCodeClient (PKCE)
    GIS-->>AuthService: authorization code
    AuthService->>GIS: exchange code → access token
    GIS-->>AuthService: access token (held in memory ONLY — no localStorage)
    AuthService->>AuthService: isAuthenticated signal → true
    AuthService->>Browser: navigate → /dashboard

    note over Browser: Path B — Returning User, Token Valid
    Browser->>AuthService: init()
    AuthService->>GIS: silent iframe token refresh
    GIS-->>AuthService: fresh token (in memory)
    AuthService-->>Browser: proceed, no redirect

    note over Browser: Path C — Token Expiry During Session
    AuthInterceptor->>SheetsService: outbound API call
    SheetsService-->>AuthInterceptor: HTTP 401
    AuthInterceptor->>AuthService: emit AppError.AUTH_REVOKED
    AuthService->>GIS: silent iframe refresh attempt
    alt Silent refresh succeeds
        GIS-->>AuthService: new token
        AuthService->>AuthInterceptor: retry original request with new token
    else Silent refresh fails
        GIS-->>AuthService: failure
        AuthService->>Browser: redirect → /auth (data in IDB preserved)
        note over Browser: Entry list and cached data remain visible (read mode)
        Browser-->>AuthService: re-auth complete, new token in memory
        AuthService->>SyncQueueService: retryAll() — flush pending queue
        SyncQueueService->>SheetsService: process queued writes
    end
```

---

## Diagram 5 — Offline Detection, Queue Survival & Reconnect Flush (Story 3.4)

Offline resilience is a first-class requirement (NFR-R1: zero entries lost). This diagram shows the full offline → reconnect cycle and how the queue auto-flushes on reconnect.

```mermaid
sequenceDiagram
    participant Device
    participant navigator.onLine
    participant SyncQueueService
    participant EntriesService
    participant IdbService
    participant QuickAddSheet as QuickAddSheetComponent
    participant OfflineIndicator
    participant SyncStatusBar
    participant SheetsService

    Device->>navigator.onLine: 'offline' event fires
    navigator.onLine->>SyncQueueService: isOnline = false
    navigator.onLine->>OfflineIndicator: show grey dot + "Offline" label
    SyncQueueService->>SyncQueueService: suspend active retry scheduler

    note over QuickAddSheet: User continues adding expenses offline
    QuickAddSheet->>EntriesService: addEntry(entry)
    EntriesService->>IdbService: put('entries', entry) [syncStatus: 'pending']
    EntriesService->>EntriesService: signal updated — entry visible in UI immediately
    EntriesService->>SyncQueueService: enqueue(INSERT)
    SyncQueueService->>IdbService: put('syncQueue', { status: PENDING })
    note over SyncQueueService: No network call attempted — item waits in IDB

    SyncStatusBar->>SyncStatusBar: Offline state — grey dot + queued count

    Device->>navigator.onLine: 'online' event fires
    navigator.onLine->>OfflineIndicator: pulse animation (Reconnecting state)
    navigator.onLine->>SyncQueueService: isOnline = true
    SyncQueueService->>IdbService: read all PENDING items from syncQueue
    IdbService-->>SyncQueueService: queued items[]

    loop For each PENDING item (batched where possible)
        SyncQueueService->>SheetsService: batchUpdate(items)
        SheetsService-->>SyncQueueService: 200 OK
        SyncQueueService->>IdbService: dequeue, update entry syncStatus → 'synced'
    end

    SyncQueueService->>IdbService: write lastSyncedAt to appMeta
    SyncStatusBar->>SyncStatusBar: Healthy — "synced just now"
    OfflineIndicator->>OfflineIndicator: hide (online, all synced)

    note over IdbService: Queue survives tab close / app restart — IDB is durable
```
