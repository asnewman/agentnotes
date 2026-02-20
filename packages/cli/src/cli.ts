import { Command } from 'commander';
import { NoteStore } from '@agentnotes/engine';
import { addCommand } from './commands/add.js';
import { listCommand } from './commands/list.js';
import { showCommand } from './commands/show.js';
import { searchCommand } from './commands/search.js';
import { editCommand } from './commands/edit.js';
import { deleteCommand } from './commands/delete.js';
import { tagsCommand } from './commands/tags.js';
import { catCommand } from './commands/cat.js';
import { commentCommand } from './commands/comment.js';

export function createStore(dir?: string): NoteStore {
  return new NoteStore({ notesDirectory: dir || process.cwd() });
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('agentnotes')
    .description('A local-first knowledge base with CLI interface')
    .version('1.0.0')
    .option('--dir <path>', 'Notes directory (defaults to current directory)');

  // Hook to create store before each command runs
  program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts() as { dir?: string };
    (thisCommand as Command & { store: NoteStore }).store = createStore(opts.dir);
  });

  addCommand(program);
  listCommand(program);
  showCommand(program);
  searchCommand(program);
  editCommand(program);
  deleteCommand(program);
  tagsCommand(program);
  catCommand(program);
  commentCommand(program);

  return program;
}

export function getStore(cmd: Command): NoteStore {
  // Walk up to root command to find the store
  let current: Command | null = cmd;
  while (current) {
    const store = (current as Command & { store?: NoteStore }).store;
    if (store) return store;
    current = current.parent;
  }
  // Fallback — shouldn't happen since preAction sets it
  return createStore();
}
