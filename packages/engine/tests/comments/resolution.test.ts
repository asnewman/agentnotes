import { describe, it, expect } from 'vitest';
import { resolveCommentRange, getAllHighlightRanges } from '../../src/comments/resolution.js';
import { hashQuote } from '../../src/comments/anchoring.js';
import type { NoteComment } from '../../src/types.js';

function makeComment(from: number, to: number, content: string): NoteComment {
  const quote = content.slice(from, to);
  return {
    id: 'c1',
    author: 'test',
    created: new Date().toISOString(),
    content: 'test',
    status: 'attached',
    anchor: {
      from,
      to,
      rev: 1,
      startAffinity: 'after',
      endAffinity: 'before',
      quote,
      quoteHash: hashQuote(quote),
    },
  };
}

describe('resolveCommentRange', () => {
  it('returns range for attached comment', () => {
    const content = 'hello world';
    const comment = makeComment(6, 11, content);
    const range = resolveCommentRange(content, comment);
    expect(range).toEqual({ from: 6, to: 11 });
  });

  it('returns null for detached comment', () => {
    const comment: NoteComment = {
      id: 'c1',
      author: 'test',
      created: new Date().toISOString(),
      content: 'test',
      status: 'detached',
      anchor: { from: 5, to: 5, rev: 1 },
    };
    const range = resolveCommentRange('hello world', comment);
    expect(range).toBeNull();
  });

  it('clamps range when content is shorter than anchor', () => {
    const comment = makeComment(0, 5, 'hello');
    // Content "hi" is shorter — anchor gets clamped to [0,2]
    const range = resolveCommentRange('hi', comment);
    expect(range).toEqual({ from: 0, to: 2 });
  });

  it('returns null when anchor collapses to zero-width', () => {
    const comment: NoteComment = {
      id: 'c1',
      author: 'test',
      created: new Date().toISOString(),
      content: 'test',
      status: 'attached',
      anchor: { from: 5, to: 10, rev: 1, quote: 'xxxxx', quoteHash: hashQuote('xxxxx') },
    };
    // Content "hi" clamps both from and to to 2, making to <= from
    const range = resolveCommentRange('hi', comment);
    expect(range).toBeNull();
  });
});

describe('getAllHighlightRanges', () => {
  it('returns empty array for no comments', () => {
    expect(getAllHighlightRanges('hello', [])).toEqual([]);
  });

  it('returns ranges for comments', () => {
    const content = 'hello world foo';
    const c1 = makeComment(0, 5, content);
    const c2 = makeComment(6, 11, content);
    const ranges = getAllHighlightRanges(content, [c1, c2]);
    expect(ranges).toEqual([
      { from: 0, to: 5 },
      { from: 6, to: 11 },
    ]);
  });

  it('merges overlapping ranges', () => {
    const content = 'hello world';
    const c1 = makeComment(0, 7, content);
    const c2 = makeComment(5, 11, content);
    const ranges = getAllHighlightRanges(content, [c1, c2]);
    expect(ranges).toEqual([{ from: 0, to: 11 }]);
  });
});
