import type { Note, NoteComment, TagCount } from '@agentnotes/engine';

const Reset = '\x1b[0m';
const Bold = '\x1b[1m';
const Dim = '\x1b[2m';
const Cyan = '\x1b[36m';
const Green = '\x1b[32m';
const Yellow = '\x1b[33m';
const Red = '\x1b[31m';
const Magenta = '\x1b[35m';
const BoldCyan = `${Bold}${Cyan}`;
const BoldGreen = `${Bold}${Green}`;
const BoldYellow = `${Bold}${Yellow}`;
const BoldRed = `${Bold}${Red}`;

export function success(msg: string): string {
  return `${BoldGreen}\u2713${Reset} ${msg}`;
}

export function error(msg: string): string {
  return `${BoldRed}\u2717${Reset} ${msg}`;
}

export function info(msg: string): string {
  return `${Cyan}\u2139${Reset} ${msg}`;
}

export function formatNoteList(notes: Note[]): string {
  if (notes.length === 0) {
    return 'No notes found.';
  }

  const lines: string[] = [];
  for (const note of notes) {
    const idShort = note.id.slice(0, 30);
    const tags = note.tags.length > 0
      ? ` ${Green}${note.tags.map((t) => `#${t}`).join(' ')}${Reset}`
      : '';
    lines.push(`${BoldCyan}${note.title}${Reset} ${Dim}[${idShort}]${Reset}${tags}`);
  }

  return lines.join('\n');
}

export function formatNoteDetail(note: Note): string {
  const lines: string[] = [];
  const sep = `${Bold}${'─'.repeat(50)}${Reset}`;

  lines.push(sep);
  lines.push(`${BoldCyan}${note.title}${Reset}`);
  lines.push(`${Dim}ID:${Reset}       ${note.id}`);
  if (note.tags.length > 0) {
    lines.push(`${Dim}Tags:${Reset}     ${Green}${note.tags.map((t) => `#${t}`).join(' ')}${Reset}`);
  }
  if (note.comments.length > 0) {
    lines.push(`${Dim}Comments:${Reset} ${note.comments.length}`);
  }
  lines.push(sep);
  lines.push(note.content);

  return lines.join('\n');
}

export function formatNoteDetailWithComments(note: Note): string {
  const detail = formatNoteDetail(note);
  if (note.comments.length === 0) {
    return detail;
  }

  const commentLines: string[] = [];
  commentLines.push('');
  commentLines.push(`${Bold}Comments:${Reset}`);
  for (const comment of note.comments) {
    const author = comment.author || 'anonymous';
    const quotePreview = comment.anchor.quote
      ? comment.anchor.quote.slice(0, 60)
      : '';
    commentLines.push(
      `  ${Yellow}\u2022${Reset} ${Magenta}${author}${Reset}: ${comment.content}`,
    );
    if (quotePreview) {
      commentLines.push(`    ${Dim}"${quotePreview}"${Reset}`);
    }
    commentLines.push(
      `    ${Dim}[${comment.id.slice(0, 8)}] ${comment.status} [${comment.anchor.from}:${comment.anchor.to}]${Reset}`,
    );
  }

  return detail + commentLines.join('\n');
}

export function formatCommentList(comments: NoteComment[]): string {
  if (comments.length === 0) {
    return 'No comments.';
  }

  const lines: string[] = [];
  for (const comment of comments) {
    const author = comment.author || 'anonymous';
    const quotePreview = comment.anchor.quote
      ? comment.anchor.quote.slice(0, 60)
      : '';
    lines.push(
      `${BoldYellow}${comment.id.slice(0, 8)}${Reset} ${Magenta}${author}${Reset}`,
    );
    lines.push(`  ${comment.content}`);
    lines.push(
      `  ${Dim}${comment.status} [${comment.anchor.from}:${comment.anchor.to}] rev=${comment.anchor.rev}${Reset}`,
    );
    if (quotePreview) {
      lines.push(`  ${Dim}"${quotePreview}"${Reset}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatTags(tags: TagCount[]): string {
  if (tags.length === 0) {
    return 'No tags found.';
  }

  return tags
    .map((tc) => `${Green}#${tc.tag}${Reset} ${Dim}(${tc.count})${Reset}`)
    .join('\n');
}
