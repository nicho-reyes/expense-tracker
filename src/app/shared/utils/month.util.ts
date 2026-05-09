export function listLast12Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    result.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

export function formatShortMonth(monthIso: string): string {
  const [year, month] = monthIso.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
}

export function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(monthIso: string, delta: number): string {
  const [yearStr, monthStr] = monthIso.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthIso: string): string {
  const [year, month] = monthIso.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}
