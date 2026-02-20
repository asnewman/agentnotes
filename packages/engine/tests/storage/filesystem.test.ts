import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  normalizeDirectoryInput,
  resolveNotesPath,
  getAllMarkdownFiles,
  getAllDirectories,
  generateUniqueFilePath,
  formatRelativePath,
} from '../../src/storage/filesystem.js';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentnotes-fs-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('normalizeDirectoryInput', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeDirectoryInput('')).toBe('');
  });

  it('returns null for dot segments', () => {
    expect(normalizeDirectoryInput('..')).toBeNull();
    expect(normalizeDirectoryInput('.')).toBeNull();
    expect(normalizeDirectoryInput('foo/../bar')).toBeNull();
  });

  it('normalizes path separators', () => {
    expect(normalizeDirectoryInput('foo\\bar/baz')).toBe('foo/bar/baz');
  });

  it('trims segments', () => {
    expect(normalizeDirectoryInput(' foo / bar ')).toBe('foo/bar');
  });
});

describe('resolveNotesPath', () => {
  it('resolves simple relative path', () => {
    const result = resolveNotesPath('/notes', 'sub');
    expect(result).toBe(path.resolve('/notes', 'sub'));
  });

  it('returns null for path traversal', () => {
    expect(resolveNotesPath('/notes', '../escape')).toBeNull();
  });

  it('resolves empty path to notes root', () => {
    const result = resolveNotesPath('/notes', '');
    expect(result).toBe(path.resolve('/notes'));
  });
});

describe('getAllMarkdownFiles', () => {
  it('finds markdown files recursively', () => {
    const subDir = path.join(tempDir, 'sub');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(tempDir, 'root.md'), '# Root');
    fs.writeFileSync(path.join(subDir, 'nested.md'), '# Nested');
    fs.writeFileSync(path.join(tempDir, 'not-md.txt'), 'text');

    const files = getAllMarkdownFiles(tempDir);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.relativePath).sort()).toEqual(['root.md', 'sub/nested.md']);
  });

  it('returns empty for nonexistent directory', () => {
    expect(getAllMarkdownFiles('/does/not/exist')).toEqual([]);
  });
});

describe('getAllDirectories', () => {
  it('finds directories recursively', () => {
    fs.mkdirSync(path.join(tempDir, 'a'));
    fs.mkdirSync(path.join(tempDir, 'a', 'b'));
    fs.mkdirSync(path.join(tempDir, 'c'));

    const dirs = getAllDirectories(tempDir);
    expect(dirs.sort()).toEqual(['a', 'a/b', 'c']);
  });
});

describe('generateUniqueFilePath', () => {
  it('returns base path when no conflict', () => {
    const result = generateUniqueFilePath(tempDir, 'test');
    expect(path.basename(result)).toBe('test.md');
  });

  it('appends suffix on conflict', () => {
    fs.writeFileSync(path.join(tempDir, 'test.md'), '');
    const result = generateUniqueFilePath(tempDir, 'test');
    expect(path.basename(result)).toBe('test-2.md');
  });
});

describe('formatRelativePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(formatRelativePath('foo\\bar\\baz')).toBe('foo/bar/baz');
  });
});
