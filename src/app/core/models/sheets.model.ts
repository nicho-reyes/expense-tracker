import { z } from 'zod';

export const SCHEMA_2026_HEADERS = ['Date', 'Category', 'Amount', 'Remarks', 'Month', 'UUID'];
export const SCHEMA_2025_HEADERS = ['Date', 'Category', 'Amount', 'Remarks'];

export const schema2026Validator = z.tuple([
  z.literal('Date'), z.literal('Category'), z.literal('Amount'),
  z.literal('Remarks'), z.literal('Month'), z.literal('UUID'),
]);

export const schema2025Validator = z.tuple([
  z.literal('Date'), z.literal('Category'), z.literal('Amount'), z.literal('Remarks'),
]);

export type Schema2026Headers = z.infer<typeof schema2026Validator>;
export type Schema2025Headers = z.infer<typeof schema2025Validator>;

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
