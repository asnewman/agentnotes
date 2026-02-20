import type { Command } from 'commander';
import { normalizeTags } from '@agentnotes/engine';
import { success, error } from '../display/format.js';
import { readStdin } from '../utils/stdin.js';
import { resolveNote } from '../utils/resolve.js';
import { getStore } from '../cli.js';

export function editCommand(program: Command): void {
  program
    .command('edit <id-or-title>')
    .description('Edit a note')
    .option('--title <title>', 'Set new title')
    .option('--tags <tags>', 'Replace all tags')
    .option('--add-tags <tags>', 'Add tags')
    .option('--remove-tags <tags>', 'Remove tags')
    .option('--content <content>', 'Replace content')
    .option('--append <text>', 'Append text')
    .option('--prepend <text>', 'Prepend text')
    .option('--insert <line:text>', 'Insert text at line')
    .option('--replace-line <line:text>', 'Replace line')
    .option('--delete-line <n>', 'Delete line number')
    .action(async function (this: Command, idOrTitle: string, opts: Record<string, string | undefined>) {
      const store = getStore(this);
      const note = await resolveNote(store, idOrTitle);
      if (!note) {
        console.error(error(`Note not found: ${idOrTitle}`));
        process.exit(1);
      }

      let tagsChanged = false;
      let newTags = [...note.tags];

      if (opts.tags !== undefined) {
        newTags = parseTags(opts.tags);
        tagsChanged = true;
      }
      if (opts.addTags !== undefined) {
        newTags = addTagsToList(newTags, parseTags(opts.addTags));
        tagsChanged = true;
      }
      if (opts.removeTags !== undefined) {
        newTags = removeTagsFromList(newTags, parseTags(opts.removeTags));
        tagsChanged = true;
      }

      if (tagsChanged) {
        const result = await store.updateNoteMetadata({
          noteId: note.id,
          tags: normalizeTags(newTags),
        });
        if (!result.success) {
          console.error(error(result.error ?? 'Failed to update tags'));
          process.exit(1);
        }
        console.log(success('Tags updated'));
      }

      let newContent: string | undefined;

      const stdinContent = await readStdin();
      if (stdinContent) {
        newContent = stdinContent;
      } else if (opts.content !== undefined) {
        newContent = opts.content;
      } else if (opts.append !== undefined) {
        newContent = note.content + '\n' + opts.append;
      } else if (opts.prepend !== undefined) {
        newContent = opts.prepend + '\n' + note.content;
      } else if (opts.insert !== undefined) {
        const { line, text } = parseLineEdit(opts.insert);
        newContent = insertLineInContent(note.content, line, text);
      } else if (opts.replaceLine !== undefined) {
        const { line, text } = parseLineEdit(opts.replaceLine);
        newContent = replaceLineInContent(note.content, line, text);
      } else if (opts.deleteLine !== undefined) {
        const lineNum = parseInt(opts.deleteLine, 10);
        newContent = deleteLineInContent(note.content, lineNum);
      }

      if (opts.title !== undefined) {
        const currentContent = newContent ?? note.content;
        const lines = currentContent.split('\n');
        if (lines[0].match(/^#\s+/)) {
          lines[0] = `# ${opts.title}`;
        } else {
          lines.unshift(`# ${opts.title}`);
        }
        newContent = lines.join('\n');
      }

      if (newContent !== undefined) {
        const result = await store.updateNote({
          noteId: note.id,
          content: newContent,
        });
        if (!result.success) {
          console.error(error(result.error ?? 'Failed to update content'));
          process.exit(1);
        }
        console.log(success('Note updated'));
      }

      if (!tagsChanged && newContent === undefined) {
        console.log('No changes specified.');
      }
    });
}

function parseTags(value: string): string[] {
  return value.split(',').map((t: string) => t.trim()).filter(Boolean);
}

function addTagsToList(existing: string[], toAdd: string[]): string[] {
  const lower = new Set(existing.map((t) => t.toLocaleLowerCase()));
  const result = [...existing];
  for (const tag of toAdd) {
    if (!lower.has(tag.toLocaleLowerCase())) {
      result.push(tag);
      lower.add(tag.toLocaleLowerCase());
    }
  }
  return result;
}

function removeTagsFromList(existing: string[], toRemove: string[]): string[] {
  const lower = new Set(toRemove.map((t) => t.toLocaleLowerCase()));
  return existing.filter((t) => !lower.has(t.toLocaleLowerCase()));
}

function parseLineEdit(value: string): { line: number; text: string } {
  const colonIndex = value.indexOf(':');
  if (colonIndex < 0) {
    throw new Error('Invalid line edit format. Use LINE:TEXT');
  }
  return {
    line: parseInt(value.slice(0, colonIndex), 10),
    text: value.slice(colonIndex + 1),
  };
}

function insertLineInContent(content: string, lineNum: number, text: string): string {
  const lines = content.split('\n');
  const index = Math.max(0, Math.min(lineNum - 1, lines.length));
  lines.splice(index, 0, text);
  return lines.join('\n');
}

function replaceLineInContent(content: string, lineNum: number, text: string): string {
  const lines = content.split('\n');
  const index = lineNum - 1;
  if (index < 0 || index >= lines.length) {
    throw new Error(`Line ${lineNum} out of range (1-${lines.length})`);
  }
  lines[index] = text;
  return lines.join('\n');
}

function deleteLineInContent(content: string, lineNum: number): string {
  const lines = content.split('\n');
  const index = lineNum - 1;
  if (index < 0 || index >= lines.length) {
    throw new Error(`Line ${lineNum} out of range (1-${lines.length})`);
  }
  lines.splice(index, 1);
  return lines.join('\n');
}
