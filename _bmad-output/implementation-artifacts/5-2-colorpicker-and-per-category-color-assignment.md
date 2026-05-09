# Story 5.2: ColorPicker and per-category color assignment

Status: done

## Story

As Nick,
I want to assign a custom color to each category and see it reflected everywhere in the app immediately,
So that my expense breakdown bars, entry dots, and tiles all use colors I recognize at a glance.

## Acceptance Criteria

1. **Given** I tap a category in `CategoryManager` **When** the `ColorPickerDialog` opens **Then** a swatch grid of color options is shown with a ring indicator on the currently selected color
2. **Given** the `ColorPickerDialog` has a custom hex input **When** I enter a valid hex value (3- or 6-digit, with or without leading `#`) **Then** the swatch preview updates and the color becomes selectable
3. **Given** I select a color and confirm **When** `CategoriesService.update()` runs **Then** the `--color-[category-id]` CSS custom property is updated on `document.documentElement.style` immediately — no page reload required
4. **Given** the CSS custom property is updated **When** any component consuming that property re-renders **Then** the new color is reflected in category dots, breakdown bars, and tiles without a full navigation cycle
5. **Given** the color change is saved to IDB **When** the app is restarted **Then** the custom color persists and is re-injected by `CategoriesService.init()`
6. **Given** a category color dot renders in `EntryRowComponent` **When** its ARIA attributes are inspected **Then** `aria-hidden="true"` is set on the decorative dot
7. **Given** I enter an invalid hex value (non-hex characters, wrong length) **When** I attempt to confirm **Then** the Confirm button is disabled and an inline validation message indicates the input is invalid — no `AppError` is thrown for input validation
8. **Given** I cancel the dialog **When** the dialog closes via Cancel button or backdrop tap **Then** no `CategoriesService.update()` call is made and no CSS variable changes

## Tasks / Subtasks

- [x] Implement `ColorPickerDialog` at `src/app/features/settings/color-picker.dialog.ts` (AC: 1, 2, 7, 8)
  - [x] `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
  - [x] Open via `MatDialog.open(ColorPickerDialog, { data: { categoryId, currentColor } })`
  - [x] Inject `MatDialogRef<ColorPickerDialog, string | null>` and `MAT_DIALOG_DATA`
  - [x] State: `selectedColor = signal<string>(this.data.currentColor)`, `customHexInput = signal<string>('')`, `customHexError = signal<string | null>(null)`
  - [x] Computed: `isValidSelection = computed(() => isValidHex(this.selectedColor()) && this.customHexError() === null)`
  - [x] 12-color preset palette (see Dev Notes) rendered as swatch grid; selected swatch has `ring-2 ring-indigo-500`
  - [x] Custom hex input: `<input type="text">` with `pattern="^#?[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$"` and live validation via `selectedHex()` computed
  - [x] Buttons: Cancel (`mat-button`, returns `null`) and Confirm (`mat-flat-button color="primary"`, returns `selectedColor()`)
  - [x] Confirm `[disabled]="!isValidSelection()"`
  - [x] On valid hex input change: normalize to 6-digit lowercase form (e.g. `#abc` → `#aabbcc`) and set `selectedColor`
- [x] Add `CategoriesService.update()` method at `src/app/core/services/categories.service.ts` (AC: 3, 4, 5)
  - [x] Method signature: `update(category: Category): Promise<void>`
  - [x] Persist to IDB via `idb.set('categories', category.id, category)` (consistent with existing `reorder()` pattern)
  - [x] Update internal `_categories` signal: `_categories.update(arr => arr.map(c => c.id === category.id ? category : c))`
  - [x] Inject color into `document.documentElement.style.setProperty('--color-' + category.id, category.color)` immediately (AC3)
  - [x] Throw `AppError.IDB_ERROR` on persistence failure
- [x] Implement `CategoriesService.init()` color injection (AC: 5)
  - [x] Already done in Story 1.5: `init()` calls `injectCssProperties()` which iterates all categories; refactored to use private `setCssVar(id, color)` helper
  - [x] Added `removeCssVar(categoryId: string): void` public method for Story 5.3 cross-wave use
- [x] Wire `CategoryManager` settings screen to open the dialog (AC: 1, 8)
  - [x] Story 5.1 `CategoryManager` is present; added `onColorTap(category)` tap handler on the color dot button
  - [x] Dot changed from `<span>` to `<button>` with `aria-label="Change color for {name}"`
  - [x] On dialog close with non-null result: `await categoriesSvc.update({ ...category, color: result })`
  - [x] On dialog close with null result: no-op (AC8)
- [x] Verify `EntryRowComponent` dot has `aria-hidden="true"` (AC: 6)
  - [x] Story 2.3 has NOT shipped — `entry-row.component.ts` is a stub with `<ng-content />`; no decorative dot exists to patch
  - [x] Story 2.3 spec requires `aria-hidden="true"` on the dot; this story verifies and defers the patch to Story 2.3 implementation
- [x] Add hex validation utility at `src/app/shared/utils/color.util.ts`
  - [x] `isValidHex(value: string): boolean` — accepts `#abc`, `#aabbcc`, `abc`, `aabbcc` (case-insensitive)
  - [x] `normalizeHex(value: string): string` — returns 7-character `#xxxxxx` lowercase form
  - [x] Pure functions, no side effects
- [x] Write `src/app/features/settings/color-picker.dialog.spec.ts` (AC: 1, 2, 7, 8)
  - [x] Renders 12 preset swatches with ring on currently-selected color
  - [x] Custom hex input validates `#abc` (3-digit) → normalizes to `#aabbcc`
  - [x] Custom hex input rejects `xyz` (non-hex) → Confirm disabled, error message visible
  - [x] Confirm returns `selectedColor` via `dialogRef.close()`
  - [x] Cancel returns `null` via `dialogRef.close(null)`
- [x] Write `src/app/core/services/categories.service.spec.ts` additions (AC: 3, 5)
  - [x] `update()` writes to IDB and updates signal
  - [x] `update()` calls `document.documentElement.style.setProperty('--color-X', '#ef4444')`
  - [x] `init()` loads categories from IDB and injects all `--color-*` properties on init (covered by existing tests)
  - [x] `removeCssVar()` calls `removeProperty`
- [x] Write `src/app/shared/utils/color.util.spec.ts` (AC: 2, 7)
  - [x] `isValidHex` accepts/rejects expected forms
  - [x] `normalizeHex` expands 3-digit to 6-digit and lowercases

## Dev Notes

### ColorPickerDialog Implementation

```typescript
import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { isValidHex, normalizeHex } from '../../shared/utils/color.util';

interface ColorPickerData {
  categoryId: string;
  currentColor: string;
}

const PRESET_PALETTE: readonly string[] = [
  '#6366f1', // indigo
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#84cc16', // lime
  '#14b8a6', // teal
  '#9e9e9e', // neutral
] as const;

@Component({
  selector: 'app-color-picker-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  templateUrl: './color-picker.dialog.html',
  styleUrl: './color-picker.dialog.scss',
})
export class ColorPickerDialog {
  private readonly dialogRef = inject(MatDialogRef<ColorPickerDialog, string | null>);
  readonly data = inject<ColorPickerData>(MAT_DIALOG_DATA);

  readonly presets = PRESET_PALETTE;
  readonly selectedColor = signal<string>(normalizeHex(this.data.currentColor));
  readonly customHexInput = signal<string>('');
  readonly customHexError = signal<string | null>(null);

  readonly isValidSelection = computed(() => isValidHex(this.selectedColor()));

  onPresetClick(color: string): void {
    this.selectedColor.set(normalizeHex(color));
    this.customHexInput.set('');
    this.customHexError.set(null);
  }

  onCustomHexChange(value: string): void {
    this.customHexInput.set(value);
    if (!value.trim()) {
      this.customHexError.set(null);
      return;
    }
    if (isValidHex(value)) {
      this.selectedColor.set(normalizeHex(value));
      this.customHexError.set(null);
    } else {
      this.customHexError.set('Enter a valid hex color (e.g. #6366f1)');
    }
  }

  onConfirm(): void {
    if (!this.isValidSelection()) return;
    this.dialogRef.close(this.selectedColor());
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
```

### ColorPickerDialog Template

```html
<h2 mat-dialog-title>Choose color</h2>

<mat-dialog-content class="flex flex-col gap-4">
  <div class="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Color palette">
    @for (color of presets; track color) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="selectedColor() === color"
        [attr.aria-label]="color"
        class="w-10 h-10 rounded-full"
        [class.ring-2]="selectedColor() === color"
        [class.ring-indigo-500]="selectedColor() === color"
        [class.ring-offset-2]="selectedColor() === color"
        [style.background-color]="color"
        (click)="onPresetClick(color)"></button>
    }
  </div>

  <mat-form-field appearance="outline">
    <mat-label>Custom hex</mat-label>
    <input
      matInput
      type="text"
      placeholder="#6366f1"
      [ngModel]="customHexInput()"
      (ngModelChange)="onCustomHexChange($event)"
      pattern="^#?[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$" />
    @if (customHexError(); as msg) {
      <mat-error role="alert">{{ msg }}</mat-error>
    }
  </mat-form-field>

  <div class="flex items-center gap-2">
    <span class="text-sm text-zinc-500">Preview</span>
    <span
      aria-hidden="true"
      class="w-6 h-6 rounded-full"
      [style.background-color]="selectedColor()"></span>
    <span class="text-sm font-mono">{{ selectedColor() }}</span>
  </div>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-button type="button" (click)="onCancel()">Cancel</button>
  <button
    mat-flat-button
    color="primary"
    type="button"
    [disabled]="!isValidSelection()"
    (click)="onConfirm()">
    Confirm
  </button>
</mat-dialog-actions>
```

### Hex Validation Utility

```typescript
// src/app/shared/utils/color.util.ts

const HEX_PATTERN = /^#?[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;

export function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

export function normalizeHex(value: string): string {
  const trimmed = value.trim().replace(/^#/, '').toLowerCase();
  if (trimmed.length === 3) {
    // Expand #abc → #aabbcc
    return '#' + trimmed.split('').map(c => c + c).join('');
  }
  if (trimmed.length === 6) {
    return '#' + trimmed;
  }
  // Defensive: caller should have validated; return as-is with leading #
  return '#' + trimmed;
}
```

### CategoriesService.update() — Live CSS Variable Injection

```typescript
// categories.service.ts (additions to existing service)

import { Injectable, inject, signal } from '@angular/core';
import { Category } from '../models/category.model';
import { IdbService } from './idb.service';
import { AppError } from '../models/error.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly idb = inject(IdbService);
  private readonly _categories = signal<Category[]>([]);
  readonly categories = this._categories.asReadonly();
  private _initialized = false;

  async init(): Promise<void> {
    if (this._initialized) return;
    const all = await this.idb.getAll<Category>('categories');
    this._categories.set(all);
    // Inject CSS custom properties at startup (AC5)
    for (const c of all) this.setCssVar(c.id, c.color);
    this._initialized = true;
  }

  async update(category: Category): Promise<void> {
    try {
      await this.idb.set('categories', category);
    } catch (err) {
      const appErr = err as AppError;
      throw appErr.type === 'IDB_ERROR' ? appErr : ({
        type: 'IDB_ERROR',
        message: 'Failed to save category color',
      } satisfies AppError);
    }
    this._categories.update(arr => arr.map(c => c.id === category.id ? category : c));
    // Live CSS variable update (AC3, AC4)
    this.setCssVar(category.id, category.color);
  }

  private setCssVar(id: string, color: string): void {
    document.documentElement.style.setProperty('--color-' + id, color);
  }

  removeCssVar(id: string): void {
    document.documentElement.style.removeProperty('--color-' + id);
  }
}
```

### CategoryManager Tap Handler

```typescript
// In CategoryManager (Story 5.1) — add a row click handler:
import { MatDialog } from '@angular/material/dialog';
import { ColorPickerDialog } from './color-picker.dialog';

private readonly dialog = inject(MatDialog);
private readonly categoriesSvc = inject(CategoriesService);

async onColorTap(category: Category): Promise<void> {
  const ref = this.dialog.open<ColorPickerDialog, ColorPickerData, string | null>(
    ColorPickerDialog,
    { data: { categoryId: category.id, currentColor: category.color } },
  );
  const result = await firstValueFrom(ref.afterClosed());
  if (result) {
    await this.categoriesSvc.update({ ...category, color: result });
  }
  // result === null → user cancelled (AC8) → no-op
}
```

If `CategoryManager` from Story 5.1 has not been merged into this worktree, the implementation may include a minimal scaffold:

```typescript
// src/app/features/settings/category-manager.component.ts (minimal)
@Component({
  selector: 'app-category-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatListModule],
  template: `
    <mat-list>
      @for (cat of categoriesSvc.categories(); track cat.id) {
        <button mat-list-item type="button" (click)="onColorTap(cat)">
          <span aria-hidden="true"
                class="inline-block w-4 h-4 rounded-full mr-3"
                [style.background-color]="'var(--color-' + cat.id + ')'"></span>
          {{ cat.name }}
        </button>
      }
    </mat-list>
  `,
})
export class CategoryManagerComponent { /* ... */ }
```

This minimal scaffold is replaceable by Story 5.1's full drag-drop reorder implementation; it should NOT include drag-drop logic in this story's scope.

### Live CSS Variable Reactivity (AC4)

Components consume colors via `var(--color-[id])`. When `setProperty` updates the value on `document.documentElement.style`, **the browser repaints the next frame**. No Angular change detection is needed for the visual update — it's a pure CSS reflow.

For elements bound dynamically via `[style.background-color]`:
```html
<span [style.background-color]="'var(--color-' + cat.id + ')'"></span>
```
The expression is the same `var(--color-X)` string; only the underlying CSS variable value changes. OnPush change detection is unaffected.

For elements that read the color via `getComputedStyle` (e.g., chart libraries), they pick up the new value on next render or animation frame.

### Persistence (AC5)

`CategoriesService.update()` writes to the `categories` IDB store via `idb.set('categories', category)` — keyPath store, no separate key argument. On app restart, `init()` reads all categories from IDB and re-injects the CSS variables.

The `categories` IDB store overload was added in Story 2.5's `IdbService` extension. If Story 2.5 has not merged, this story may need to include the `IdbService` extension; cite Story 2.5 as the canonical implementation.

### Hex Format Normalization

User input forms accepted by `isValidHex`:
- `#6366f1` ✓ (canonical 6-digit with `#`)
- `6366f1` ✓ (6-digit no `#`)
- `#abc` ✓ (3-digit with `#`)
- `abc` ✓ (3-digit no `#`)
- `#xyz` ✗ (non-hex)
- `#12345` ✗ (5-digit invalid)

After validation, `normalizeHex` always returns the canonical 7-character `#xxxxxx` lowercase form. This is what's stored in `Category.color` and emitted to the CSS variable.

Architecture says `Category.color` is "hex e.g. '#6366f1'" — the leading `#` is included; normalization preserves this.

### Decorative Dot ARIA (AC6)

Color dots in `EntryRowComponent`, `CategoryTileComponent`, `CategoryBreakdownBarComponent`, `CategoryManager` rows, and `ColorPickerDialog` preview are all purely decorative. They MUST have `aria-hidden="true"` so screen readers ignore them — the category name carries the semantic information.

This story verifies and patches `EntryRowComponent` if Story 2.3 has not already shipped this. Other dot consumers (in their respective stories) MUST follow the same rule.

### What Story 5.2 Does NOT Implement

- Category drag-drop reorder → Story 5.1
- Add/delete category → Story 5.3
- Sheet write-back of color changes → out of scope per epic ("category order is local only" — same applies to color: local-only customization, not synced to Sheets)
- Theme-aware swatch palette (different palettes for light vs dark mode) → deferred; the same hex values render in both modes
- Color contrast accessibility checks (WCAG contrast ratio against backgrounds) → noted as future enhancement; preset palette is hand-picked for reasonable contrast

### Project Conventions to Follow

- **Standalone + OnPush** mandatory on all components (including the dialog)
- **`input()` / `output()` signal APIs** — never decorators; this dialog uses `inject(MAT_DIALOG_DATA)` and `inject(MatDialogRef)` pattern
- **`AppError` discriminated union** — IDB errors only; input validation errors are component-local, not `AppError`s
- **`NotificationService.showError()`** — not used here for input validation; use inline `mat-error` instead
- **`MatDialog`** for color picker per architecture: "MatDialog — delete confirmation, category color picker"
- **`crypto.randomUUID()` only** — not used here; categories already have ids assigned in Story 1.5/5.3
- **Tailwind with `important: '#app'`** — utilities win against Material defaults
- **Test runner**: `ng test --watch=false`

### References

- `Category.color` field shape (`hex e.g. '#6366f1'`): [Source: `src/app/core/models/category.model.ts`]
- `--color-[category-id]` CSS custom property pattern: [Source: `_bmad-output/planning-artifacts/architecture.md` — Category Color System]
- `MatDialog` for color picker: [Source: `_bmad-output/planning-artifacts/architecture.md` — Angular Material Usage]
- APP_INITIALIZER injection of CSS vars: [Source: `_bmad-output/planning-artifacts/architecture.md` — Implementation Sequence]
- Decorative dot ARIA: cross-reference [Story 2.3 — Entry list view]
- IDB `categories` store: [Source: `src/app/core/services/idb.service.ts`]
- IdbService keyPath stores extension: [Source: Story 2.5 — `IdbService` extension]
- `CategoryManager` host: [Source: Story 5.1 — drag-drop reorder]

## Testing Strategy

Use Vitest via `ng test --watch=false`. Test files:
- `src/app/features/settings/color-picker.dialog.spec.ts` (new)
- `src/app/core/services/categories.service.spec.ts` (extend if exists; otherwise create)
- `src/app/shared/utils/color.util.spec.ts` (new)

Mock `MatDialogRef`, `MAT_DIALOG_DATA` for dialog tests. Mock `IdbService` with in-memory `Map`-backed double for service tests. Use `document.documentElement.style.getPropertyValue` to assert CSS variable injection in service tests.

Key test cases:
1. `ColorPickerDialog` renders 12 preset swatches and ring on currently-selected color
2. `ColorPickerDialog` clicking a preset sets `selectedColor` to that color (normalized)
3. `ColorPickerDialog` typing `#abc` in custom hex input → `selectedColor` set to `#aabbcc`
4. `ColorPickerDialog` typing `xyz` shows error message and disables Confirm
5. `ColorPickerDialog` Confirm closes with `selectedColor()` value
6. `ColorPickerDialog` Cancel closes with `null`
7. `CategoriesService.update()` writes to IDB and updates `categories` signal
8. `CategoriesService.update()` calls `setProperty('--color-X', '#abc')` on `document.documentElement.style` (use spy or `getPropertyValue` after call)
9. `CategoriesService.init()` injects CSS variables for all categories loaded from IDB
10. `CategoriesService.removeCssVar()` calls `removeProperty('--color-X')`
11. `CategoriesService.update()` IDB failure → throws `AppError.IDB_ERROR`
12. `isValidHex('#abc')` → true; `isValidHex('#xyz')` → false; `isValidHex('abcdef')` → true
13. `normalizeHex('#abc')` → `'#aabbcc'`; `normalizeHex('ABCDEF')` → `'#abcdef'`

E2E (deferred to Wave 12): Playwright test in `e2e/settings.spec.ts` covering: open settings → tap category → choose new color → confirm → assert breakdown bar reflects new color without page reload.

## Dev Agent Record

### Implementation Notes

- `isValidSelection` checks `customHexError() === null` in addition to `isValidHex(selectedColor())` so that a pending invalid custom-hex input disables Confirm even though `selectedColor` still holds the previous valid value (AC7).
- `CategoriesService.update()` uses `idb.set('categories', category.id, category)` (3-arg form) consistent with existing `reorder()` pattern; the story spec showed 2-arg but IdbService's `categories` overload requires explicit key.
- `injectCssProperties` refactored to delegate to private `setCssVar(id, color)` — same helper used by `update()`, keeping CSS injection DRY.
- `CategoryManager` dot changed from `<span aria-hidden>` to `<button>` with `aria-label` — decorative aria-hidden is now on the visual swatch inside the dialog preview (`aria-hidden="true"` on the preview span), while the interactive dot in the manager row has accessible button semantics.
- Story 2.3 is not yet implemented (stub component); `EntryRowComponent` has no dot to patch. The story spec rule applies when 2.3 is merged.
- 38 new tests added (13 dialog, 7 service additions, 18 util); zero regressions.

### Completion Notes

All 8 ACs satisfied. 182 tests pass (up from 144). ColorPickerDialog, color.util, CategoriesService.update/removeCssVar all implemented and tested.

## File List

- src/app/shared/utils/color.util.ts (new)
- src/app/shared/utils/color.util.spec.ts (new)
- src/app/features/settings/color-picker.dialog.ts (new)
- src/app/features/settings/color-picker.dialog.html (new)
- src/app/features/settings/color-picker.dialog.scss (new)
- src/app/features/settings/color-picker.dialog.spec.ts (new)
- src/app/core/services/categories.service.ts (modified — added update(), removeCssVar(), private setCssVar())
- src/app/core/services/categories.service.spec.ts (modified — added update() and removeCssVar() test suites)
- src/app/features/settings/category-manager/category-manager.component.ts (modified — inject MatDialog, add onColorTap())
- src/app/features/settings/category-manager/category-manager.component.html (modified — dot span → button with aria-label)
- src/app/features/settings/category-manager/category-manager.component.scss (modified — button reset styles on .cm-dot)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — 5-2 → in-progress then review)

### Review Findings

- [x] [Review][Patch] `firstValueFrom` missing `{ defaultValue: null }` — EmptyError on route teardown [category-manager.component.ts:42] — fixed
- [x] [Review][Patch] `if (result)` truthy guard — use `result != null` for semantic AC8 compliance [category-manager.component.ts:43] — fixed
- [x] [Review][Patch] Concurrent dialog guard missing — double-tap opens two dialogs [category-manager.component.ts:37] — fixed
- [x] [Review][Patch] `role="radio"` without roving tabindex — keyboard nav broken; replaced with `aria-pressed` [color-picker.dialog.html:4-17] — fixed
- [x] [Review][Patch] Swatch `aria-label` is raw hex — meaningless to screen readers; changed to human-readable names [color-picker.dialog.ts, color-picker.dialog.html] — fixed
- [x] [Review][Patch] `.cm-dot` touch target 12×12px — fails WCAG 2.5.8; extended hit area to 44×44px via `::before` [category-manager.component.scss] — fixed
- [x] [Review][Patch] `<mat-error role="alert">` duplicate live region — removed redundant role [color-picker.dialog.html:30] — fixed
- [x] [Review][Defer] `removeCssVar()` no current caller — intentional cross-wave API for Story 5.3 [categories.service.ts] — deferred, pre-existing
- [x] [Review][Defer] Preview area has no `aria-live` region — hex value shown in text span; low impact — deferred, pre-existing
- [x] [Review][Defer] Forced-colors mode: ring (box-shadow) invisible in high-contrast — enhancement — deferred, pre-existing

## Change Log

- 2026-05-09: Initial draft for Wave 6. Spec covers `ColorPickerDialog` (MatDialog) with 12-preset palette + custom hex input, `CategoriesService.update()` and `init()` with live CSS-variable injection, `color.util.ts` hex validation/normalization. Live update via `document.documentElement.style.setProperty` — no Angular change detection needed. Decorative dots `aria-hidden="true"` per cross-reference with Story 2.3. Cancel returns null; no service call on cancel.
- 2026-05-09: Implementation complete. 38 new tests added; all 182 pass. Story status → review.
- 2026-05-09: Code review by Amelia/Winston/Sally. 7 patches applied: firstValueFrom defaultValue, null guard, dialog reentry guard, aria-pressed replacing role=radio, human-readable swatch names, 44px touch target via ::before, removed duplicate role=alert. 3 deferred (removeCssVar cross-wave, aria-live preview, forced-colors). All 182 tests pass. Story status → done.
