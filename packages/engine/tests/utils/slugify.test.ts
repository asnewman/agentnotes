import { describe, it, expect } from 'vitest';
import { slugify } from '../../src/utils/slugify.js';

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with dashes', () => {
    expect(slugify('my note title')).toBe('my-note-title');
  });

  it('replaces underscores with dashes', () => {
    expect(slugify('my_note_title')).toBe('my-note-title');
  });

  it('removes special characters', () => {
    expect(slugify('Hello! @World#')).toBe('hello-world');
  });

  it('prevents consecutive dashes', () => {
    expect(slugify('hello---world')).toBe('hello-world');
  });

  it('trims trailing dashes', () => {
    expect(slugify('hello world!')).toBe('hello-world');
  });

  it('handles leading special characters', () => {
    expect(slugify('!!!hello')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles only special characters', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('preserves digits', () => {
    expect(slugify('Chapter 1')).toBe('chapter-1');
  });
});
