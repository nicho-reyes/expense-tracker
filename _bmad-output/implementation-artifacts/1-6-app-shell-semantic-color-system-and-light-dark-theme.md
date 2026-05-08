# Story 1.6: App shell, semantic color system, and light/dark theme

Status: done

## Story

As Nick,
I want a polished app shell with a semantic color system and a working light/dark theme toggle,
So that the app is visually consistent from day one and I can switch to dark mode to match my preference.

## Acceptance Criteria

1. All color values in component styles use CSS custom properties (`--background`, `--foreground`, `--card`, `--border`, `--muted`, `--accent`) — no hardcoded hex values in any component `.scss` file
2. When `localStorage['theme']` is `'dark'`, the `dark` class is applied to `<html>` **and** `document.documentElement` has `color-scheme` attribute set to `'dark'` **before the first Angular paint** (FOUC-free via inline script in `index.html`)
3. `tailwind.config.js` `darkMode` key value is `'class'` (already done in Story 1.1 — verify only, do not modify)
4. Tapping the theme toggle in `SettingsComponent` toggles the `dark` class on `<html>`, updates `localStorage['theme']`, and the entire UI reflects the new theme without a page reload
5. When `prefers-reduced-motion: reduce` is active, no entrance animations play on any component (already implemented in `styles.scss` via `* { animation: none !important; transition: none !important; }` — verify only)
6. On a 375px mobile viewport: a bottom navigation bar with 3 items (Dashboard, Entries, Settings), a FAB (`aria-label="Add expense"`), and the main router content area are all present with no horizontal overflow and `padding-bottom: env(safe-area-inset-bottom)` on the bottom nav
7. `manifest.webmanifest` and `ngsw-config.json` are valid and the app is eligible for "Add to Home Screen" on Android Chrome and bookmarkable as standalone on iOS Safari (already done in Story 1.1 — verify only)

## Tasks / Subtasks

- [x] Prevent FOUC: add inline theme script to `index.html` `<head>` (AC: 2)
  - [x] Insert `<script>` block that reads `localStorage.getItem('theme')` and applies `dark` class + `color-scheme` attribute to `document.documentElement` synchronously
  - [x] Script must run before any Angular bootstrap to eliminate flash of wrong theme
- [x] Implement theme bootstrap in `AppComponent` (`src/app/app.ts`) (AC: 2, 4)
  - [x] Expose `isDark = signal(false)` initialized from `localStorage['theme'] === 'dark'`
  - [x] Add `host: { '[class.dark]': 'false' }` is NOT needed — the class is on `<html>`, not `<app-root>`; do NOT add `dark` class to `<app-root>`
  - [x] Read `localStorage['theme']` in constructor or `ngOnInit` and apply to `document.documentElement.classList`
- [x] Implement app shell layout in `app.html` (AC: 6)
  - [x] Outer wrapper: single full-height column (`min-h-dvh flex flex-col`)
  - [x] `<main>` content area: `flex-1 overflow-y-auto pb-20` (80px FAB clearance)
  - [x] `<router-outlet>` inside `<main>`
  - [x] `<app-sync-status-bar>` below `<main>`, above `<app-bottom-nav>` — permanently mounted, never *ngIf
  - [x] `<app-bottom-nav>` at bottom of shell
  - [x] FAB `<button>` fixed position, `aria-label="Add expense"`; `visibility` toggled via signal (drawer logic in Story 2.2)
  - [x] No hardcoded hex anywhere in `app.html` inline styles
- [x] Style app shell in `app.scss` using CSS custom properties only (AC: 1, 6)
  - [x] `background-color: var(--background)` on the outer wrapper
  - [x] Safe area support via `env(safe-area-inset-*)` on full-height layout
- [x] Implement `BottomNavComponent` (replaces stub at `src/app/shared/components/bottom-nav/`) (AC: 6)
  - [x] `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
  - [x] 3 navigation items: Dashboard (`routerLink="/"`), Entries (`routerLink="/entries"`), Settings (`routerLink="/settings"`)
  - [x] `routerLinkActive="active"` with exact match on Dashboard route
  - [x] Active item: indigo icon + label; inactive item: zinc-400
  - [x] `padding-bottom: env(safe-area-inset-bottom)` applied so nav clears iPhone home indicator
  - [x] Touch targets minimum 44×44px on all nav items
  - [x] `<nav>` semantic element wrapping the bar
  - [x] Icon-only buttons must have `aria-label` — if using text labels, include both icon and label
  - [x] No service injection inside this component (presentational only)
  - [x] Imports: `RouterLink`, `RouterLinkActive` from `@angular/router`; `NgClass` or Tailwind-only
- [x] Implement `SyncStatusBar` minimal mount (replaces stub at `src/app/shared/components/sync-status-bar/`) (AC: 6 foundation)
  - [x] `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
  - [x] Template: single `<div aria-live="polite" aria-atomic="true"></div>` with empty initial content
  - [x] **CRITICAL**: do NOT populate with any content in this story — Story 3.2 implements the four states (Healthy, Pending, Error, Offline)
  - [x] **CRITICAL**: mount empty — if content is present on initial render, some screen readers announce it on page load
  - [x] Height: fixed minimum height so it doesn't cause layout shift when Story 3.2 adds content
- [x] Implement FAB in app shell (AC: 6)
  - [x] Fixed position: `position: fixed; bottom: calc(80px + env(safe-area-inset-bottom)); right: 16px`
  - [x] 56×56px, indigo-600 fill (use CSS custom property `var(--accent)`)
  - [x] `aria-label="Add expense"` — required by UX spec UX-DR25
  - [x] `visibility: hidden` state driven by a signal for when the drawer is open — start with `visibility: visible` (drawer opens in Story 2.2); use CSS binding `[style.visibility]="fabVisible() ? 'visible' : 'hidden'"`
  - [x] Implement as `MatFab` (Angular Material FAB) for correct elevation and ripple
  - [x] Add `MatIcon` with `add` icon inside the FAB
- [x] Implement theme toggle in `SettingsComponent` (`src/app/features/settings/`) (AC: 4)
  - [x] `isDark = signal(localStorage.getItem('theme') === 'dark')` initialized in constructor
  - [x] `toggleTheme()` method: toggle `document.documentElement.classList.toggle('dark')`, update `document.documentElement.setAttribute('color-scheme', isDark() ? 'dark' : 'light')`, update `localStorage.setItem('theme', isDark() ? 'dark' : 'light')`, update `isDark` signal
  - [x] Render a `MatSlideToggle` or `MatButton` labeled "Dark mode" with current state shown
  - [x] No `MatSnackBar` or success toast — theme change is visually self-evident
  - [x] `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
- [x] Correct dark theme CSS custom property values in `styles.scss` to match UX spec (zinc scale, not slate scale) (AC: 1, 2)
  - [x] See Dev Notes — Story 1.1 used slate values; UX spec specifies zinc scale
- [x] Verify all tasks from Story 1.1 that this story depends on (AC: 3, 5, 7)
  - [x] Confirm `tailwind.config.js` has `darkMode: 'class'`
  - [x] Confirm `styles.scss` has `@media (prefers-reduced-motion: reduce)` rule
  - [x] Confirm `manifest.webmanifest` has `display: standalone`, theme color, both icon sizes

### Review Findings

- [x] [Review][Patch] `color-scheme` set via `setAttribute` instead of `style.colorScheme` — fixed: replaced `setAttribute('color-scheme', ...)` with `document.documentElement.style.colorScheme` in `index.html`, `app.ts`, and `settings.component.ts`
- [x] [Review][Patch] `env(safe-area-inset-bottom)` missing fallback value — fixed: `env(safe-area-inset-bottom, 0px)` in `app.html`
- [x] [Review][Patch] Bottom nav `<nav>` missing `aria-label` — fixed: added `aria-label="Main navigation"` to `bottom-nav.component.html`
- [x] [Review][Defer] FAB has no click handler [src/app/app.html:9-15] — deferred, Story 2.2 wires FAB to QuickAddSheetComponent
- [x] [Review][Defer] BottomNav and FAB render on all routes including unauthenticated `/auth` [src/app/app.html] — deferred, auth guard activation deferred to Story 1.2
- [x] [Review][Defer] `App.isDark` signal declared but never bound in template [src/app/app.ts:19] — deferred, intentional per spec; may be used by future stories

## Dev Notes

### ⚠️ Critical: Angular 21 Root Component Naming

**The root component file is `src/app/app.ts`, NOT `src/app/app.component.ts`.**

Story 1.1 debug notes confirm: "Angular 21 uses Vitest (not Karma) and new file naming: `app.ts` / `app.html` (no `.component` infix on root component)." The root component class is `AppComponent` in `src/app/app.ts` and its template is `src/app/app.html`.

### ⚠️ Critical: FOUC Prevention (Inline Script in index.html)

The acceptance criterion requires theme class applied **before the first paint**. Angular bootstraps asynchronously — by the time `ngOnInit` fires, the browser has already painted. Without a synchronous script, users with dark mode saved will see a flash of light theme.

Add this inline script to `src/index.html` in the `<head>`, **before** any stylesheets or Angular scripts:

```html
<script>
  (function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('color-scheme', 'dark');
    }
  })();
</script>
```

This runs synchronously before any rendering, eliminating the flash. Angular's `AppComponent` then reads the same `localStorage['theme']` and syncs its `isDark` signal — no conflict because both agree on the initial state.

### ⚠️ Critical: `dark` Class Goes on `<html>`, Not on `<app-root>`

Tailwind's `darkMode: 'class'` looks for the `dark` class on the **`<html>` element** (i.e., `document.documentElement`). Do NOT apply it to `<app-root>` or any inner element — Tailwind's `dark:` utilities will not activate.

```typescript
// ✅ Correct
document.documentElement.classList.add('dark');

// ❌ Wrong — Tailwind dark: variants won't activate
document.querySelector('app-root')?.classList.add('dark');
```

### ⚠️ Critical: SyncStatusBar Must Mount Empty and Permanently

The `SyncStatusBar` MUST:
1. Always be in the DOM — never behind `*ngIf` or `@if`
2. Start with completely empty content
3. Be positioned outside `<router-outlet>` so it persists across route changes

```html
<!-- app.html — CORRECT -->
<main class="flex-1 overflow-y-auto">
  <router-outlet />
</main>
<app-sync-status-bar />  <!-- always mounted, never conditional -->
<app-bottom-nav />

<!-- WRONG — conditional renders break aria-live announcements -->
@if (showSyncBar) {
  <app-sync-status-bar />
}
```

Screen readers only announce content **changes** inside an already-mounted live region. If the region mounts with content, some readers announce it immediately on page load. Mount empty, let Story 3.2 populate it.

### ⚠️ Critical: FAB Visibility Pattern

The FAB must remain in the DOM when the quick-add drawer is open (Story 2.2). Use `visibility: hidden`, NOT `*ngIf` or `display: none`. Focus return from the drawer requires the FAB element to exist in the DOM.

```typescript
// In AppComponent
fabVisible = signal(true);  // Story 2.2 will set this to false when drawer opens
```

```html
<!-- app.html -->
<button
  mat-fab
  aria-label="Add expense"
  class="fixed z-10"
  [style.visibility]="fabVisible() ? 'visible' : 'hidden'"
  style="bottom: calc(80px + env(safe-area-inset-bottom)); right: 16px;">
  <mat-icon>add</mat-icon>
</button>
```

### Dark Theme CSS Custom Properties — Correct Values (UX Spec)

Story 1.1 used **slate** color scale values in `styles.scss` for the dark theme. The UX design specification explicitly calls for the **zinc** scale. Update `styles.scss` dark theme block to:

```scss
:root {
  --background: #fafafa;  /* zinc-50 */
  --foreground: #18181b;  /* zinc-900 */
  --card: #ffffff;         /* white */
  --border: #e4e4e7;       /* zinc-200 */
  --muted: #71717a;        /* zinc-500 */
  --accent: #4f46e5;       /* indigo-600 */
}

.dark {
  --background: #09090b;  /* zinc-950 — was #0f172a (slate-950) */
  --foreground: #fafafa;  /* zinc-50  — was #f8fafc (slate-50, close) */
  --card: #18181b;         /* zinc-900 — was #1e293b (slate-800) */
  --border: #27272a;       /* zinc-800 — was #334155 (slate-700) */
  --muted: #a1a1aa;        /* zinc-400 — was #64748b (slate-500) */
  --accent: #818cf8;       /* indigo-400 — was correct */
}
```

The difference matters — zinc has a neutral cool-gray tone that matches the UX spec visual intent; slate reads slightly bluer. Update these values; they are used by all subsequent epic components.

Also update the light theme `:root` block above — Story 1.1 used approximate values. Use the exact zinc/white values from the UX spec.

### AppComponent Pattern

```typescript
// src/app/app.ts
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    BottomNavComponent,
    SyncStatusBarComponent,
    MatFabButton,
    MatIconModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent implements OnInit {
  readonly fabVisible = signal(true);
  readonly isDark = signal(false);

  ngOnInit(): void {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      this.isDark.set(true);
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('color-scheme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('color-scheme', 'light');
    }
  }
}
```

Note: `isDark` signal on `AppComponent` is not shared with `SettingsComponent` via injection — `SettingsComponent` independently reads `localStorage` and imperatively updates `document.documentElement`. This avoids a `ThemeService` that isn't in the architecture. The UI reflects the correct state because it reads from `document.documentElement.classList` or `localStorage` directly.

### SettingsComponent Theme Toggle Pattern

```typescript
// src/app/features/settings/settings.component.ts
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSlideToggleModule, ...],
  template: `...`,
})
export class SettingsComponent {
  isDark = signal(localStorage.getItem('theme') === 'dark');

  toggleTheme(): void {
    const newIsDark = !this.isDark();
    this.isDark.set(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('color-scheme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('color-scheme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }
}
```

### BottomNavComponent Pattern

```typescript
// src/app/shared/components/bottom-nav/bottom-nav.component.ts
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent {}
```

```html
<!-- bottom-nav.component.html -->
<nav class="flex justify-around items-center h-16 border-t"
     style="background-color: var(--card); border-color: var(--border); padding-bottom: env(safe-area-inset-bottom);">
  <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"
     class="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center"
     aria-label="Dashboard">
    <mat-icon class="nav-icon">dashboard</mat-icon>
    <span class="text-xs">Dashboard</span>
  </a>
  <a routerLink="/entries" routerLinkActive="active"
     class="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center"
     aria-label="Entries">
    <mat-icon class="nav-icon">receipt_long</mat-icon>
    <span class="text-xs">Entries</span>
  </a>
  <a routerLink="/settings" routerLinkActive="active"
     class="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center"
     aria-label="Settings">
    <mat-icon class="nav-icon">settings</mat-icon>
    <span class="text-xs">Settings</span>
  </a>
</nav>
```

Nav item active/inactive colors via CSS in the component's SCSS:
```scss
// Use CSS custom properties — no hardcoded hex
.active { color: var(--accent); }
a:not(.active) { color: var(--muted); }
```

### Component Mandatory Pattern (No Exceptions)

Every component in this story must follow:

```typescript
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...],   // named imports only — never MaterialModule barrel
})
```

Use `input()` / `output()` signal APIs — never `@Input()` / `@Output()` decorators.

### App Shell Layout (app.html)

```html
<!-- src/app/app.html -->
<div class="flex flex-col min-h-dvh" style="background-color: var(--background);">
  <main class="flex-1 overflow-y-auto pb-20" style="color: var(--foreground);">
    <router-outlet />
  </main>
  <app-sync-status-bar />
  <app-bottom-nav />
</div>

<button
  mat-fab
  aria-label="Add expense"
  class="fixed z-10"
  [style.visibility]="fabVisible() ? 'visible' : 'hidden'"
  style="bottom: calc(80px + env(safe-area-inset-bottom)); right: 16px; background-color: var(--accent);">
  <mat-icon>add</mat-icon>
</button>
```

**`min-h-dvh` not `min-h-screen`**: `dvh` units account for iOS Safari's collapsing address bar. `100vh` is taller than the visible viewport on iOS; `100dvh` is correct. The architecture enforces this: "Use `dvh` units (not `vh`) for full-screen overlays and sheets."

**`pb-20`**: 80px padding on main content area so the last list item is not occluded by the fixed FAB.

### Angular Material FAB Import

In Angular Material 18+/standalone, use:
```typescript
import { MatFabButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
```

The selector is `button[mat-fab]`. Do not use `mat-mini-fab`.

### Angular Material Imports for BottomNav

`routerLinkActive` requires `RouterLink` and `RouterLinkActive` imported in the component's `imports` array:
```typescript
import { RouterLink, RouterLinkActive } from '@angular/router';
```

### What This Story Does NOT Implement

The following are explicitly deferred to later stories — do not implement them here:
- FAB tap handler and QuickAddSheetComponent open logic → Story 2.2
- SyncStatusBar actual states (Healthy, Pending, Error, Offline) → Story 3.2
- OfflineIndicator → Story 3.4
- CategoryManager or ColorPicker → Epic 5
- Auth guard redirect logic → Story 1.2
- APP_INITIALIZER wiring → Stories 1.2 and 1.5

### auth.guard.ts and Route Protection

Story 1.6 does NOT activate the auth guard. Routes remain unprotected in this story. The guard stub created in Story 1.1 should pass through (return `true`) until Story 1.2 activates it.

### Testing This Story

Manual verification checklist:
1. `ng serve` — app loads at `http://localhost:4200`
2. Open DevTools → Application → Local Storage → set `theme: 'dark'` → reload → no flash of light theme
3. Navigate to Settings → toggle theme → UI transitions without page reload
4. Inspect `<html>` element — confirms `dark` class + `color-scheme="dark"` attribute present
5. Open DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` → no animations
6. DevTools → Responsive → 375px width → bottom nav visible, FAB visible, no horizontal scroll
7. DevTools → Application → Manifest → installability criteria listed (no critical errors)

Unit test: write a spec for `BottomNavComponent` that confirms 3 nav items render and `routerLinkActive` is applied. Mock `Router` as needed.

### CSS Custom Properties — No Hardcoded Hex Rule

**All** color values in component `.scss` files must use CSS custom properties. Violations block Story 1.6 completion:

```scss
// ✅ Correct
background-color: var(--background);
color: var(--foreground);
border-color: var(--border);

// ❌ Wrong — hardcoded hex never in component styles
background-color: #ffffff;
color: #18181b;
```

The tokens defined in `styles.scss` `:root` and `.dark` blocks are the ONLY place hex values appear in the entire codebase (except per-category `--color-[id]` values managed by `CategoriesService`).

### Project Structure Notes

Files touched in this story — all must exist from Story 1.1 stubs:

| Action | Path |
|--------|------|
| UPDATE | `src/index.html` — add FOUC-prevention inline script |
| UPDATE | `src/app/app.ts` — theme reading, shell imports |
| UPDATE | `src/app/app.html` — full shell layout |
| UPDATE | `src/app/app.scss` — shell-level CSS custom property usage |
| UPDATE | `src/styles.scss` — correct zinc-scale dark theme values |
| UPDATE | `src/app/shared/components/bottom-nav/bottom-nav.component.ts` — implement |
| CREATE | `src/app/shared/components/bottom-nav/bottom-nav.component.html` — nav template |
| UPDATE | `src/app/shared/components/sync-status-bar/sync-status-bar.component.ts` — empty live region |
| CREATE | `src/app/shared/components/sync-status-bar/sync-status-bar.component.html` |
| UPDATE | `src/app/features/settings/settings.component.ts` — theme toggle |
| UPDATE | `src/app/features/settings/settings.component.html` — toggle UI |

All stub files were created in Story 1.1. Do NOT create new directories or restructure — the architecture is already laid out.

Services live in `src/app/core/services/` — do not create a `ThemeService` unless strictly necessary. The inline `localStorage` approach in `AppComponent` and `SettingsComponent` is sufficient and aligned with the architecture's simplicity preference.

### References

- Dark mode CSS class toggle: [Source: architecture.md#Dark-Mode] + [Source: architecture.md#Gap-Analysis-Results Gap-3]
- CSS custom property color system: [Source: ux-design-specification.md#Color-System]
- Exact zinc-scale token values: [Source: ux-design-specification.md#Color-System] (Light and Dark theme tables)
- Safe area insets: [Source: architecture.md#UX-Accessibility-Constraints] + [Source: ux-design-specification.md#Implementation-Guidelines]
- `dvh` units: [Source: ux-design-specification.md#Implementation-Guidelines]
- SyncStatusBar permanent mount + empty init: [Source: ux-design-specification.md#Accessibility-Development] + [Source: architecture.md#UX-Accessibility-Constraints]
- FAB `visibility: hidden` pattern: [Source: epics.md#Story-2.2-AC] + [Source: ux-design-specification.md#Accessibility-Development]
- `prefers-reduced-motion`: [Source: epics.md#Story-1.6-AC] + [Source: ux-design-specification.md#iOS-specific]
- Component mandatory pattern: [Source: architecture.md#Component-Architecture] + [Source: architecture.md#Enforcement-Guidelines]
- Tailwind `darkMode: 'class'`: [Source: architecture.md#Dark-Mode]
- Bottom nav visual spec: [Source: ux-design-specification.md#Navigation-Patterns]
- FAB spec: [Source: ux-design-specification.md#Button-Hierarchy] + [Source: epics.md#Story-2.2-AC aria-label]
- Story 1.1 debug notes (Angular 21 naming): [Source: 1-1-project-scaffold-toolchain-and-ci-cd-pipeline.md#Debug-Log-References]
- Story 1.1 CSS vars baseline: [Source: 1-1-project-scaffold-toolchain-and-ci-cd-pipeline.md#styles.scss-Global-Setup]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Angular 21 root component class name is `App` (not `AppComponent`) as established in Story 1.1 — kept consistent, updated `app.ts` to add `OnInit` implementation without renaming the class.
- Story 1.1 stub class names for `BottomNavComponent` and `SyncStatusBarComponent` were mangled (`UbottomUnavComponent`, `UsyncUstatusUbarComponent`) — fixed to correct class names in this story.
- `ng test` must be run via `PATH` override using Node 22 (`~/.nvm/versions/node/v22.12.0/bin`) since system Node is v16. The Angular CLI unit-test builder (`@angular/build:unit-test`) handles vitest globals; bare `npx vitest run` does not.
- Worktree `.claude/worktrees/1.2/` spec files pollute bare vitest output — this is a pre-existing issue unrelated to Story 1.6; `ng test` handles it cleanly.

### Completion Notes List

- Implemented FOUC prevention via synchronous inline `<script>` in `index.html` `<head>` — reads `localStorage['theme']` and applies `dark` class + `color-scheme` attribute before any Angular paint.
- Updated `app.ts` (`App` class) with `OnInit`, `fabVisible` and `isDark` signals, and `ngOnInit` that bootstraps theme state from `localStorage`. Added `BottomNavComponent`, `SyncStatusBarComponent`, `MatFabButton`, and `MatIconModule` to the imports array.
- Rewrote `app.html` with the full shell layout: `min-h-dvh` flex column, `<main>` with `flex-1 overflow-y-auto pb-20`, always-mounted `<app-sync-status-bar>` and `<app-bottom-nav>`, and a fixed `MatFab` with `[style.visibility]` binding (AC 6).
- Replaced `BottomNavComponent` stub with full implementation: 3 nav items (Dashboard/Entries/Settings), `RouterLink`/`RouterLinkActive`, semantic `<nav>`, 44px touch targets, `env(safe-area-inset-bottom)` padding, SCSS-only active/inactive coloring via CSS custom properties (AC 6).
- Replaced `SyncStatusBarComponent` stub with empty `aria-live="polite"` region with 24px `min-height` — ready for Story 3.2 state population (AC 6 foundation).
- Implemented `SettingsComponent` with `MatSlideToggle`, `isDark` signal initialized from `localStorage`, and `toggleTheme()` that imperatively updates `document.documentElement`, `localStorage`, and the signal without page reload (AC 4).
- Corrected `styles.scss` CSS custom properties from slate scale (Story 1.1 error) to zinc scale per UX spec: `--background: #fafafa`, `--foreground: #18181b`, `--card: #ffffff`, `--border: #e4e4e7`, `--muted: #71717a`, `--accent: #4f46e5` (light); `--background: #09090b`, `--foreground: #fafafa`, `--card: #18181b`, `--border: #27272a`, `--muted: #a1a1aa`, `--accent: #818cf8` (dark) (AC 1, 2).
- Verified Story 1.1 baselines: `tailwind.config.js` `darkMode: 'class'` ✓, `styles.scss` `prefers-reduced-motion` ✓, `manifest.webmanifest` display:standalone + 8 icons ✓ (AC 3, 5, 7).
- Wrote 5 unit tests for `BottomNavComponent` covering: creation, 3 nav items rendered, correct routes (`/`, `/entries`, `/settings`), semantic `<nav>` element, and accessible `aria-label` on all items. All 11 tests pass (6 test files).
- Build succeeds clean with no TypeScript or template errors.

### File List

- `src/index.html` — added FOUC prevention inline `<script>` to `<head>`
- `src/app/app.ts` — added `OnInit`, `signal`, `fabVisible`/`isDark` signals, `ngOnInit` theme bootstrap, `BottomNavComponent`/`SyncStatusBarComponent`/`MatFabButton`/`MatIconModule` imports
- `src/app/app.html` — full shell layout: flex column, main content area, always-mounted sync-status-bar and bottom-nav, fixed FAB with visibility signal binding
- `src/app/app.scss` — added `:host { display: block; }`
- `src/styles.scss` — corrected CSS custom property values from slate to zinc scale (light and dark theme)
- `src/app/shared/components/bottom-nav/bottom-nav.component.ts` — full implementation replacing stub (fixed class name, added imports, templateUrl/styleUrl)
- `src/app/shared/components/bottom-nav/bottom-nav.component.html` — nav template with 3 items, routerLink/routerLinkActive, safe-area padding
- `src/app/shared/components/bottom-nav/bottom-nav.component.scss` — active/inactive colors via CSS custom properties
- `src/app/shared/components/bottom-nav/bottom-nav.component.spec.ts` — 5 unit tests (new file)
- `src/app/shared/components/sync-status-bar/sync-status-bar.component.ts` — minimal implementation with correct class name and templateUrl
- `src/app/shared/components/sync-status-bar/sync-status-bar.component.html` — empty aria-live region
- `src/app/shared/components/sync-status-bar/sync-status-bar.component.scss` — 24px min-height
- `src/app/features/settings/settings.component.ts` — theme toggle with MatSlideToggle, isDark signal, toggleTheme()
- `src/app/features/settings/settings.component.html` — Dark mode toggle UI

### Change Log

- Implemented Story 1.6: App shell, semantic color system, and light/dark theme (2026-05-08)
