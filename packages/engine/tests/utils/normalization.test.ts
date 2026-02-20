import { describe, it, expect } from 'vitest';
import {
  normalizeTags,
  normalizeContent,
  normalizeStatus,
  normalizeAffinity,
} from '../../src/utils/normalization.js';

describe('normalizeTags', () => {
  it('removes duplicate tags (case-insensitive)', () => {
    expect(normalizeTags(['Test', 'test', 'TEST'])).toEqual(['Test']);
  });

  it('trims whitespace', () => {
    expect(normalizeTags([' hello ', '  world  '])).toEqual(['hello', 'world']);
  });

  it('removes empty tags', () => {
    expect(normalizeTags(['', '  ', 'valid'])).toEqual(['valid']);
  });

  it('preserves original casing of first occurrence', () => {
    expect(normalizeTags(['JavaScript', 'javascript'])).toEqual(['JavaScript']);
  });
});

describe('normalizeContent', () => {
  it('converts CRLF to LF', () => {
    expect(normalizeContent('hello\r\nworld')).toBe('hello\nworld');
  });

  it('strips trailing newlines', () => {
    expect(normalizeContent('hello\n\n\n')).toBe('hello');
  });

  it('preserves internal newlines', () => {
    expect(normalizeContent('hello\n\nworld')).toBe('hello\n\nworld');
  });
});

describe('normalizeStatus', () => {
  it('returns valid status values unchanged', () => {
    expect(normalizeStatus('attached', true)).toBe('attached');
    expect(normalizeStatus('stale', true)).toBe('stale');
    expect(normalizeStatus('detached', false)).toBe('detached');
  });

  it('returns attached for unknown status with range', () => {
    expect(normalizeStatus('invalid', true)).toBe('attached');
  });

  it('returns detached for unknown status without range', () => {
    expect(normalizeStatus(undefined, false)).toBe('detached');
  });
});

describe('normalizeAffinity', () => {
  it('returns valid affinity values unchanged', () => {
    expect(normalizeAffinity('before', 'after')).toBe('before');
    expect(normalizeAffinity('after', 'before')).toBe('after');
  });

  it('returns fallback for invalid affinity', () => {
    expect(normalizeAffinity('invalid', 'after')).toBe('after');
    expect(normalizeAffinity(undefined, 'before')).toBe('before');
  });
});
