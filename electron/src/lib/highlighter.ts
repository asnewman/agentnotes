import type { NoteComment } from '../types';

export interface CharRange {
  from: number;
  to: number;
}

function getAllExactMatches(content: string, exact: string): number[] {
  const matches: number[] = [];
  if (!content || !exact) {
    return matches;
  }

  let offset = 0;
  while (offset <= content.length - exact.length) {
    const index = content.indexOf(exact, offset);
    if (index < 0) {
      break;
    }

    matches.push(index);
    offset = index + 1;
  }

  return matches;
}

function matchesPrefix(content: string, index: number, prefix: string): boolean {
  if (prefix.length > index) {
    return false;
  }

  return content.slice(index - prefix.length, index) === prefix;
}

function matchesSuffix(content: string, end: number, suffix: string): boolean {
  if (end + suffix.length > content.length) {
    return false;
  }

  return content.slice(end, end + suffix.length) === suffix;
}

export function resolveCommentRange(content: string, comment: NoteComment): CharRange | null {
  const exact = comment.anchor.exact;
  const prefix = comment.anchor.prefix;
  const suffix = comment.anchor.suffix;

  if (!exact) {
    return null;
  }

  const matches = getAllExactMatches(content, exact);
  if (matches.length === 0) {
    return null;
  }

  const resolved = matches.filter((start) => {
    const end = start + exact.length;
    return matchesPrefix(content, start, prefix) && matchesSuffix(content, end, suffix);
  });

  if (resolved.length !== 1) {
    return null;
  }

  const from = resolved[0];
  return { from, to: from + exact.length };
}

export function getAllHighlightRanges(content: string, comments: NoteComment[]): CharRange[] {
  if (!comments || comments.length === 0) {
    return [];
  }

  const ranges: CharRange[] = [];
  for (const comment of comments) {
    const range = resolveCommentRange(content, comment);
    if (range) {
      ranges.push(range);
    }
  }

  ranges.sort((a, b) => a.from - b.from);
  return mergeRanges(ranges);
}

function mergeRanges(ranges: CharRange[]): CharRange[] {
  if (ranges.length === 0) {
    return [];
  }

  const merged: CharRange[] = [{ ...ranges[0] }];

  for (let index = 1; index < ranges.length; index += 1) {
    const current = ranges[index];
    const last = merged[merged.length - 1];

    if (current.from <= last.to) {
      last.to = Math.max(last.to, current.to);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}
