import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { SyncQueueService } from './sync-queue.service';
import { EntriesService } from './entries.service';
import { NotificationService } from './notification.service';
import { AppError } from '../models/error.model';
import {
  Category,
  CategorySource,
  DEFAULT_CATEGORY_PALETTE,
  pickNextPaletteColor,
  slugifyCategoryId,
} from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly idb = inject(IdbService);
  private readonly sheets = inject(SheetsService);
  private readonly syncQueue = inject(SyncQueueService);
  private readonly entriesService = inject(EntriesService);
  private readonly notification = inject(NotificationService);

  private readonly _categories = signal<Category[]>([]);
  private readonly _loadError = signal<AppError | null>(null);
  private readonly _recentlyUsed = signal<Record<string, number>>({});

  readonly categories = this._categories.asReadonly();
  readonly loadError = this._loadError.asReadonly();

  readonly categoryOrder = computed<Category[]>(() => {
    const recent = this._recentlyUsed();
    return [...this._categories()].sort((a, b) => {
      const ra = recent[a.id] ?? 0;
      const rb = recent[b.id] ?? 0;
      if (ra !== rb) return rb - ra;
      return a.position - b.position;
    });
  });

  private _seeding = false;

  async init(): Promise<void> {
    try {
      const raw = await this.idb.getAll('categories');
      const cached = [...raw].sort((a, b) => a.position - b.position);
      if (cached.length) {
        this._categories.set(cached);
        this.injectCssProperties(cached);
      }
      const recentlyUsed = await this.idb.get<Record<string, number>>('appMeta', 'categoryRecentlyUsed');
      this._recentlyUsed.set(recentlyUsed ?? {});
      await this.seedFromSheet(cached);
    } catch (err) {
      // AC6/AC7: only surface error when no cached categories are available to display
      if (this._categories().length === 0) {
        this._loadError.set(this.toAppError(err));
      }
    }
  }

  markUsed(categoryId: string): void {
    this._recentlyUsed.update(map => ({ ...map, [categoryId]: Date.now() }));
    this.idb.set('appMeta', 'categoryRecentlyUsed', this._recentlyUsed())
      .catch(err => console.warn('[CategoriesService] Failed to persist recently-used:', err));
  }

  async reorder(reorderedIds: string[]): Promise<void> {
    const prev = this._categories();
    const byId = new Map(prev.map(c => [c.id, c]));

    if (reorderedIds.length !== prev.length) {
      const err: AppError = { type: 'IDB_ERROR', message: 'Reorder list length mismatch' };
      this.notification.showError(err);
      throw err;
    }

    if (new Set(reorderedIds).size !== reorderedIds.length) {
      const err: AppError = { type: 'IDB_ERROR', message: 'Reorder list contains duplicate ids' };
      this.notification.showError(err);
      throw err;
    }

    const unknownId = reorderedIds.find(id => !byId.has(id));
    if (unknownId) {
      const err: AppError = { type: 'IDB_ERROR', message: `Unknown category id: ${unknownId}` };
      this.notification.showError(err);
      throw err;
    }

    const next: Category[] = reorderedIds.map((id, idx) => ({ ...byId.get(id)!, position: idx }));

    this._categories.set(next);
    try {
      for (const cat of next) {
        await this.idb.set('categories', cat.id, cat);
      }
    } catch (err) {
      this._categories.set(prev);
      const appErr = this.toIdbError(err);
      this.notification.showError(appErr);
      throw appErr;
    }
  }

  async refreshFromSheet(): Promise<void> {
    this.notification.showInfo('Category sync from Sheet will arrive in a later story.');
  }

  async retry(): Promise<void> {
    if (this._seeding) return;
    this._seeding = true;
    this._loadError.set(null);
    try {
      await this.seedFromSheet(this._categories());
    } catch (err) {
      this._loadError.set(this.toAppError(err));
    } finally {
      this._seeding = false;
    }
  }

  private async seedFromSheet(existing: Category[]): Promise<void> {
    await this.sheets.ensureLoaded();
    const spreadsheetId = this.sheets.connectedSpreadsheetId();
    if (!spreadsheetId) return;

    const existingMap = new Map(existing.map((c) => [c.id, c] as const));

    const categoriesTab = await this.sheets.findCategoriesTab(spreadsheetId);
    let names: string[];
    let source: CategorySource;
    if (categoriesTab) {
      names = await firstValueFrom(this.sheets.readCategoriesTabColumn(spreadsheetId));
      source = { type: 'categories-tab', tabName: 'Categories' };
    } else {
      let activeTab = this.sheets.getActive2026TabName();
      let column: 'B' | 'C' = 'B';
      if (!activeTab) {
        // Sheets with only natural-schema tabs have categories in column C
        activeTab = this.sheets.getActiveNaturalTabName();
        column = 'C';
      }
      if (!activeTab) return;
      const raw = await firstValueFrom(this.sheets.readActiveTabCategoryColumn(spreadsheetId, activeTab, column));
      names = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
      source = { type: 'column-b-fallback', tabName: activeTab };
    }

    const next = [...this.assignDefaultColors(names, existingMap)].sort((a, b) => a.position - b.position);

    await this.idb.clear('categories');
    for (const cat of next) {
      await this.idb.set('categories', cat.id, cat);
    }
    await this.idb.set('appMeta', 'categorySource', source);

    this._categories.set(next);
    this.injectCssProperties(next);
    this._loadError.set(null);
  }

  assignDefaultColors(names: string[], existing: Map<string, Category>): Category[] {
    const seen = new Set<string>();
    return names
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .reduce<Category[]>((acc, name) => {
        const id = slugifyCategoryId(name);
        if (!id || seen.has(id)) return acc;
        seen.add(id);
        const prior = existing.get(id);
        acc.push({
          id,
          name,
          color: prior?.color ?? DEFAULT_CATEGORY_PALETTE[acc.length % DEFAULT_CATEGORY_PALETTE.length],
          position: prior?.position ?? acc.length,
        } satisfies Category);
        return acc;
      }, []);
  }

  async update(category: Category): Promise<void> {
    try {
      await this.idb.set('categories', category.id, category);
    } catch (err) {
      throw this.toIdbError(err);
    }
    this._categories.update(arr => arr.map(c => c.id === category.id ? category : c));
    this.setCssVar(category.id, category.color);
  }

  async create({ name }: { name: string }): Promise<Category> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      const err: AppError = { type: 'IDB_ERROR', message: 'Name is required' };
      throw err;
    }
    const existing = this._categories();
    const duplicate = existing.find(c => c.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      const err: AppError = { type: 'CATEGORY_NAME_DUPLICATE', name: trimmedName };
      throw err;
    }
    const maxPosition = existing.length > 0 ? Math.max(...existing.map(c => c.position)) : -1;
    const category: Category = {
      id: crypto.randomUUID(),
      name: trimmedName,
      color: pickNextPaletteColor(existing),
      position: maxPosition + 1,
    };
    try {
      await this.idb.put('categories', category);
    } catch (err) {
      throw this.toIdbError(err);
    }
    this._categories.update(all => [...all, category]);
    this.setCssVar(category.id, category.color);
    try {
      await firstValueFrom(this.sheets.appendCategoryRow(category));
    } catch (err) {
      const appErr = this.toAppError(err);
      try {
        await this.syncQueue.enqueue({
          operation: 'CATEGORY_INSERT',
          entryData: null,
          categoryData: category,
          targetEntryId: null,
          targetTabName: null,
        });
      } catch {
        // Enqueue failure is non-fatal — category already committed locally
      }
      this.notification.showError(appErr);
    }
    return category;
  }

  async delete(id: string): Promise<void> {
    const cat = this._categories().find(c => c.id === id);
    if (!cat) return;
    const entries = this.entriesService.entries();
    const refs = entries.filter(e => e.category === cat.name);
    if (refs.length > 0) {
      const err: AppError = {
        type: 'CATEGORY_IN_USE',
        categoryId: id,
        categoryName: cat.name,
        entryCount: refs.length,
      };
      throw err;
    }
    try {
      await this.idb.delete('categories', id);
    } catch (err) {
      throw this.toIdbError(err);
    }
    this._categories.update(all => all.filter(c => c.id !== id));
    this.removeCssVar(id);
  }

  removeCssVar(id: string): void {
    document.documentElement.style.removeProperty(`--color-${id}`);
  }

  private injectCssProperties(categories: Category[]): void {
    for (const cat of categories) {
      this.setCssVar(cat.id, cat.color);
    }
  }

  private setCssVar(id: string, color: string): void {
    document.documentElement.style.setProperty(`--color-${id}`, color);
  }

  private toIdbError(err: unknown): AppError {
    if (err && typeof err === 'object' && 'type' in err) return err as AppError;
    return { type: 'IDB_ERROR', message: err instanceof Error ? err.message : String(err) };
  }

  private toAppError(err: unknown): AppError {
    if (err && typeof err === 'object' && 'type' in err) return err as AppError;
    return { type: 'UNKNOWN_ERROR', message: err instanceof Error ? err.message : String(err) };
  }
}
