import { describe, it, expect } from 'vitest';
import { toTitleCase } from '../../src/utils/formatting.js';

describe('toTitleCase', () => {
  it('capitalizes first letter of each word', () => {
    expect(toTitleCase('hello world')).toBe('Hello World');
  });

  it('keeps small words lowercase in the middle', () => {
    expect(toTitleCase('the art of war')).toBe('The Art of War');
  });

  it('capitalizes first word even if small', () => {
    expect(toTitleCase('a tale of two cities')).toBe('A Tale of Two Cities');
  });

  it('capitalizes last word even if small', () => {
    expect(toTitleCase('what life is all about for')).toBe('What Life Is All About For');
  });

  it('returns empty string for empty input', () => {
    expect(toTitleCase('')).toBe('');
  });

  it('returns whitespace-only input unchanged', () => {
    expect(toTitleCase('   ')).toBe('   ');
  });

  it('handles single word', () => {
    expect(toTitleCase('hello')).toBe('Hello');
  });

  it('handles already-capitalized input', () => {
    expect(toTitleCase('HELLO WORLD')).toBe('Hello World');
  });
});
