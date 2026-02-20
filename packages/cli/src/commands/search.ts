import type { Command } from 'commander';
import { search } from '@agentnotes/engine';
import { formatNoteList } from '../display/format.js';
import { getStore } from '../cli.js';

export function searchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search notes')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .option('--limit <n>', 'Max results', '10')
    .action(async function (this: Command, query: string, opts: { tags?: string; limit: string }) {
      const store = getStore(this);
      const result = await store.listNotes();
      const tags = opts.tags ? opts.tags.split(',').map((t: string) => t.trim()) : undefined;

      const filtered = search(result.notes, {
        query,
        tags,
        limit: parseInt(opts.limit, 10),
      });

      console.log(formatNoteList(filtered));
    });
}
