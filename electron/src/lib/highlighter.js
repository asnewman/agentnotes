/**
 * Highlighter - utilities for highlighting text in TipTap editor
 */

/**
 * Convert line numbers to character ranges in content
 * @param {string} content - The text content
 * @param {number[]} lines - Array of line numbers (1-indexed)
 * @returns {Array<{from: number, to: number}>} Array of character ranges (0-indexed)
 */
export function linesToCharRanges(content, lines) {
  if (!lines || lines.length === 0) {
    return [];
  }

  const contentLines = content.split('\n');
  const ranges = [];

  // Build line offset map (line number -> start character position)
  const lineOffsets = [0];
  let offset = 0;
  for (let i = 0; i < contentLines.length; i++) {
    offset += contentLines[i].length + 1; // +1 for newline
    lineOffsets.push(offset);
  }

  // Convert each line number to character range
  for (const lineNum of lines) {
    // Lines are 1-indexed in the comment model
    const lineIndex = lineNum - 1;

    if (lineIndex < 0 || lineIndex >= contentLines.length) {
      continue;
    }

    const from = lineOffsets[lineIndex];
    const to = lineOffsets[lineIndex] + contentLines[lineIndex].length;

    if (from < to) {
      ranges.push({ from, to });
    }
  }

  return ranges;
}

/**
 * Get unique commented line numbers from comments array
 * @param {Array} comments - Array of comment objects
 * @returns {number[]} Array of unique line numbers
 */
export function getCommentedLines(comments) {
  if (!comments || comments.length === 0) {
    return [];
  }

  const lines = new Set();
  for (const comment of comments) {
    if (comment.line && comment.line > 0) {
      lines.add(comment.line);
    }
  }

  return Array.from(lines).sort((a, b) => a - b);
}

/**
 * Get character ranges from comments that have startChar/endChar
 * @param {Array} comments - Array of comment objects
 * @returns {Array<{from: number, to: number}>} Array of character ranges
 */
export function getCommentCharRanges(comments) {
  if (!comments || comments.length === 0) {
    return [];
  }

  const ranges = [];
  for (const comment of comments) {
    if (comment.startChar !== undefined && comment.endChar !== undefined && comment.endChar > comment.startChar) {
      ranges.push({
        from: comment.startChar,
        to: comment.endChar
      });
    }
  }

  // Sort by start position
  ranges.sort((a, b) => a.from - b.from);

  return ranges;
}

/**
 * Get all highlight ranges from comments (both line-based and character-based)
 * @param {string} content - The text content
 * @param {Array} comments - Array of comment objects
 * @returns {Array<{from: number, to: number}>} Array of character ranges
 */
export function getAllHighlightRanges(content, comments) {
  if (!comments || comments.length === 0) {
    return [];
  }

  const ranges = [];

  // Get character-based ranges
  const charRanges = getCommentCharRanges(comments);
  ranges.push(...charRanges);

  // Get line-based ranges (convert to character ranges)
  const lines = getCommentedLines(comments);
  const lineRanges = linesToCharRanges(content, lines);
  ranges.push(...lineRanges);

  // Sort by start position and merge overlapping ranges
  ranges.sort((a, b) => a.from - b.from);

  return mergeRanges(ranges);
}

/**
 * Merge overlapping ranges
 * @param {Array<{from: number, to: number}>} ranges - Sorted array of ranges
 * @returns {Array<{from: number, to: number}>} Merged ranges
 */
function mergeRanges(ranges) {
  if (ranges.length === 0) {
    return [];
  }

  const merged = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const current = ranges[i];

    if (current.from <= last.to) {
      // Overlapping or adjacent, merge
      last.to = Math.max(last.to, current.to);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Create highlight extension configuration for TipTap
 * @returns {Object} Highlight extension options
 */
export function getHighlightConfig() {
  return {
    multicolor: false,
    HTMLAttributes: {
      class: 'highlighted-text'
    }
  };
}
