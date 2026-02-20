import type { Note, NoteStore } from '@agentnotes/engine';

/**
 * Resolve a note by ID (relativePath) or by title/slug match.
 * Tries exact ID first, then searches by title.
 */
export async function resolveNote(store: NoteStore, idOrTitle: string): Promise<Note | null> {
  // Try direct ID lookup (relativePath ending in .md)
  if (idOrTitle.endsWith('.md')) {
    const note = await store.getNote(idOrTitle);
    if (note) return note;
  }

  // Search through all notes for a match
  const result = await store.listNotes();
  const lower = idOrTitle.toLocaleLowerCase();

  // Try exact title match
  const exactMatch = result.notes.find(
    (n) => n.title.toLocaleLowerCase() === lower,
  );
  if (exactMatch) return exactMatch;

  // Try title contains
  const containsMatch = result.notes.find(
    (n) => n.title.toLocaleLowerCase().includes(lower),
  );
  if (containsMatch) return containsMatch;

  // Try slug contains
  const slugMatch = result.notes.find(
    (n) => n.filename.toLocaleLowerCase().includes(lower),
  );
  if (slugMatch) return slugMatch;

  return null;
}
