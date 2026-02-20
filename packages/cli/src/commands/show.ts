import type { Command } from 'commander';
import { formatNoteDetail, formatNoteDetailWithComments, error } from '../display/format.js';
import { resolveNote } from '../utils/resolve.js';
import { getStore } from '../cli.js';

export function showCommand(program: Command): void {
  program
    .command('show <id-or-title>')
    .description('Display a note')
    .option('--comments', 'Show inline comments')
    .action(async function (this: Command, idOrTitle: string, opts: { comments?: boolean }) {
      const store = getStore(this);
      const note = await resolveNote(store, idOrTitle);
      if (!note) {
        console.error(error(`Note not found: ${idOrTitle}`));
        process.exit(1);
      }

      if (opts.comments) {
        console.log(formatNoteDetailWithComments(note));
      } else {
        console.log(formatNoteDetail(note));
      }
    });
}
