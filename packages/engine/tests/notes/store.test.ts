import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { NoteStore } from '../../src/notes/store.js';

let tempDir: string;
let store: NoteStore;

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentnotes-test-'));
}

beforeEach(() => {
  tempDir = createTempDir();
  fs.mkdirSync(tempDir, { recursive: true });
  store = new NoteStore({ notesDirectory: tempDir });
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('NoteStore', () => {
  describe('createNote', () => {
    it('creates a note with title and content', async () => {
      const result = await store.createNote({ title: 'My Test Note', directory: '' });
      expect(result.success).toBe(true);
      expect(result.note).toBeDefined();
      expect(result.note!.title).toBe('My Test Note');
      expect(result.note!.content).toContain('# My Test Note');
    });

    it('creates sidecar json file', async () => {
      const result = await store.createNote({ title: 'Sidecar Test', directory: '' });
      expect(result.success).toBe(true);
      const mdPath = path.join(tempDir, result.note!.filename);
      const jsonPath = mdPath.replace(/\.md$/, '.json');
      expect(fs.existsSync(jsonPath)).toBe(true);
    });

    it('rejects empty title', async () => {
      const result = await store.createNote({ title: '', directory: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Title cannot be empty');
    });

    it('creates note in subdirectory', async () => {
      const result = await store.createNote({ title: 'Sub Note', directory: 'projects' });
      expect(result.success).toBe(true);
      expect(result.note!.directory).toBe('projects');
    });

    it('rejects path traversal in directory', async () => {
      const result = await store.createNote({ title: 'Evil', directory: '../escape' });
      expect(result.success).toBe(false);
    });
  });

  describe('listNotes', () => {
    it('returns empty list for empty directory', async () => {
      const result = await store.listNotes();
      expect(result.notes).toEqual([]);
      expect(result.directories).toEqual([]);
    });

    it('lists created notes', async () => {
      await store.createNote({ title: 'Note One', directory: '' });
      await store.createNote({ title: 'Note Two', directory: '' });
      const result = await store.listNotes();
      expect(result.notes).toHaveLength(2);
    });

    it('lists directories', async () => {
      await store.createNote({ title: 'Sub Note', directory: 'projects' });
      const result = await store.listNotes();
      expect(result.directories).toContain('projects');
    });
  });

  describe('getNote', () => {
    it('retrieves a note by id (relativePath)', async () => {
      const created = await store.createNote({ title: 'Find Me', directory: '' });
      const note = await store.getNote(created.note!.id);
      expect(note).not.toBeNull();
      expect(note!.title).toBe('Find Me');
    });

    it('returns null for nonexistent note', async () => {
      const note = await store.getNote('nonexistent.md');
      expect(note).toBeNull();
    });
  });

  describe('updateNote', () => {
    it('updates note content', async () => {
      const created = await store.createNote({ title: 'Update Me', directory: '' });
      const result = await store.updateNote({
        noteId: created.note!.id,
        content: '# Update Me\n\nNew content here',
      });
      expect(result.success).toBe(true);
      expect(result.note!.content).toContain('New content here');
    });

    it('remaps comments when content changes', async () => {
      const created = await store.createNote({ title: 'Comment Test', directory: '' });
      const noteId = created.note!.id;

      // Add a comment on "Comment Test"
      const addResult = await store.addComment({
        noteId,
        content: 'my comment',
        author: 'test',
        anchor: { from: 2, to: 14, rev: 0, startAffinity: 'after', endAffinity: 'before' },
      });
      expect(addResult.success).toBe(true);

      // Update content to shift the comment
      const result = await store.updateNote({
        noteId,
        content: 'XX# Comment Test\n\n',
      });
      expect(result.success).toBe(true);
      expect(result.note!.comments[0].anchor.from).toBe(4);
    });
  });

  describe('updateNoteMetadata', () => {
    it('updates tags', async () => {
      const created = await store.createNote({ title: 'Tag Me', directory: '' });
      const result = await store.updateNoteMetadata({
        noteId: created.note!.id,
        tags: ['important', 'test'],
      });
      expect(result.success).toBe(true);
      expect(result.note!.tags).toEqual(['important', 'test']);
    });
  });

  describe('deleteNote', () => {
    it('deletes a note and its sidecar', async () => {
      const created = await store.createNote({ title: 'Delete Me', directory: '' });
      const noteId = created.note!.id;
      const result = await store.deleteNote({ noteId });
      expect(result.success).toBe(true);

      const note = await store.getNote(noteId);
      expect(note).toBeNull();
    });

    it('returns error for nonexistent note', async () => {
      const result = await store.deleteNote({ noteId: 'nope.md' });
      expect(result.success).toBe(false);
    });
  });

  describe('moveNote', () => {
    it('moves a note to a new directory', async () => {
      const created = await store.createNote({ title: 'Move Me', directory: '' });
      const result = await store.moveNote({
        noteId: created.note!.id,
        directory: 'archive',
      });
      expect(result.success).toBe(true);
      expect(result.note!.directory).toBe('archive');
    });
  });

  describe('addComment', () => {
    it('adds a comment to a note', async () => {
      const created = await store.createNote({ title: 'Comment Here', directory: '' });
      const result = await store.addComment({
        noteId: created.note!.id,
        content: 'Nice section!',
        author: 'tester',
        anchor: { from: 2, to: 14, rev: 0, startAffinity: 'after', endAffinity: 'before' },
      });
      expect(result.success).toBe(true);
      expect(result.note!.comments).toHaveLength(1);
      expect(result.note!.comments[0].content).toBe('Nice section!');
    });

    it('rejects anchor revision mismatch', async () => {
      const created = await store.createNote({ title: 'Rev Mismatch', directory: '' });
      const result = await store.addComment({
        noteId: created.note!.id,
        content: 'comment',
        author: 'test',
        anchor: { from: 0, to: 5, rev: 99 },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('revision mismatch');
    });
  });

  describe('deleteComment', () => {
    it('deletes a comment by ID', async () => {
      const created = await store.createNote({ title: 'Del Comment', directory: '' });
      const addResult = await store.addComment({
        noteId: created.note!.id,
        content: 'remove me',
        author: 'test',
        anchor: { from: 2, to: 13, rev: 0 },
      });
      const commentId = addResult.note!.comments[0].id;

      const result = await store.deleteComment({
        noteId: created.note!.id,
        commentId,
      });
      expect(result.success).toBe(true);
      expect(result.note!.comments).toHaveLength(0);
    });
  });

  describe('createDirectory', () => {
    it('creates a directory', async () => {
      const result = await store.createDirectory({ path: 'new-folder' });
      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'new-folder'))).toBe(true);
    });
  });

  describe('deleteDirectory', () => {
    it('deletes a directory', async () => {
      await store.createDirectory({ path: 'to-delete' });
      const result = await store.deleteDirectory({ path: 'to-delete' });
      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'to-delete'))).toBe(false);
    });
  });
});
