export interface Category {
  id: string;       // unique, used as CSS custom property suffix: --color-[id]
  name: string;
  color: string;    // hex e.g. '#6366f1'
  position: number; // for ordering in quick-add picker
}
