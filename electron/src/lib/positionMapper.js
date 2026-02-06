/**
 * Position mapper - maps TipTap text selection to raw markdown positions
 */

/**
 * Find text in raw markdown content and return character positions
 * @param {string} rawContent - The raw markdown content
 * @param {string} selectedText - The text to find
 * @param {number} approximateStart - Approximate start position (hint from TipTap)
 * @returns {{startChar: number, endChar: number}|null} Character positions or null
 */
export function findTextInContent(rawContent, selectedText, approximateStart = 0) {
  if (!rawContent || !selectedText) {
    return null;
  }

  // Normalize whitespace in both strings for comparison
  const normalizedSelected = selectedText.trim();
  if (!normalizedSelected) {
    return null;
  }

  // Try exact match first, starting from approximate position
  let startIndex = rawContent.indexOf(normalizedSelected, Math.max(0, approximateStart - 50));

  if (startIndex === -1) {
    // Try from the beginning
    startIndex = rawContent.indexOf(normalizedSelected);
  }

  if (startIndex === -1) {
    // Try with normalized whitespace (collapse multiple spaces/newlines)
    const normalizedContent = rawContent.replace(/\s+/g, ' ');
    const normalizedSearch = normalizedSelected.replace(/\s+/g, ' ');

    const normalizedIndex = normalizedContent.indexOf(normalizedSearch);
    if (normalizedIndex !== -1) {
      // Map back to original content position
      startIndex = mapNormalizedToOriginal(rawContent, normalizedContent, normalizedIndex);
    }
  }

  if (startIndex !== -1) {
    return {
      startChar: startIndex,
      endChar: startIndex + normalizedSelected.length
    };
  }

  return null;
}

/**
 * Map a position in normalized content back to original content
 * @param {string} original - Original content
 * @param {string} normalized - Normalized content
 * @param {number} normalizedPos - Position in normalized content
 * @returns {number} Position in original content
 */
function mapNormalizedToOriginal(original, normalized, normalizedPos) {
  let origIndex = 0;
  let normIndex = 0;

  while (normIndex < normalizedPos && origIndex < original.length) {
    const origChar = original[origIndex];
    const normChar = normalized[normIndex];

    if (origChar === normChar) {
      origIndex++;
      normIndex++;
    } else if (/\s/.test(origChar)) {
      // Original has extra whitespace, skip it
      origIndex++;
    } else {
      // Should not happen in properly normalized strings
      origIndex++;
      normIndex++;
    }
  }

  return origIndex;
}

/**
 * Extract plain text from TipTap document positions
 * @param {Object} editor - TipTap editor instance
 * @param {number} from - Start position (TipTap position)
 * @param {number} to - End position (TipTap position)
 * @returns {string} The selected text
 */
export function getTextFromEditor(editor, from, to) {
  if (!editor || from >= to) {
    return '';
  }

  try {
    return editor.state.doc.textBetween(from, to, ' ');
  } catch (e) {
    return '';
  }
}
