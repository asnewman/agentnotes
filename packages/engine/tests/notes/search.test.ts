import { describe, it, expect } from 'vitest';
import { search, getAllTags, getSortedTags } from '../../src/notes/search.js';
import type { Note } from '../../src/types.js';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'test.md',
    title: 'Test Note',
    tags: [],
    commentRev: 0,
    comments: [],
    content: '# Test Note\n\nSome content',
    filename: 'test.md',
    relativePath: 'test.md',
    directory: '',
    ...overrides,
  };
}

describe('search', () => {
  const notes = [
    makeNote({ id: 'a.md', title: 'Alpha', tags: ['important', 'work'], relativePath: 'a.md' }),
    makeNote({ id: 'b.md', title: 'Beta', tags: ['personal'], content: '# Beta\n\nalpha reference', relativePath: 'b.md' }),
    makeNote({ id: 'c.md', title: 'Gamma', tags: ['important', 'personal'], relativePath: 'c.md' }),
  ];

  it('returns all notes with no filters', () => {
    expect(search(notes)).toHaveLength(3);
  });

  it('filters by query matching title', () => {
    const result = search(notes, { query: 'alpha' });
    expect(result).toHaveLength(2);
  });

  it('filters by query matching content', () => {
    const result = search(notes, { query: 'reference' });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Beta');
  });

  it('filters by single tag', () => {
    const result = search(notes, { tags: ['important'] });
    expect(result).toHaveLength(2);
  });

  it('filters by multiple tags (all must match)', () => {
    const result = search(notes, { tags: ['important', 'personal'] });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Gamma');
  });

  it('applies limit', () => {
    const result = search(notes, { limit: 1 });
    expect(result).toHaveLength(1);
  });

  it('sorts by title', () => {
    const result = search(notes, { sortBy: 'title' });
    expect(result.map((n) => n.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('sorts by title reversed', () => {
    const result = search(notes, { sortBy: 'title', reverse: true });
    expect(result.map((n) => n.title)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });
});

describe('getAllTags', () => {
  it('aggregates tag counts', () => {
    const notes = [
      makeNote({ tags: ['a', 'b'] }),
      makeNote({ tags: ['b', 'c'] }),
    ];
    const tags = getAllTags(notes);
    expect(tags.get('a')).toBe(1);
    expect(tags.get('b')).toBe(2);
    expect(tags.get('c')).toBe(1);
  });

  it('returns empty map for no notes', () => {
    expect(getAllTags([])).toEqual(new Map());
  });
});

describe('getSortedTags', () => {
  it('sorts by count desc then name asc', () => {
    const notes = [
      makeNote({ tags: ['z', 'a'] }),
      makeNote({ tags: ['a', 'b'] }),
      makeNote({ tags: ['a'] }),
    ];
    const sorted = getSortedTags(notes);
    expect(sorted[0]).toEqual({ tag: 'a', count: 3 });
    expect(sorted[1].tag).toBe('b');
    expect(sorted[2].tag).toBe('z');
  });
});
