import type { Command } from 'commander';
import { getSortedTags } from '@agentnotes/engine';
import { formatTags } from '../display/format.js';
import { getStore } from '../cli.js';

export function tagsCommand(program: Command): void {
  program
    .command('tags')
    .description('List all tags with counts')
    .action(async function (this: Command) {
      const store = getStore(this);
      const result = await store.listNotes();
      const sorted = getSortedTags(result.notes);
      console.log(formatTags(sorted));
    });
}
