/**
 * Browser-compatible utilities for the renderer process.
 * These are pure functions that don't depend on Node.js APIs.
 */

import type { CommentAnchor, CommentStatus, NoteComment, CommentAffinity } from '../types';

// --- Title Case ---

const TITLE_CASE_SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'per',
  'the',
  'to',
  'vs',
  'via',
]);

export function toTitleCase(value: string): string {
  if (!value.trim()) {
    return value;
  }

  const lowerCaseValue = value.toLocaleLowerCase();
  const matches = Array.from(lowerCaseValue.matchAll(/[a-z0-9][a-z0-9''\u2019]*/g));
  if (matches.length === 0) {
    return value;
  }

  let matchIndex = 0;
  const lastMatchIndex = matches.length - 1;
  return lowerCaseValue.replace(/[a-z0-9][a-z0-9''\u2019]*/g, (word) => {
    const isFirst = matchIndex === 0;
    const isLast = matchIndex === lastMatchIndex;
    matchIndex += 1;

    if (!isFirst && !isLast && TITLE_CASE_SMALL_WORDS.has(word)) {
      return word;
    }

    return `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`;
  });
}

// --- Hash Quote (FNV-1a 64-bit) ---

function hashQuote(text: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, '0');
}

// --- Anchor Building ---

const DEFAULT_START_AFFINITY: CommentAffinity = 'after';
const DEFAULT_END_AFFINITY: CommentAffinity = 'before';

export function buildAnchorFromRange(
  content: string,
  from: number,
  to: number,
  rev: number,
): CommentAnchor {
  const normalizedFrom = Math.floor(from);
  const normalizedTo = Math.floor(to);
  if (normalizedFrom < 0 || normalizedTo <= normalizedFrom || normalizedTo > content.length) {
    throw new Error('Invalid comment anchor range');
  }

  const quote = content.slice(normalizedFrom, normalizedTo);

  return {
    from: normalizedFrom,
    to: normalizedTo,
    rev: Math.max(0, Math.floor(rev)),
    startAffinity: DEFAULT_START_AFFINITY,
    endAffinity: DEFAULT_END_AFFINITY,
    quote,
    quoteHash: hashQuote(quote),
  };
}

// --- Comment Resolution ---

export interface CharRange {
  from: number;
  to: number;
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
}

function normalizeAffinity(
  affinity: CommentAffinity | string | undefined,
  fallback: CommentAffinity,
): CommentAffinity {
  if (affinity === 'before' || affinity === 'after') {
    return affinity;
  }
  return fallback;
}

function normalizeCommentStatus(
  status: CommentStatus | string | undefined,
  hasRange: boolean,
): CommentStatus {
  if (status === 'attached' || status === 'stale' || status === 'detached') {
    return status;
  }
  return hasRange ? 'attached' : 'detached';
}

function normalizeComment(
  comment: NoteComment,
  content: string,
  fallbackRev: number,
): NoteComment {
  const from = clamp(Math.floor(comment.anchor.from ?? 0), 0, content.length);
  const to = clamp(Math.floor(comment.anchor.to ?? 0), 0, content.length);
  const hasRange = to > from;

  const startAffinity = normalizeAffinity(comment.anchor.startAffinity, DEFAULT_START_AFFINITY);
  const endAffinity = normalizeAffinity(comment.anchor.endAffinity, DEFAULT_END_AFFINITY);
  const quote = comment.anchor.quote ?? (hasRange ? content.slice(from, to) : '');
  const quoteHash = comment.anchor.quoteHash ?? (quote ? hashQuote(quote) : undefined);
  const rev =
    Number.isFinite(comment.anchor.rev) ? Math.max(0, Math.floor(comment.anchor.rev)) : 0;

  return {
    ...comment,
    status: normalizeCommentStatus(comment.status, hasRange),
    anchor: {
      ...comment.anchor,
      from,
      to,
      rev: rev > 0 ? rev : Math.max(0, Math.floor(fallbackRev)),
      startAffinity,
      endAffinity,
      quote,
      quoteHash,
    },
  };
}

function resolveCommentRange(content: string, comment: NoteComment): CharRange | null {
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
