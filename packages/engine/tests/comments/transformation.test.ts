import { describe, it, expect } from 'vitest';
import {
  deriveTextEditOps,
  remapCommentsForEdit,
  transformOffset,
  commonPrefixLen,
  commonSuffixLen,
} from '../../src/comments/transformation.js';
import { buildAnchorFromRange, hashQuote } from '../../src/comments/anchoring.js';
import type { NoteComment } from '../../src/types.js';

function makeComment(from: number, to: number, content: string, rev: number): NoteComment {
  const quote = content.slice(from, to);
  return {
    id: 'test-comment',
    author: 'test',
    created: new Date().toISOString(),
    content: 'test comment',
    status: 'attached',
    anchor: {
      from,
      to,
      rev,
      startAffinity: 'after',
      endAffinity: 'before',
      quote,
      quoteHash: hashQuote(quote),
    },
  };
}

describe('deriveTextEditOps', () => {
  it('returns empty array for identical strings', () => {
    expect(deriveTextEditOps('hello', 'hello')).toEqual([]);
  });

  it('detects insertion at beginning', () => {
    const ops = deriveTextEditOps('hello', 'well hello');
    expect(ops).toEqual([{ at: 0, deleteLen: 0, insertLen: 5 }]);
  });

  it('detects deletion at end', () => {
    const ops = deriveTextEditOps('hello world', 'hello ');
    expect(ops).toEqual([{ at: 6, deleteLen: 5, insertLen: 0 }]);
  });

  it('detects replacement in middle', () => {
    const ops = deriveTextEditOps('hello world', 'hello earth');
    expect(ops).toEqual([{ at: 6, deleteLen: 5, insertLen: 5 }]);
  });

  it('detects insertion in middle', () => {
    const ops = deriveTextEditOps('helloworld', 'hello world');
    expect(ops).toEqual([{ at: 5, deleteLen: 0, insertLen: 1 }]);
  });
});

describe('transformOffset', () => {
  it('does not move offset before edit', () => {
    expect(transformOffset(2, 'after', { at: 5, deleteLen: 0, insertLen: 3 })).toBe(2);
  });

  it('shifts offset after edit by delta', () => {
    expect(transformOffset(10, 'after', { at: 5, deleteLen: 0, insertLen: 3 })).toBe(13);
  });

  it('handles pure insert at offset with after affinity', () => {
    expect(transformOffset(5, 'after', { at: 5, deleteLen: 0, insertLen: 3 })).toBe(8);
  });

  it('handles pure insert at offset with before affinity', () => {
    expect(transformOffset(5, 'before', { at: 5, deleteLen: 0, insertLen: 3 })).toBe(5);
  });

  it('collapses offset within deletion to edit start', () => {
    expect(transformOffset(7, 'after', { at: 5, deleteLen: 5, insertLen: 0 })).toBe(5);
  });
});

describe('commonPrefixLen', () => {
  it('returns 0 for empty strings', () => {
    expect(commonPrefixLen('', '')).toBe(0);
  });

  it('finds common prefix', () => {
    expect(commonPrefixLen('hello world', 'hello earth')).toBe(6);
  });

  it('returns full length for identical strings', () => {
    expect(commonPrefixLen('abc', 'abc')).toBe(3);
  });
});

describe('commonSuffixLen', () => {
  it('returns 0 for no common suffix', () => {
    expect(commonSuffixLen('abc', 'xyz')).toBe(0);
  });

  it('finds common suffix', () => {
    expect(commonSuffixLen('hello world', 'brave world')).toBe(6);
  });
});

describe('remapCommentsForEdit', () => {
  it('returns unchanged for empty comments', () => {
    const result = remapCommentsForEdit([], 'hello', 'hello world', 0);
    expect(result.comments).toEqual([]);
  });

  it('shifts comment anchor when text inserted before', () => {
    const content = 'hello world';
    const comment = makeComment(6, 11, content, 0);
    const result = remapCommentsForEdit([comment], content, 'well hello world', 0);

    expect(result.comments[0].anchor.from).toBe(11);
    expect(result.comments[0].anchor.to).toBe(16);
    expect(result.comments[0].status).toBe('attached');
    expect(result.nextRev).toBe(1);
  });

  it('marks comment as stale when edit overlaps anchor', () => {
    const content = 'hello world';
    const comment = makeComment(6, 11, content, 0);
    const result = remapCommentsForEdit([comment], content, 'hello worLd', 0);

    expect(result.comments[0].status).toBe('stale');
  });

  it('marks comment as detached when range fully deleted', () => {
    const content = 'hello world';
    const comment = makeComment(6, 11, content, 0);
    const result = remapCommentsForEdit([comment], content, 'hello ', 0);

    expect(result.comments[0].anchor.from).toBe(6);
    expect(result.comments[0].anchor.to).toBe(6);
    expect(result.comments[0].status).toBe('detached');
  });

  it('increments rev on content change', () => {
    const content = 'hello world';
    const comment = makeComment(0, 5, content, 1);
    const result = remapCommentsForEdit([comment], content, 'hello world!', 1);
    expect(result.nextRev).toBe(2);
  });

  it('does not change rev when content is unchanged', () => {
    const content = 'hello world';
    const comment = makeComment(0, 5, content, 1);
    const result = remapCommentsForEdit([comment], content, content, 1);
    expect(result.nextRev).toBe(1);
  });
});
