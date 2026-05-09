const HEX_PATTERN = /^#?[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;

export function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

export function normalizeHex(value: string): string {
  const trimmed = value.trim().replace(/^#/, '').toLowerCase();
  if (trimmed.length === 3) {
    return '#' + trimmed.split('').map(c => c + c).join('');
  }
  return '#' + trimmed;
}
