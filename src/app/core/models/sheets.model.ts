import { z } from 'zod';
import { AppError } from './error.model';

export const YEAR_IN_TAB_PATTERN = /\b(20\d{2})\b/;

export function extractYearFromTabName(tabName: string): number | null {
  const m = YEAR_IN_TAB_PATTERN.exec(tabName);
  return m ? Number(m[1]) : null;
}

export interface HydratedTabRecord {
  lastHydratedAt: number;
  rowCount: number;
}

export type HydrationProgress =
  | { type: 'idle' }
  | { type: 'running'; tabName: string; tabIndex: number; tabTotal: number }
  | { type: 'complete'; hydratedTabs: number; skippedTabs: number; deferredTabs: number };

export type HydrationTabResult =
  | { type: 'hydrated'; tabName: string; rowCount: number }
  | { type: 'skipped'; tabName: string; reason: 'non-year-schema' | 'already-hydrated' }
  | { type: 'invalid'; tabName: string; error: AppError }
  | { type: 'deferred'; tabName: string; error: AppError };

export const SCHEMA_2026_HEADERS = ['Date', 'Category', 'Amount', 'Remarks', 'Month', 'UUID'];
export const SCHEMA_2025_HEADERS = ['Date', 'Category', 'Amount', 'Remarks'];
export const SCHEMA_NATURAL_HEADERS = ['Month', 'Date', 'Category', 'Price', 'Remarks'];

export const schema2026Validator = z.tuple([
  z.literal('Date'), z.literal('Category'), z.literal('Amount'),
  z.literal('Remarks'), z.literal('Month'), z.literal('UUID'),
]);

export const schema2025Validator = z.tuple([
  z.literal('Date'), z.literal('Category'), z.literal('Amount'), z.literal('Remarks'),
]);

export const schema2026PartialValidator = z.tuple([
  z.literal('Date'), z.literal('Category'), z.literal('Amount'),
  z.literal('Remarks'), z.literal('Month'),
]);

export const schemaNaturalValidator = z.tuple([
  z.literal('Month'), z.literal('Date'), z.literal('Category'),
  z.literal('Price'), z.literal('Remarks'),
]);

export type Schema2026Headers = z.infer<typeof schema2026Validator>;
export type Schema2025Headers = z.infer<typeof schema2025Validator>;

export type TabSchemaResult =
  | { type: '2026'; tabName: string }
  | { type: '2025'; tabName: string }
  | { type: 'natural'; tabName: string }
  | { type: 'mismatch'; tabName: string; error: AppError }
  | { type: 'invalid'; tabName: string; error: AppError }
  | { type: 'error'; tabName: string; error: AppError };

export interface SheetsValueRange {
  range: string;
  majorDimension: string;
  values: string[][];
}

export interface SheetsSpreadsheet {
  spreadsheetId: string;
  properties: { title: string };
  sheets: SheetsSheetMeta[];
}

export interface SheetsSheetMeta {
  properties: {
    sheetId: number;
    title: string;
    index: number;
    sheetType: string;
    gridProperties: { rowCount: number; columnCount: number };
  };
}

export interface SheetsAppendResponse {
  updates: {
    updatedRange: string;
    updatedRows: number;
  };
}
