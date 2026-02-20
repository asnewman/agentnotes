import fs from 'node:fs';
import path from 'node:path';
import type { CommentAnchor, CommentStatus, NoteComment } from '../types.js';
import { normalizeTags } from '../utils/normalization.js';
import { normalizeAffinity, normalizeStatus } from '../utils/normalization.js';
import {
  isRecord,
  toIsoDate,
  toNumberValue,
  toOptionalNonNegativeInt,
  toStringValue,
} from '../utils/validation.js';
import { getUniqueMatchRange } from '../comments/anchoring.js';

export interface NoteSidecarData extends Record<string, unknown> {
  tags?: unknown;
  comment_rev?: unknown;
  comments?: unknown;
}

export function getNoteSidecarPath(notePath: string): string {
  const extensionlessPath =
    path.extname(notePath).toLowerCase() === '.md' ? notePath.slice(0, -3) : notePath;
  return `${extensionlessPath}.json`;
}

export function readSidecarData(filePath: string): NoteSidecarData {
  const sidecarPath = getNoteSidecarPath(filePath);
  if (!fs.existsSync(sidecarPath)) {
    return {};
  }

  try {
    const rawData = fs.readFileSync(sidecarPath, 'utf-8');
    const parsedData = JSON.parse(rawData) as unknown;
    return isRecord(parsedData) ? parsedData : {};
  } catch (error) {
    console.error(`Error reading note metadata sidecar ${sidecarPath}:`, error);
    return {};
  }
}

export function writeSidecarData(
  filePath: string,
  tags: string[],
  comments: NoteComment[],
  commentRev: number,
): void {
  const sidecarPath = getNoteSidecarPath(filePath);
  const normalizedTags = normalizeTags(tags);
  const normalizedCommentRev = Math.max(0, Math.floor(commentRev));
  const payload: Record<string, unknown> = {
    tags: normalizedTags,
    comments: comments.map((comment) => toCommentRecord(comment)),
  };

  if (normalizedCommentRev > 0) {
    payload.comment_rev = normalizedCommentRev;
  }

  fs.writeFileSync(sidecarPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

function parseCommentAnchor(
  source: unknown,
  noteContent: string,
  fallbackRev: number,
): CommentAnchor {
  if (!isRecord(source)) {
    return {
      from: 0,
      to: 0,
      rev: fallbackRev,
      startAffinity: 'after',
      endAffinity: 'before',
    };
  }

  const fromValue = toOptionalNonNegativeInt(source.from);
  const toValue = toOptionalNonNegativeInt(source.to);
  const legacyStart = toOptionalNonNegativeInt(source.start);
  const legacyEnd = toOptionalNonNegativeInt(source.end);
  const exact = toStringValue(source.exact);

  let from = 0;
  let to = 0;

  if (fromValue !== undefined && toValue !== undefined && toValue >= fromValue) {
    from = fromValue;
    to = toValue;
  } else if (legacyStart !== undefined && legacyEnd !== undefined && legacyEnd >= legacyStart) {
    from = legacyStart;
    to = legacyEnd;
  } else {
    const uniqueMatch = getUniqueMatchRange(noteContent, exact);
    if (uniqueMatch) {
      from = uniqueMatch.from;
      to = uniqueMatch.to;
    }
  }

  from = Math.max(0, Math.min(from, noteContent.length));
  to = Math.max(0, Math.min(to, noteContent.length));

  const revValue = toOptionalNonNegativeInt(source.rev);
  const quote = toStringValue(source.quote, exact);
  const quoteHash = toStringValue(
    (source.quote_hash as string | undefined) || (source.quoteHash as string | undefined),
  );

  return {
    from,
    to,
    rev: revValue !== undefined ? revValue : fallbackRev,
    startAffinity: normalizeAffinity(
      (source.start_affinity as string | undefined) ||
        (source.startAffinity as string | undefined),
      'after',
    ),
    endAffinity: normalizeAffinity(
      (source.end_affinity as string | undefined) ||
        (source.endAffinity as string | undefined),
      'before',
    ),
    ...(quote ? { quote } : {}),
    ...(quoteHash ? { quoteHash } : {}),
  };
}

function parseCommentEntry(
  source: unknown,
  fallbackIso: string,
  noteContent: string,
  fallbackRev: number,
): NoteComment {
  if (!isRecord(source)) {
    return {
      id: '',
      author: '',
      created: fallbackIso,
      content: '',
      status: 'detached',
      anchor: {
        from: 0,
        to: 0,
        rev: fallbackRev,
        startAffinity: 'after',
        endAffinity: 'before',
      },
    };
  }

  const anchor = parseCommentAnchor(source.anchor, noteContent, fallbackRev);
  const hasRange = anchor.to > anchor.from;

  return {
    id: toStringValue(source.id),
    author: toStringValue(source.author),
    created: toIsoDate(source.created, fallbackIso),
    content: toStringValue(source.content),
    status: normalizeStatus(source.status, hasRange) as CommentStatus,
    anchor,
  };
}

export function parseComments(
  source: unknown,
  noteContent: string,
  commentRev: number,
): NoteComment[] {
  if (!Array.isArray(source)) {
    return [];
  }

  const fallbackIso = new Date().toISOString();
  return source.map((entry) => parseCommentEntry(entry, fallbackIso, noteContent, commentRev));
}

function toAnchorRecord(anchor: CommentAnchor): Record<string, unknown> {
  return {
    from: anchor.from,
    to: anchor.to,
    rev: anchor.rev,
    start_affinity: anchor.startAffinity ?? 'after',
    end_affinity: anchor.endAffinity ?? 'before',
    ...(anchor.quote ? { quote: anchor.quote } : {}),
    ...(anchor.quoteHash ? { quote_hash: anchor.quoteHash } : {}),
  };
}

export function toCommentRecord(comment: NoteComment): Record<string, unknown> {
  return {
    id: comment.id,
    author: comment.author,
    created: comment.created,
    content: comment.content,
    status: comment.status,
    anchor: toAnchorRecord(comment.anchor),
  };
}
