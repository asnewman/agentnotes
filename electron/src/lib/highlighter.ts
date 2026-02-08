import type { CommentAffinity, CommentAnchor, CommentStatus, NoteComment } from '../types';

export interface CharRange {
  from: number;
  to: number;
}

export interface TextEditOp {
  at: number;
  deleteLen: number;
  insertLen: number;
}

const defaultStartAffinity: CommentAffinity = 'after';
const defaultEndAffinity: CommentAffinity = 'before';

export function hashQuote(text: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, '0');
}

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
    startAffinity: defaultStartAffinity,
    endAffinity: defaultEndAffinity,
    quote,
    quoteHash: hashQuote(quote),
  };
}

export function deriveTextEditOps(before: string, after: string): TextEditOp[] {
  if (before === after) {
    return [];
  }

  const prefix = commonPrefixLen(before, after);
  const beforeTail = before.slice(prefix);
  const afterTail = after.slice(prefix);
  const suffix = commonSuffixLen(beforeTail, afterTail);

  const deleteLen = before.length - prefix - suffix;
  const insertLen = after.length - prefix - suffix;

  if (deleteLen === 0 && insertLen === 0) {
    return [];
  }

  return [{ at: prefix, deleteLen, insertLen }];
}

export function remapCommentsForEdit(
  comments: NoteComment[],
  before: string,
  after: string,
  currentRev: number,
): { comments: NoteComment[]; nextRev: number } {
  if (comments.length === 0) {
    return { comments, nextRev: Math.max(0, currentRev) };
  }

  const ops = deriveTextEditOps(before, after);
  if (ops.length === 0) {
    return {
      comments: comments.map((comment) => normalizeComment(comment, after, currentRev)),
      nextRev: Math.max(0, currentRev),
    };
  }

  const nextRev = Math.max(1, currentRev + 1);
  const remapped = comments.map((comment) => remapComment(comment, ops, after, nextRev));
  return { comments: remapped, nextRev };
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

function remapComment(
  input: NoteComment,
  ops: TextEditOp[],
  nextContent: string,
  nextRev: number,
): NoteComment {
  let comment = normalizeComment(input, nextContent, nextRev);
  let from = comment.anchor.from;
  let to = comment.anchor.to;
  let touched = false;

  for (const op of ops) {
    if (op.deleteLen > 0 && rangesOverlap(from, to, op.at, op.at + op.deleteLen)) {
      touched = true;
    }
    if (op.deleteLen === 0 && op.at > from && op.at < to) {
      touched = true;
    }

    from = transformOffset(from, comment.anchor.startAffinity ?? defaultStartAffinity, op);
    to = transformOffset(to, comment.anchor.endAffinity ?? defaultEndAffinity, op);
  }

  from = clamp(from, 0, nextContent.length);
  to = clamp(to, 0, nextContent.length);

  const anchor: CommentAnchor = {
    ...comment.anchor,
    from,
    to,
    rev: nextRev,
  };

  if (to <= from) {
    return { ...comment, anchor, status: 'detached' };
  }

  if (touched) {
    return { ...comment, anchor, status: 'stale' };
  }

  if (anchor.quoteHash) {
    const currentQuote = nextContent.slice(from, to);
    if (hashQuote(currentQuote) !== anchor.quoteHash) {
      return { ...comment, anchor, status: 'stale' };
    }
  }

  return { ...comment, anchor, status: 'attached' };
}

function normalizeComment(comment: NoteComment, content: string, fallbackRev: number): NoteComment {
  const from = clamp(Math.floor(comment.anchor.from ?? 0), 0, content.length);
  const to = clamp(Math.floor(comment.anchor.to ?? 0), 0, content.length);
  const hasRange = to > from;

  const startAffinity = normalizeAffinity(comment.anchor.startAffinity, defaultStartAffinity);
  const endAffinity = normalizeAffinity(comment.anchor.endAffinity, defaultEndAffinity);
  const quote = comment.anchor.quote ?? (hasRange ? content.slice(from, to) : '');
  const quoteHash = comment.anchor.quoteHash ?? (quote ? hashQuote(quote) : undefined);
  const rev = Number.isFinite(comment.anchor.rev) ? Math.max(0, Math.floor(comment.anchor.rev)) : 0;

  return {
    ...comment,
    status: normalizeStatus(comment.status, hasRange),
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

function normalizeStatus(status: CommentStatus | string | undefined, hasRange: boolean): CommentStatus {
  if (status === 'attached' || status === 'stale' || status === 'detached') {
    return status;
  }

  return hasRange ? 'attached' : 'detached';
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

function transformOffset(offset: number, affinity: CommentAffinity, op: TextEditOp): number {
  if (offset < op.at) {
    return offset;
  }

  const opEnd = op.at + op.deleteLen;
  const delta = op.insertLen - op.deleteLen;

  if (offset > opEnd) {
    return offset + delta;
  }

  if (offset === op.at) {
    if (op.deleteLen === 0) {
      return affinity === 'after' ? offset + op.insertLen : offset;
    }
    return op.at;
  }

  if (offset === opEnd) {
    return affinity === 'after' ? op.at + op.insertLen : op.at;
  }

  return op.at;
}

function commonPrefixLen(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) {
    index += 1;
  }
  return index;
}

function commonSuffixLen(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[a.length - 1 - index] === b[b.length - 1 - index]) {
    index += 1;
  }
  return index;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
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
