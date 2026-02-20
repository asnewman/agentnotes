import type { Command } from 'commander';
import { success, error } from '../display/format.js';
import { readStdin } from '../utils/stdin.js';
import { openEditor } from '../utils/editor.js';
import { getStore } from '../cli.js';

export function addCommand(program: Command): void {
  program
    .command('add <title>')
    .description('Create a new note')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('-d, --directory <dir>', 'Directory to create note in', '')
    .action(async function (this: Command, title: string, opts: { tags?: string; directory: string }) {
      const store = getStore(this);

      let content: string | undefined;

      const stdinContent = await readStdin();
      if (stdinContent) {
        content = stdinContent;
      } else if (process.stdin.isTTY) {
        content = await openEditor(`# ${title}\n\n`);
      }

      const result = await store.createNote({
        title,
        directory: opts.directory,
      });

      if (!result.success) {
        console.error(error(result.error ?? 'Failed to create note'));
        process.exit(1);
      }

      if (content && result.note) {
        const updateResult = await store.updateNote({
          noteId: result.note.id,
          content,
        });
        if (!updateResult.success) {
          console.error(error(updateResult.error ?? 'Failed to update note content'));
        }
      }

      if (opts.tags && result.note) {
        const tags = opts.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        await store.updateNoteMetadata({
          noteId: result.note.id,
          tags,
        });
      }

      console.log(success(`Created note: ${title}`));
      if (result.note) {
        console.log(`  ${result.note.id}`);
      }
    });
}
