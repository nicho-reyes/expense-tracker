import { isValidHex, normalizeHex } from './color.util';

describe('isValidHex', () => {
  it('accepts 6-digit hex with #', () => {
    expect(isValidHex('#6366f1')).toBe(true);
  });

  it('accepts 6-digit hex without #', () => {
    expect(isValidHex('6366f1')).toBe(true);
  });

  it('accepts 3-digit hex with #', () => {
    expect(isValidHex('#abc')).toBe(true);
  });

  it('accepts 3-digit hex without #', () => {
    expect(isValidHex('abc')).toBe(true);
  });

  it('accepts uppercase letters', () => {
    expect(isValidHex('#ABCDEF')).toBe(true);
  });

  it('accepts mixed case', () => {
    expect(isValidHex('#AbCdEf')).toBe(true);
  });

  it('rejects non-hex characters', () => {
    expect(isValidHex('#xyz')).toBe(false);
  });

  it('rejects 5-digit hex', () => {
    expect(isValidHex('#12345')).toBe(false);
  });

  it('rejects 4-digit hex', () => {
    expect(isValidHex('#1234')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidHex('')).toBe(false);
  });

  it('rejects only # character', () => {
    expect(isValidHex('#')).toBe(false);
  });

  it('handles leading/trailing whitespace', () => {
    expect(isValidHex('  #abc  ')).toBe(true);
  });
});

describe('normalizeHex', () => {
  it('returns canonical #xxxxxx for 3-digit shorthand', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
  });

  it('expands 3-digit without # prefix', () => {
    expect(normalizeHex('abc')).toBe('#aabbcc');
  });

  it('lowercases 6-digit uppercase input', () => {
    expect(normalizeHex('ABCDEF')).toBe('#abcdef');
  });

  it('returns canonical form for already-normalized input', () => {
    expect(normalizeHex('#6366f1')).toBe('#6366f1');
  });

  it('lowercases mixed-case input', () => {
    expect(normalizeHex('#AbCdEf')).toBe('#abcdef');
  });

  it('handles 6-digit without # prefix', () => {
    expect(normalizeHex('aabbcc')).toBe('#aabbcc');
  });
});
