import type { CommentAffinity, CommentAnchor, CommentStatus, NoteComment } from '../types.js';
import { hashQuote } from './anchoring.js';

export interface TextEditOp {
  at: number;
  deleteLen: number;
  insertLen: number;
}

const DEFAULT_START_AFFINITY: CommentAffinity = 'after';
const DEFAULT_END_AFFINITY: CommentAffinity = 'before';

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

function remapComment(
  input: NoteComment,
  ops: TextEditOp[],
  nextContent: string,
  nextRev: number,
): NoteComment {
  const comment = normalizeComment(input, nextContent, nextRev);
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

    from = transformOffset(from, comment.anchor.startAffinity ?? DEFAULT_START_AFFINITY, op);
    to = transformOffset(to, comment.anchor.endAffinity ?? DEFAULT_END_AFFINITY, op);
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

export function normalizeComment(
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

function normalizeCommentStatus(
  status: CommentStatus | string | undefined,
  hasRange: boolean,
): CommentStatus {
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

export function transformOffset(
  offset: number,
  affinity: CommentAffinity,
  op: TextEditOp,
): number {
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

export function commonPrefixLen(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) {
    index += 1;
  }
  return index;
}

export function commonSuffixLen(a: string, b: string): number {
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

export function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
}
