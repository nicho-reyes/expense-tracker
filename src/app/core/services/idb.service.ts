import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase, StoreNames, StoreValue, IndexNames, IndexKey } from 'idb';
import { LocalEntry, SyncQueueItem } from '../models/entry.model';
import { Category } from '../models/category.model';
import { AppError } from '../models/error.model';

interface ExpenseDashboardDb extends DBSchema {
  entries: {
    key: string;
    value: LocalEntry;
    indexes: { 'by-month': string; 'by-year': number; 'by-sync-status': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-status': string; 'by-enqueued': number };
  };
  categories: {
    key: string;
    value: Category;
  };
  appMeta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'expense-dashboard';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class IdbService {
  private dbPromise: Promise<IDBPDatabase<ExpenseDashboardDb>>;

  constructor() {
    this.dbPromise = openDB<ExpenseDashboardDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const entriesStore = db.createObjectStore('entries', { keyPath: 'id' });
        entriesStore.createIndex('by-month', 'month');
        entriesStore.createIndex('by-year', 'year');
        entriesStore.createIndex('by-sync-status', 'syncStatus');

        const syncQueueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncQueueStore.createIndex('by-status', 'status');
        syncQueueStore.createIndex('by-enqueued', 'enqueuedAt');

        db.createObjectStore('categories', { keyPath: 'id' });
        db.createObjectStore('appMeta');
      },
      blocked() {
        console.warn('[IdbService] DB upgrade blocked — close other tabs and reload.');
      },
      blocking() {
        console.warn('[IdbService] This tab is blocking a DB upgrade — reloading.');
        location.reload();
      },
    }).catch((err: unknown) => {
      throw this.toIdbError(err);
    });
  }

  async get<T>(store: 'appMeta', key: string): Promise<T | undefined>;
  async get<T>(store: 'categories', key: string): Promise<T | undefined>;
  async get<S extends 'entries' | 'syncQueue'>(
    store: S,
    key: string,
  ): Promise<StoreValue<ExpenseDashboardDb, S> | undefined>;
  async get<T>(
    store: StoreNames<ExpenseDashboardDb>,
    key: string,
  ): Promise<T | undefined> {
    try {
      const db = await this.dbPromise;
      return await db.get(store, key) as T | undefined;
    } catch (err) {
      throw this.toIdbError(err);
    }
  }

  async set<T>(store: 'appMeta', key: string, value: T): Promise<void>;
  async set<T>(store: 'categories', key: string, value: T): Promise<void>;
  async set<T>(store: 'appMeta' | 'categories', key: string, value: T): Promise<void> {
    try {
      const db = await this.dbPromise;
      if (store === 'categories') {
        await db.put(store, value as Category);
      } else {
        await db.put(store, value as unknown, key);
      }
    } catch (err) {
      throw this.toIdbError(err);
    }
  }

  async getAll(store: 'categories'): Promise<Category[]>;
  async getAll<S extends 'entries' | 'syncQueue'>(
    store: S,
  ): Promise<StoreValue<ExpenseDashboardDb, S>[]>;
  async getAll<T>(
    store: StoreNames<ExpenseDashboardDb>,
  ): Promise<T[]> {
    try {
      const db = await this.dbPromise;
      return await db.getAll(store) as T[];
    } catch (err) {
      throw this.toIdbError(err);
    }
  }

  async put<S extends 'entries' | 'syncQueue' | 'categories'>(
    store: S,
    value: StoreValue<ExpenseDashboardDb, S>,
  ): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.put(store, value);
    } catch (err) {
      throw this.toIdbError(err);
    }
  }

  async delete(
    store: 'entries' | 'syncQueue' | 'categories',
    id: string,
  ): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.delete(store, id);
    } catch (err) {
      throw this.toIdbError(err);
    }
  }

  async getAllByIndex<S extends 'entries' | 'syncQueue', I extends IndexNames<ExpenseDashboardDb, S>>(
    store: S,
    indexName: I,
    key: IndexKey<ExpenseDashboardDb, S, I> | IDBKeyRange,
  ): Promise<StoreValue<ExpenseDashboardDb, S>[]> {
    try {
      const db = await this.dbPromise;
      return await db.getAllFromIndex(store, indexName, key);
    } catch (err) {
      throw this.toIdbError(err);
    }
  }

  async clear(store: 'categories'): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.clear(store);
    } catch (err) {
      throw this.toIdbError(err);
    }
  }

  getDb(): Promise<IDBPDatabase<ExpenseDashboardDb>> {
    return this.dbPromise;
  }

  private toIdbError(err: unknown): AppError {
    if (
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      typeof (err as Record<string, unknown>)['type'] === 'string' &&
      'message' in err
    ) {
      return err as AppError;
    }
    return { type: 'IDB_ERROR', message: err instanceof Error ? err.message : String(err) };
  }
}
