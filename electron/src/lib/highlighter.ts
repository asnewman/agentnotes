import type { NoteComment } from '../types';

export interface CharRange {
  from: number;
  to: number;
}

export function linesToCharRanges(content: string, lines: number[]): CharRange[] {
  if (!lines || lines.length === 0) {
    return [];
  }

  const contentLines = content.split('\n');
  const ranges: CharRange[] = [];

  const lineOffsets = [0];
  let offset = 0;

  for (const line of contentLines) {
    offset += line.length + 1;
    lineOffsets.push(offset);
  }

  for (const lineNum of lines) {
    const lineIndex = lineNum - 1;

    if (lineIndex < 0 || lineIndex >= contentLines.length) {
      continue;
    }

    const from = lineOffsets[lineIndex] ?? 0;
    const to = from + contentLines[lineIndex].length;

    if (from < to) {
      ranges.push({ from, to });
    }
  }

  return ranges;
}

export function getCommentedLines(comments: NoteComment[]): number[] {
  if (!comments || comments.length === 0) {
    return [];
  }

  const lines = new Set<number>();

  for (const comment of comments) {
    if (comment.line > 0) {
      lines.add(comment.line);
    }
  }

  return Array.from(lines).sort((a, b) => a - b);
}

export function getCommentCharRanges(comments: NoteComment[]): CharRange[] {
  if (!comments || comments.length === 0) {
    return [];
  }

  const ranges: CharRange[] = [];

  for (const comment of comments) {
    if (comment.endChar > comment.startChar) {
      ranges.push({
        from: comment.startChar,
        to: comment.endChar,
      });
    }
  }

  ranges.sort((a, b) => a.from - b.from);
  return ranges;
}

export function getAllHighlightRanges(content: string, comments: NoteComment[]): CharRange[] {
  if (!comments || comments.length === 0) {
    return [];
  }

  const ranges: CharRange[] = [];
  ranges.push(...getCommentCharRanges(comments));
  ranges.push(...linesToCharRanges(content, getCommentedLines(comments)));

  ranges.sort((a, b) => a.from - b.from);
  return mergeRanges(ranges);
}

function mergeRanges(ranges: CharRange[]): CharRange[] {
  if (ranges.length === 0) {
    return [];
  }

  const merged: CharRange[] = [{ ...ranges[0] }];

  for (let index = 1; index < ranges.length; index += 1) {
    const current = ranges[index];
    const last = merged[merged.length - 1];

    if (current.from <= last.to) {
      last.to = Math.max(last.to, current.to);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

export function getHighlightConfig(): { multicolor: boolean; HTMLAttributes: { class: string } } {
  return {
    multicolor: false,
    HTMLAttributes: {
      class: 'highlighted-text',
    },
  };
}
