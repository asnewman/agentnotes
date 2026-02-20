import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { normalizeContent } from '../utils/normalization.js';
import { isRecord } from '../utils/validation.js';

const LEGACY_FRONTMATTER_FIELDS = new Set([
  'id',
  'title',
  'tags',
  'created',
  'updated',
  'source',
  'comment_rev',
  'comments',
]);

export interface LegacyFrontmatterData extends Record<string, unknown> {
  id?: unknown;
  title?: unknown;
  tags?: unknown;
  created?: unknown;
  updated?: unknown;
  source?: unknown;
  comment_rev?: unknown;
  comments?: unknown;
}

export interface ParsedMarkdownNote {
  content: string;
  legacyData: LegacyFrontmatterData;
  hasLegacyFrontmatter: boolean;
}

function hasLegacyFrontmatter(data: unknown): data is LegacyFrontmatterData {
  if (!isRecord(data)) {
    return false;
  }

  for (const key of LEGACY_FRONTMATTER_FIELDS) {
    if (key in data) {
      return true;
    }
  }

  return false;
}

export function parseMarkdownContent(filePath: string): ParsedMarkdownNote {
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const normalizedRawContent = rawContent.replace(/\r\n/g, '\n');
  const parsed = matter(normalizedRawContent);

  if (normalizedRawContent.startsWith('---\n') && hasLegacyFrontmatter(parsed.data)) {
    return {
      content: normalizeContent(parsed.content),
      legacyData: parsed.data,
      hasLegacyFrontmatter: true,
    };
  }

  return {
    content: normalizeContent(normalizedRawContent),
    legacyData: {},
    hasLegacyFrontmatter: false,
  };
}

export function extractNoteTitle(content: string, filePath: string): string {
  const firstLineBreak = content.indexOf('\n');
  const firstLine = firstLineBreak >= 0 ? content.slice(0, firstLineBreak) : content;
  const headingMatch = firstLine.match(/^#\s+(.+?)\s*$/);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }

  return path.basename(filePath, '.md');
}
