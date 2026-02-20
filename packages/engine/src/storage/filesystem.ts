import fs from 'node:fs';
import path from 'node:path';
import type { Note } from '../types.js';
import { normalizeTags } from '../utils/normalization.js';
import { toNumberValue, toStringArray } from '../utils/validation.js';
import { parseMarkdownContent, extractNoteTitle } from './markdown.js';
import {
  getNoteSidecarPath,
  readSidecarData,
  writeSidecarData,
  parseComments,
} from './sidecar.js';

export interface MarkdownFileRecord {
  fullPath: string;
  relativePath: string;
}

export function formatRelativePath(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

export function normalizeDirectoryInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const segments = trimmed
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return '';
  }

  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      return null;
    }
  }

  return segments.join('/');
}

export function resolveNotesPath(notesDir: string, relativePath = ''): string | null {
  const normalized = normalizeDirectoryInput(relativePath);
  if (normalized === null) {
    return null;
  }

  const resolved = path.resolve(notesDir, normalized);
  const relative = path.relative(notesDir, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return resolved;
}

export function getAllMarkdownFiles(dir: string, baseDir = dir): MarkdownFileRecord[] {
  const files: MarkdownFileRecord[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath, baseDir));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = formatRelativePath(path.relative(baseDir, fullPath));
      files.push({ fullPath, relativePath });
    }
  }

  return files;
}

export function getAllDirectories(dir: string, baseDir = dir): string[] {
  const directories: string[] = [];

  if (!fs.existsSync(dir)) {
    return directories;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    directories.push(formatRelativePath(path.relative(baseDir, fullPath)));
    directories.push(...getAllDirectories(fullPath, baseDir));
  }

  return directories;
}

export function generateUniqueFilePath(targetDir: string, baseName: string): string {
  const extension = '.md';
  const normalizedBaseName = baseName.trim() || 'note';
  let candidateName = `${normalizedBaseName}${extension}`;
  let candidatePath = path.join(targetDir, candidateName);
  let suffix = 2;

  while (fs.existsSync(candidatePath) || fs.existsSync(getNoteSidecarPath(candidatePath))) {
    candidateName = `${normalizedBaseName}-${suffix}${extension}`;
    candidatePath = path.join(targetDir, candidateName);
    suffix += 1;
  }

  return candidatePath;
}

export function cleanupEmptyParentDirectories(startDir: string, stopDir: string): void {
  let current = startDir;
  const resolvedStop = path.resolve(stopDir);

  while (path.resolve(current) !== resolvedStop) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(current);
    } catch {
      return;
    }

    if (entries.length > 0) {
      return;
    }

    try {
      fs.rmdirSync(current);
    } catch {
      return;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return;
    }

    current = parent;
  }
}

export function findNoteRecordById(
  notesDir: string,
  noteId: string,
): MarkdownFileRecord | null {
  const normalizedId = noteId.trim();
  if (path.extname(normalizedId).toLowerCase() !== '.md') {
    return null;
  }

  const fullPath = resolveNotesPath(notesDir, normalizedId);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return null;
  }

  try {
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    fullPath,
    relativePath: formatRelativePath(path.relative(notesDir, fullPath)),
  };
}

export function compareNotes(a: Note, b: Note): number {
  const pathDiff = a.relativePath.localeCompare(b.relativePath);
  if (pathDiff !== 0) {
    return pathDiff;
  }

  const titleDiff = a.title.localeCompare(b.title);
  if (titleDiff !== 0) {
    return titleDiff;
  }

  return a.id.localeCompare(b.id);
}

export function parseNoteFile(filePath: string, relativePath = ''): Note | null {
  try {
    const { content, legacyData, hasLegacyFrontmatter } = parseMarkdownContent(filePath);
    const sidecarPath = getNoteSidecarPath(filePath);
    const sidecarData = readSidecarData(filePath);
    const normalizedRelativePath = formatRelativePath(
      relativePath || path.basename(filePath),
    );
    const directory = normalizedRelativePath
      ? formatRelativePath(path.dirname(normalizedRelativePath))
      : '';
    const tags = normalizeTags(toStringArray(sidecarData.tags ?? legacyData.tags));
    const declaredRev = Math.max(
      0,
      toNumberValue(sidecarData.comment_rev ?? legacyData.comment_rev, 0),
    );
    const defaultRev = declaredRev > 0 ? declaredRev : 0;
    const comments = parseComments(
      sidecarData.comments ?? legacyData.comments,
      content,
      defaultRev,
    );
    const commentRev = comments.length > 0 ? Math.max(1, declaredRev) : declaredRev;
    const normalizedComments = comments.map((comment) => ({
      ...comment,
      anchor: {
        ...comment.anchor,
        rev: comment.anchor.rev > 0 ? comment.anchor.rev : commentRev,
      },
    }));

    if (!fs.existsSync(sidecarPath) || hasLegacyFrontmatter) {
      try {
        writeSidecarData(filePath, tags, normalizedComments, commentRev);
      } catch (error) {
        console.error(`Error writing note metadata sidecar ${sidecarPath}:`, error);
      }
    }

    if (hasLegacyFrontmatter) {
      try {
        fs.writeFileSync(filePath, content, 'utf-8');
      } catch (error) {
        console.error(`Error rewriting legacy note ${filePath}:`, error);
      }
    }

    return {
      id: normalizedRelativePath,
      title: extractNoteTitle(content, filePath),
      tags,
      commentRev,
      comments: normalizedComments,
      content,
      filename: path.basename(filePath),
      relativePath: normalizedRelativePath,
      directory: directory === '.' ? '' : directory,
    };
  } catch (error) {
    console.error(`Error parsing note file ${filePath}:`, error);
    return null;
  }
}
