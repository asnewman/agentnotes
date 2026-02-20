import type { CommentAnchor } from '../types.js';

const DEFAULT_START_AFFINITY = 'after' as const;
const DEFAULT_END_AFFINITY = 'before' as const;

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
    startAffinity: DEFAULT_START_AFFINITY,
    endAffinity: DEFAULT_END_AFFINITY,
    quote,
    quoteHash: hashQuote(quote),
  };
}

export function getUniqueMatchRange(
  content: string,
  exact: string,
): { from: number; to: number } | null {
  if (!exact) {
    return null;
  }

  const first = content.indexOf(exact);
  if (first < 0) {
    return null;
  }

  const second = content.indexOf(exact, first + exact.length);
  if (second >= 0) {
    return null;
  }

  return { from: first, to: first + exact.length };
}
