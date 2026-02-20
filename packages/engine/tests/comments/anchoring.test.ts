import { describe, it, expect } from 'vitest';
import { hashQuote, buildAnchorFromRange, getUniqueMatchRange } from '../../src/comments/anchoring.js';

describe('hashQuote', () => {
  it('produces a consistent 16-char hex hash', () => {
    const hash = hashQuote('hello world');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('returns the same hash for the same input', () => {
    expect(hashQuote('test')).toBe(hashQuote('test'));
  });

  it('returns different hashes for different inputs', () => {
    expect(hashQuote('hello')).not.toBe(hashQuote('world'));
  });

  it('handles empty string', () => {
    const hash = hashQuote('');
    expect(hash).toHaveLength(16);
  });
});

describe('buildAnchorFromRange', () => {
  it('creates an anchor with correct from/to/rev', () => {
    const content = 'hello world';
    const anchor = buildAnchorFromRange(content, 0, 5, 1);
    expect(anchor.from).toBe(0);
    expect(anchor.to).toBe(5);
    expect(anchor.rev).toBe(1);
  });

  it('captures the quote text', () => {
    const content = 'hello world';
    const anchor = buildAnchorFromRange(content, 6, 11, 1);
    expect(anchor.quote).toBe('world');
  });

  it('computes quote hash', () => {
    const content = 'hello world';
    const anchor = buildAnchorFromRange(content, 6, 11, 1);
    expect(anchor.quoteHash).toBe(hashQuote('world'));
  });

  it('sets default affinities', () => {
    const content = 'hello world';
    const anchor = buildAnchorFromRange(content, 0, 5, 1);
    expect(anchor.startAffinity).toBe('after');
    expect(anchor.endAffinity).toBe('before');
  });

  it('throws for negative from', () => {
    expect(() => buildAnchorFromRange('hello', -1, 3, 1)).toThrow('Invalid comment anchor range');
  });

  it('throws when to <= from', () => {
    expect(() => buildAnchorFromRange('hello', 3, 3, 1)).toThrow('Invalid comment anchor range');
    expect(() => buildAnchorFromRange('hello', 4, 3, 1)).toThrow('Invalid comment anchor range');
  });

  it('throws when to exceeds content length', () => {
    expect(() => buildAnchorFromRange('hello', 0, 10, 1)).toThrow('Invalid comment anchor range');
  });

  it('floors fractional from/to', () => {
    const content = 'hello world';
    const anchor = buildAnchorFromRange(content, 0.7, 5.9, 1);
    expect(anchor.from).toBe(0);
    expect(anchor.to).toBe(5);
  });

  it('clamps rev to non-negative', () => {
    const anchor = buildAnchorFromRange('hello', 0, 5, -3);
    expect(anchor.rev).toBe(0);
  });
});

describe('getUniqueMatchRange', () => {
  it('returns range for unique text', () => {
    const result = getUniqueMatchRange('hello world', 'world');
    expect(result).toEqual({ from: 6, to: 11 });
  });

  it('returns null for ambiguous text', () => {
    const result = getUniqueMatchRange('hello hello', 'hello');
    expect(result).toBeNull();
  });

  it('returns null when text not found', () => {
    const result = getUniqueMatchRange('hello world', 'xyz');
    expect(result).toBeNull();
  });

  it('returns null for empty exact string', () => {
    const result = getUniqueMatchRange('hello world', '');
    expect(result).toBeNull();
  });
});
