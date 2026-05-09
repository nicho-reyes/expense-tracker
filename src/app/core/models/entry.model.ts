export interface LocalEntry {
  id: string;
  date: string;           // YYYY-MM-DD
  month: string;          // YYYY-MM (derived, indexed)
  year: number;           // indexed
  category: string;
  amount: number;         // negative = credit/reimbursement
  remarks: string;
  tabName: string;
  schemaVersion: '2025' | '2026';
  sheetRowIndex: number | null;
  syncStatus: 'synced' | 'pending' | 'error';
  isReadOnly: boolean;
}

export type NewEntryInput = {
  date: string;
  category: string;
  amount: number;
  remarks: string;
  tabName?: string;
  schemaVersion?: '2025' | '2026';
};

export enum QueueState {
  PENDING = 'PENDING',
  SYNC_ERROR = 'SYNC_ERROR',
}

export interface SyncQueueItem {
  id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  entryData: LocalEntry | null;       // null for DELETE
  targetEntryId: string | null;       // null for INSERT
  targetTabName: string | null;       // null for INSERT; set to originating tab for past-year UPDATE/DELETE retries
  enqueuedAt: number;                 // Date.now()
  status: QueueState;
  retryCount: number;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;         // written by markError(); retry scheduler reads on init to resume correct timing
  errorMessage: string | null;
}
