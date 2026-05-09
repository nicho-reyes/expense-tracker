import { addMonths, currentMonthIso, formatMonthLabel } from './month.util';

describe('month.util', () => {
  describe('addMonths', () => {
    it('decrements within same year', () => {
      expect(addMonths('2026-05', -1)).toBe('2026-04');
    });

    it('handles year rollover backward', () => {
      expect(addMonths('2026-01', -1)).toBe('2025-12');
    });

    it('handles year rollover forward', () => {
      expect(addMonths('2025-12', 1)).toBe('2026-01');
    });

    it('increments within same year', () => {
      expect(addMonths('2026-03', 2)).toBe('2026-05');
    });
  });

  describe('currentMonthIso', () => {
    it('returns YYYY-MM format matching current month', () => {
      const result = currentMonthIso();
      expect(result).toMatch(/^\d{4}-\d{2}$/);
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(result).toBe(expected);
    });
  });

  describe('formatMonthLabel', () => {
    it('formats YYYY-MM as long month name', () => {
      expect(formatMonthLabel('2026-05')).toBe('May 2026');
    });

    it('handles January correctly', () => {
      expect(formatMonthLabel('2025-01')).toBe('January 2025');
    });

    it('handles December correctly', () => {
      expect(formatMonthLabel('2025-12')).toBe('December 2025');
    });
  });
});
