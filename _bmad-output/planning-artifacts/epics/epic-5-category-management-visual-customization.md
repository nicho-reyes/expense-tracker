# Epic 5: Category Management & Visual Customization

Nick can customize category colors (overriding the defaults seeded in E1), reorder categories in the quick-add list, add new categories, and see those colors reflected consistently throughout the dashboard bars, entry list dots, and drill-down — with light/dark theme toggle available in Settings.

## Story 5.1: CategoryManager settings screen with drag-drop reorder

As Nick,
I want a settings screen where I can reorder my categories by drag-and-drop,
So that the most-used categories appear at the top of the quick-add interface.

**Acceptance Criteria:**

**Given** I navigate to Settings
**When** the `CategoryManager` screen renders
**Then** all categories are listed with CDK drag-drop reorder handles

**Given** I drag a category to a new position and release
**When** the drop completes
**Then** the new order is saved to the `categories` IDB store

**Given** the category order is updated
**When** `QuickAddSheetComponent` opens
**Then** `CategoryTileComponent` tiles appear in the updated order

**Given** the `CategoryManager` renders before any Sheet sync has occurred
**When** no categories are present
**Then** an empty state prompts me to sync with the Sheet

**Given** a reorder completes
**When** `CategoriesService` persists the change
**Then** no Sheet write-back is triggered — category order is local only

---

## Story 5.2: ColorPicker and per-category color assignment

As Nick,
I want to assign a custom color to each category and see it reflected everywhere in the app immediately,
So that my expense breakdown bars, entry dots, and tiles all use colors I recognize at a glance.

**Acceptance Criteria:**

**Given** I tap a category in `CategoryManager`
**When** the `ColorPicker` opens
**Then** a swatch grid of color options is shown with a ring indicator on the currently selected color

**Given** the `ColorPicker` has a custom hex input
**When** I enter a valid hex value
**Then** the swatch preview updates and the color becomes selectable

**Given** I select a color and confirm
**When** `CategoriesService.update()` runs
**Then** the `--color-[category-id]` CSS custom property is updated on `document.documentElement.style` immediately — no page reload required

**Given** the CSS custom property is updated
**When** any component consuming that property re-renders
**Then** the new color is reflected in category dots, breakdown bars, and tiles without a full navigation cycle

**Given** the color change is saved to IDB
**When** the app is restarted
**Then** the custom color persists and is re-injected by `CategoriesService.init()`

**Given** a category color dot renders in `EntryRowComponent`
**When** its ARIA attributes are inspected
**Then** `aria-hidden="true"` is set on the decorative dot

---

## Story 5.3: Create and delete categories with Sheet write-back

As Nick,
I want to add new expense categories in the app and have them automatically written to my Sheet,
So that new categories are available for entry logging immediately and synchronized for future sessions.

**Acceptance Criteria:**

**Given** I tap "Add category" in `CategoryManager`
**When** I enter a name and confirm
**Then** `CategoriesService` creates a new category in the `categories` IDB store with a default palette color assigned

**Given** a new category is created
**When** `CategoriesService` processes the write-back
**Then** the category is appended to the categories range in the connected Google Sheet

**Given** I tap the delete action on a category in `CategoryManager`
**When** a `MatDialog` confirmation appears
**Then** the destructive action uses a ghost/text style button — never a primary button

**Given** I confirm deletion
**When** the category is removed
**Then** it is deleted from the `categories` IDB store and its `--color-[category-id]` CSS custom property is removed from `document.documentElement.style`

**Given** the new category is created
**When** `QuickAddSheetComponent` opens
**Then** the new category tile is immediately available for selection

**Given** the category registry is global (FR55)
**When** a new category is created
**Then** it is available for all years — not scoped to any single tab

**Given** I attempt to delete a category that is referenced by one or more entries in the `entries` IDB store
**When** the deletion is requested
**Then** deletion is rejected; a `MatDialog` message shows "Cannot delete — [X] entries use this category" (where X is the exact count); the category remains in the registry unchanged

**Given** I attempt to delete a category that is not referenced by any entry in the `entries` IDB store
**When** the deletion is confirmed
**Then** the category is removed from the `categories` IDB store, its `--color-[category-id]` CSS custom property is removed from `document.documentElement.style`, and no Sheet write-back is required for the deletion

---
