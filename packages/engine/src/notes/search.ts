import type { Note, SearchOptions, SortField, TagCount } from '../types.js';

export function search(notes: Note[], opts: SearchOptions = {}): Note[] {
  let result = [...notes];

  if (opts.query) {
    const query = opts.query.toLocaleLowerCase();
    result = result.filter((note) => matchesQuery(note, query));
  }

  if (opts.tags && opts.tags.length > 0) {
    const filterTags = opts.tags.map((t) => t.toLocaleLowerCase());
    result = result.filter((note) => filterTags.every((tag) => hasTag(note, tag)));
  }

  sortNotes(result, opts.sortBy ?? 'created', opts.reverse ?? false);

  if (opts.limit && opts.limit > 0) {
    result = result.slice(0, opts.limit);
  }

  return result;
}

export function getAllTags(notes: Note[]): Map<string, number> {
  const tagCounts = new Map<string, number>();

  for (const note of notes) {
    for (const tag of note.tags) {
      const key = tag.toLocaleLowerCase();
      tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
    }
  }

  return tagCounts;
}

export function getSortedTags(notes: Note[]): TagCount[] {
  const tagCounts = getAllTags(notes);
  const sorted: TagCount[] = [];

  for (const [tag, count] of tagCounts) {
    sorted.push({ tag, count });
  }

  sorted.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.tag.localeCompare(b.tag);
  });

  return sorted;
}

function matchesQuery(note: Note, query: string): boolean {
  if (note.title.toLocaleLowerCase().includes(query)) {
    return true;
  }

  if (note.content.toLocaleLowerCase().includes(query)) {
    return true;
  }

  for (const tag of note.tags) {
    if (tag.toLocaleLowerCase().includes(query)) {
      return true;
    }
  }

  return false;
}

function hasTag(note: Note, tag: string): boolean {
  return note.tags.some((t) => t.toLocaleLowerCase() === tag);
}

function sortNotes(notes: Note[], sortBy: SortField, reverse: boolean): void {
  notes.sort((a, b) => {
    let cmp: number;

    switch (sortBy) {
      case 'title':
        cmp = a.title.toLocaleLowerCase().localeCompare(b.title.toLocaleLowerCase());
        break;
      case 'updated':
      case 'created':
      default:
        cmp = a.relativePath.localeCompare(b.relativePath);
        break;
    }

    return reverse ? -cmp : cmp;
  });
}
