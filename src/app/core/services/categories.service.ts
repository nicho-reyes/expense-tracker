import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdbService } from './idb.service';
import { SheetsService } from './sheets.service';
import { AppError } from '../models/error.model';
import {
  Category,
  CategorySource,
  DEFAULT_CATEGORY_PALETTE,
  slugifyCategoryId,
} from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly idb = inject(IdbService);
  private readonly sheets = inject(SheetsService);

  private readonly _categories = signal<Category[]>([]);
  private readonly _loadError = signal<AppError | null>(null);

  readonly categories = this._categories.asReadonly();
  readonly loadError = this._loadError.asReadonly();

  private _seeding = false;

  async init(): Promise<void> {
    try {
      const cached = await this.idb.getAll<Category>('categories');
      if (cached.length) {
        this._categories.set(cached);
        this.injectCssProperties(cached);
      }
      await this.seedFromSheet(cached);
    } catch (err) {
      // AC6/AC7: only surface error when no cached categories are available to display
      if (this._categories().length === 0) {
        this._loadError.set(this.toAppError(err));
      }
    }
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
      const activeTab = this.sheets.getActive2026TabName();
      if (!activeTab) return;
      const raw = await firstValueFrom(this.sheets.readActiveTabCategoryColumn(spreadsheetId, activeTab));
      names = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
      source = { type: 'column-b-fallback', tabName: activeTab };
    }

    const next = this.assignDefaultColors(names, existingMap);

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
          position: acc.length,
        } satisfies Category);
        return acc;
      }, []);
  }

  private injectCssProperties(categories: Category[]): void {
    const root = document.documentElement.style;
    for (const cat of categories) {
      root.setProperty(`--color-${cat.id}`, cat.color);
    }
  }

  private toAppError(err: unknown): AppError {
    if (err && typeof err === 'object' && 'type' in err) return err as AppError;
    return { type: 'UNKNOWN_ERROR', message: err instanceof Error ? err.message : String(err) };
  }
}
