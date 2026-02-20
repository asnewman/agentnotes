export function slugify(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  let result = '';
  let prevDash = false;

  for (const char of normalized) {
    const isAsciiLower = char >= 'a' && char <= 'z';
    const isDigit = char >= '0' && char <= '9';

    if (isAsciiLower || isDigit) {
      result += char;
      prevDash = false;
      continue;
    }

    if (char === ' ' || char === '-' || char === '_') {
      if (!prevDash && result.length > 0) {
        result += '-';
        prevDash = true;
      }
    }
  }

  return result.replace(/-+$/g, '');
}
