import type { Command } from 'commander';
import { error } from '../display/format.js';
import { resolveNote } from '../utils/resolve.js';
import { getStore } from '../cli.js';

export function catCommand(program: Command): void {
  program
    .command('cat <id-or-title>')
    .description('Output raw markdown content')
    .action(async function (this: Command, idOrTitle: string) {
      const store = getStore(this);
      const note = await resolveNote(store, idOrTitle);
      if (!note) {
        console.error(error(`Note not found: ${idOrTitle}`));
        process.exit(1);
      }

      process.stdout.write(note.content + '\n');
    });
}
