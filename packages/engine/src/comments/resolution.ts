import type { NoteComment } from '../types.js';
import { normalizeComment } from './transformation.js';

export interface CharRange {
  from: number;
  to: number;
}

export function resolveCommentRange(content: string, comment: NoteComment): CharRange | null {
  const normalized = normalizeComment(comment, content, comment.anchor.rev);
  if (normalized.status === 'detached') {
    return null;
  }

  const { from, to } = normalized.anchor;
  if (from < 0 || to <= from || to > content.length) {
    return null;
  }

  return { from, to };
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
