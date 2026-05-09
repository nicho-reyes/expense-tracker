import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
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
        // Another tab has an older DB version open and is blocking this upgrade.
        console.warn('[IdbService] DB upgrade blocked — close other tabs and reload.');
      },
      blocking() {
        // This tab is blocking a newer version from opening in another tab.
        console.warn('[IdbService] This tab is blocking a DB upgrade — reloading.');
        location.reload();
      },
    }).catch((err: unknown) => {
      throw { type: 'IDB_ERROR', message: err instanceof Error ? err.message : String(err) } satisfies AppError;
    });
  }

  async get<T>(store: 'appMeta', key: string): Promise<T | undefined>;
  async get<T>(store: 'categories', key: string): Promise<T | undefined>;
  async get<T>(store: 'appMeta' | 'categories', key: string): Promise<T | undefined> {
    const db = await this.dbPromise;
    return db.get(store, key) as Promise<T | undefined>;
  }

  async set<T>(store: 'appMeta', key: string, value: T): Promise<void>;
  async set<T>(store: 'categories', key: string, value: T): Promise<void>;
  async set<T>(store: 'appMeta' | 'categories', key: string, value: T): Promise<void> {
    const db = await this.dbPromise;
    if (store === 'categories') {
      await db.put(store, value as Category);
    } else {
      await db.put(store, value as unknown, key);
    }
  }

  async getAll<T>(store: 'categories'): Promise<T[]> {
    const db = await this.dbPromise;
    return db.getAll(store) as Promise<T[]>;
  }

  async clear(store: 'categories'): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(store);
  }

  getDb(): Promise<IDBPDatabase<ExpenseDashboardDb>> {
    return this.dbPromise;
  }
}
