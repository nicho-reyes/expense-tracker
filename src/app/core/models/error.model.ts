import { ZodError } from 'zod';

export type AppError =
  | { type: 'SCHEMA_VALIDATION'; message: string; details: ZodError }
  | { type: 'SHEETS_API'; status: number; message: string }
  | { type: 'AUTH_EXPIRED' }
  | { type: 'AUTH_REVOKED' }
  | { type: 'AUTH_DENIED' }
  | { type: 'NETWORK'; message: string }
  | { type: 'SYNC_FAILED'; entryId: string; message: string }
  | { type: 'IDB_ERROR'; message: string }
  | { type: 'SCHEMA_MISMATCH'; tabName: string; expected: string[]; received: string[] }
  | { type: 'UNKNOWN_ERROR'; message: string }
  | { type: 'CATEGORY_IN_USE'; categoryId: string; categoryName: string; entryCount: number }
  | { type: 'CATEGORY_NAME_DUPLICATE'; name: string };
