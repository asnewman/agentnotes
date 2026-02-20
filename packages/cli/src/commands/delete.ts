import type { Command } from 'commander';
import { success, error } from '../display/format.js';
import { resolveNote } from '../utils/resolve.js';
import { confirm } from '../utils/stdin.js';
import { getStore } from '../cli.js';

export function deleteCommand(program: Command): void {
  program
    .command('delete <id-or-title>')
    .description('Delete a note')
    .option('--force', 'Skip confirmation')
    .action(async function (this: Command, idOrTitle: string, opts: { force?: boolean }) {
      const store = getStore(this);
      const note = await resolveNote(store, idOrTitle);
      if (!note) {
        console.error(error(`Note not found: ${idOrTitle}`));
        process.exit(1);
      }

      if (!opts.force) {
        const confirmed = await confirm(`Delete "${note.title}"?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      const result = await store.deleteNote({ noteId: note.id });
      if (!result.success) {
        console.error(error(result.error ?? 'Failed to delete note'));
        process.exit(1);
      }

      console.log(success(`Deleted: ${note.title}`));
    });
}
