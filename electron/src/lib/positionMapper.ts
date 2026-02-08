import type { Editor } from '@tiptap/core';

export interface TextPosition {
  startChar: number;
  endChar: number;
}

export function findTextInContent(
  rawContent: string,
  selectedText: string,
  approximateStart = 0,
): TextPosition | null {
  if (!rawContent || !selectedText) {
    return null;
  }

  const normalizedSelected = selectedText.trim();
  if (!normalizedSelected) {
    return null;
  }

  let startIndex = rawContent.indexOf(normalizedSelected, Math.max(0, approximateStart - 50));

  if (startIndex === -1) {
    startIndex = rawContent.indexOf(normalizedSelected);
  }

  if (startIndex === -1) {
    const normalizedContent = rawContent.replace(/\s+/g, ' ');
    const normalizedSearch = normalizedSelected.replace(/\s+/g, ' ');
    const normalizedIndex = normalizedContent.indexOf(normalizedSearch);

    if (normalizedIndex !== -1) {
      startIndex = mapNormalizedToOriginal(rawContent, normalizedContent, normalizedIndex);
    }
  }

  if (startIndex === -1) {
    return null;
  }

  return {
    startChar: startIndex,
    endChar: startIndex + normalizedSelected.length,
  };
}

function mapNormalizedToOriginal(original: string, normalized: string, normalizedPos: number): number {
  let originalIndex = 0;
  let normalizedIndex = 0;

  while (normalizedIndex < normalizedPos && originalIndex < original.length) {
    const originalChar = original[originalIndex];
    const normalizedChar = normalized[normalizedIndex];

    if (originalChar === normalizedChar) {
      originalIndex += 1;
      normalizedIndex += 1;
      continue;
    }

    if (/\s/.test(originalChar)) {
      originalIndex += 1;
      continue;
    }

    originalIndex += 1;
    normalizedIndex += 1;
  }

  return originalIndex;
}

export function getTextFromEditor(editor: Editor | null, from: number, to: number): string {
  if (!editor || from >= to) {
    return '';
  }

  try {
    return editor.state.doc.textBetween(from, to, ' ');
  } catch {
    return '';
  }
}
