import type { CommentAffinity, CommentStatus } from '../types.js';

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawTag of tags) {
    const tag = rawTag.trim();
    if (!tag) {
      continue;
    }

    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(tag);
  }

  return normalized;
}

export function normalizeContent(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

export function normalizeStatus(value: unknown, hasRange: boolean): CommentStatus {
  if (value === 'attached' || value === 'stale' || value === 'detached') {
    return value;
  }

  return hasRange ? 'attached' : 'detached';
}

export function normalizeAffinity(value: unknown, fallback: CommentAffinity): CommentAffinity {
  if (value === 'before' || value === 'after') {
    return value;
  }
  return fallback;
}
