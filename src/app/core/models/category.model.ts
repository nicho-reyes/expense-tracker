export interface Category {
  id: string;       // slugified name; used as CSS custom property suffix: --color-[id]
  name: string;
  color: string;    // hex e.g. '#6366f1'
  position: number; // for ordering in the quick-add picker
}

export type CategorySource =
  | { type: 'categories-tab'; tabName: 'Categories' }
  | { type: 'column-b-fallback'; tabName: string };

// 12 colors chosen for distinguishability across light/dark themes; decorative
// only per UX spec — never the sole carrier of meaning. Order is stable so the
// position-indexed assignment in CategoriesService is deterministic.
export const DEFAULT_CATEGORY_PALETTE: readonly string[] = [
  '#6366f1', // indigo-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
  '#0ea5e9', // sky-500
] as const;

export function pickNextPaletteColor(existing: Category[]): string {
  const used = new Set(existing.map(c => c.color.toLowerCase()));
  for (const c of DEFAULT_CATEGORY_PALETTE) {
    if (!used.has(c.toLowerCase())) return c;
  }
  return DEFAULT_CATEGORY_PALETTE[existing.length % DEFAULT_CATEGORY_PALETTE.length];
}

export function slugifyCategoryId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
