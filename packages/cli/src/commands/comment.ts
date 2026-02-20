import type { Command } from 'commander';
import { buildAnchorFromRange, getUniqueMatchRange } from '@agentnotes/engine';
import { success, error, formatCommentList } from '../display/format.js';
import { readStdin, confirm } from '../utils/stdin.js';
import { resolveNote } from '../utils/resolve.js';
import { getStore } from '../cli.js';

export function commentCommand(program: Command): void {
  const comment = program
    .command('comment')
    .description('Manage comments on notes');

  comment
    .command('add <note> [comment]')
    .description('Add a comment to a note')
    .option('--author <name>', 'Comment author', '')
    .option('--exact <text>', 'Anchor to unique text match')
    .option('--from <n>', 'Start character offset')
    .option('--to <n>', 'End character offset')
    .action(
      async function (
        this: Command,
        noteArg: string,
        commentArg: string | undefined,
        opts: { author: string; exact?: string; from?: string; to?: string },
      ) {
        const store = getStore(this);
        const note = await resolveNote(store, noteArg);
        if (!note) {
          console.error(error(`Note not found: ${noteArg}`));
          process.exit(1);
          return;
        }

        let commentContent = commentArg;
        if (!commentContent) {
          commentContent = await readStdin();
        }
        if (!commentContent) {
          console.error(error('Comment content required (as argument or stdin)'));
          process.exit(1);
          return;
        }

        let from = 0;
        let to = 0;

        if (opts.exact) {
          if (opts.from !== undefined || opts.to !== undefined) {
            console.error(error('Cannot use --exact with --from/--to'));
            process.exit(1);
            return;
          }
          const match = getUniqueMatchRange(note.content, opts.exact);
          if (!match) {
            console.error(error('Exact text not found or is ambiguous'));
            process.exit(1);
            return;
          }
          from = match.from;
          to = match.to;
        } else if (opts.from !== undefined && opts.to !== undefined) {
          from = parseInt(opts.from, 10);
          to = parseInt(opts.to, 10);
        } else {
          console.error(error('Must specify either --exact or --from and --to'));
          process.exit(1);
          return;
        }

        const anchor = buildAnchorFromRange(note.content, from, to, note.commentRev);

        const result = await store.addComment({
          noteId: note.id,
          content: commentContent,
          author: opts.author,
          anchor,
        });

        if (!result.success) {
          console.error(error(result.error ?? 'Failed to add comment'));
          process.exit(1);
        }

        console.log(success('Comment added'));
      },
    );

  comment
    .command('list <note>')
    .description('List comments on a note')
    .option('--limit <n>', 'Max comments to show')
    .action(async function (this: Command, noteArg: string, opts: { limit?: string }) {
      const store = getStore(this);
      const note = await resolveNote(store, noteArg);
      if (!note) {
        console.error(error(`Note not found: ${noteArg}`));
        process.exit(1);
      }

      let comments = note.comments;
      if (opts.limit) {
        comments = comments.slice(0, parseInt(opts.limit, 10));
      }

      console.log(formatCommentList(comments));
    });

  comment
    .command('delete <note> <comment-id>')
    .description('Delete a comment')
    .option('--force', 'Skip confirmation')
    .action(async function (this: Command, noteArg: string, commentId: string, opts: { force?: boolean }) {
      const store = getStore(this);
      const note = await resolveNote(store, noteArg);
      if (!note) {
        console.error(error(`Note not found: ${noteArg}`));
        process.exit(1);
      }

      const target = note.comments.find(
        (c) => c.id === commentId || c.id.startsWith(commentId),
      );
      if (!target) {
        console.error(error(`Comment not found: ${commentId}`));
        process.exit(1);
      }

      if (!opts.force) {
        const confirmed = await confirm(`Delete comment ${target.id.slice(0, 8)}?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      const result = await store.deleteComment({
        noteId: note.id,
        commentId: target.id,
      });

      if (!result.success) {
        console.error(error(result.error ?? 'Failed to delete comment'));
        process.exit(1);
      }

      console.log(success('Comment deleted'));
    });
}
