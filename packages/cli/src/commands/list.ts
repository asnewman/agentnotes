import type { Command } from 'commander';
import { search, type SortField } from '@agentnotes/engine';
import { formatNoteList } from '../display/format.js';
import { getStore } from '../cli.js';

export function listCommand(program: Command): void {
  program
    .command('list')
    .description('List notes')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .option('--limit <n>', 'Max notes to show', '20')
    .option('--sort <field>', 'Sort by: created, updated, title', 'created')
    .action(async function (this: Command, opts: { tags?: string; limit: string; sort: string }) {
      const store = getStore(this);
      const result = await store.listNotes();
      const tags = opts.tags ? opts.tags.split(',').map((t: string) => t.trim()) : undefined;

      const filtered = search(result.notes, {
        tags,
        limit: parseInt(opts.limit, 10),
        sortBy: opts.sort as SortField,
      });

      console.log(formatNoteList(filtered));
    });
}
