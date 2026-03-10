import { describe, it, expect, vi } from 'vitest';
import { Engine, parseMarkdown, EditorState } from './engine.js';
import type { Node, TextNode, ImageNode } from './types.js';

function textNode(value: string, marks?: TextNode['marks'], size?: string): TextNode {
  const node: TextNode = { type: 'text', value };
  if (marks && marks.length > 0) node.marks = marks;
  if (size) node.size = size;
  return node;
}

function imageNode(src: string): ImageNode {
  return { type: 'image', src };
}

// ─── Markdown Parser ───

describe('parseMarkdown', () => {
  it('returns empty array for empty string', () => {
    expect(parseMarkdown('')).toEqual([]);
  });

  it('parses plain text with no markdown', () => {
    expect(parseMarkdown('hello world')).toEqual([
      textNode('hello world'),
    ]);
  });

  it('parses # Heading as size 32px', () => {
    const nodes = parseMarkdown('# Hello');
    expect(nodes).toEqual([textNode('# Hello', undefined, '32px')]);
  });

  it('parses ## through ###### with correct sizes', () => {
    const sizes: Record<number, string> = { 2: '24px', 3: '20px', 4: '18px', 5: '16px', 6: '14px' };
    for (const [level, size] of Object.entries(sizes)) {
      const prefix = '#'.repeat(Number(level));
      const nodes = parseMarkdown(`${prefix} Title`);
      expect(nodes).toEqual([textNode(`${prefix} Title`, undefined, size)]);
    }
  });

  it('parses **bold**', () => {
    const nodes = parseMarkdown('**bold**');
    expect(nodes).toEqual([textNode('**bold**', ['bold'])]);
  });

  it('parses __bold__', () => {
    const nodes = parseMarkdown('__bold__');
    expect(nodes).toEqual([textNode('__bold__', ['bold'])]);
  });

  it('parses *italic*', () => {
    const nodes = parseMarkdown('*italic*');
    expect(nodes).toEqual([textNode('*italic*', ['italic'])]);
  });

  it('parses _italic_', () => {
    const nodes = parseMarkdown('_italic_');
    expect(nodes).toEqual([textNode('_italic_', ['italic'])]);
  });

  it('parses **bold** and *italic* on same line', () => {
    const nodes = parseMarkdown('**bold** and *italic*');
    expect(nodes).toEqual([
      textNode('**bold**', ['bold']),
      textNode(' and '),
      textNode('*italic*', ['italic']),
    ]);
  });

  it('parses nested bold and italic when separated: **bold** *and italic*', () => {
    const nodes = parseMarkdown('**bold** *and italic*');
    const hasBold = nodes.some(
      n => n.type === 'text' && (n as TextNode).marks?.includes('bold')
    );
    const hasItalic = nodes.some(
      n => n.type === 'text' && (n as TextNode).marks?.includes('italic')
    );
    expect(hasBold).toBe(true);
    expect(hasItalic).toBe(true);
  });

  it('parses ![alt](url) on own line as ImageNode', () => {
    const nodes = parseMarkdown('![photo](https://example.com/img.png)');
    expect(nodes).toEqual([imageNode('https://example.com/img.png')]);
  });

  it('does not parse inline ![alt](url) as ImageNode', () => {
    const nodes = parseMarkdown('text ![alt](url) more');
    // Should be text nodes, not an image
    expect(nodes.every(n => n.type === 'text')).toBe(true);
  });

  it('parses mixed content across multiple lines', () => {
    const text = '# Title\nsome text\n![](img.png)\n**bold**';
    const nodes = parseMarkdown(text);
    // Should contain heading, plain text, image, and bold
    const types = nodes.map(n => n.type);
    expect(types).toContain('text');
    expect(types).toContain('image');
    // Heading node
    const heading = nodes.find(n => n.type === 'text' && (n as TextNode).size === '32px');
    expect(heading).toBeDefined();
    // Bold node
    const bold = nodes.find(n => n.type === 'text' && (n as TextNode).marks?.includes('bold'));
    expect(bold).toBeDefined();
  });

  it('parses text with no markdown syntax as single TextNode', () => {
    const nodes = parseMarkdown('just plain text here');
    expect(nodes).toEqual([textNode('just plain text here')]);
  });

  it('handles heading with bold inside', () => {
    const nodes = parseMarkdown('# **Bold Title**');
    // Should have fontSize and bold
    const node = nodes.find(
      n => n.type === 'text' && (n as TextNode).marks?.includes('bold') && (n as TextNode).size
    );
    expect(node).toBeDefined();
  });

  it('merges adjacent TextNodes with identical marks (e.g. **a****b**)', () => {
    const nodes = parseMarkdown('**a****b**');
    // Two adjacent bold regions should merge into one TextNode
    const boldNodes = nodes.filter(
      n => n.type === 'text' && (n as TextNode).marks?.includes('bold')
    );
    expect(boldNodes.length).toBe(1);
    expect((boldNodes[0] as TextNode).value).toBe('**a****b**');
  });

  it('merges adjacent bold TextNodes with size in a heading', () => {
    // # **a****b** — heading + two adjacent bold regions
    const nodes = parseMarkdown('# **a****b**');
    const boldWithSize = nodes.filter(
      n => n.type === 'text' && (n as TextNode).marks?.includes('bold') && (n as TextNode).size
    );
    // Should merge into one bold+sized node
    expect(boldWithSize.length).toBe(1);
    expect((boldWithSize[0] as TextNode).size).toBe('32px');
  });

  it('parses image preceded by only a newline', () => {
    const nodes = parseMarkdown('\n![](img.png)');
    // Should have a newline TextNode and an ImageNode
    const hasImage = nodes.some(n => n.type === 'image');
    expect(hasImage).toBe(true);
  });

  it('parses image with empty alt as ImageNode with src', () => {
    const nodes = parseMarkdown('![](test.png)');
    expect(nodes).toEqual([imageNode('test.png')]);
  });
});

// ─── Engine: INSERT_TEXT ───

describe('Engine INSERT_TEXT', () => {
  it('inserts into empty document', () => {
    const engine = new Engine();
    const state = engine.dispatch({ type: 'INSERT_TEXT', text: 'hello' });
    expect(engine.getText()).toBe('hello');
    expect(state.cursorPos).toBe(5);
  });

  it('inserts at beginning', () => {
    const engine = new Engine({ text: 'world', cursorPos: 0 });
    engine.dispatch({ type: 'INSERT_TEXT', text: 'hello ' });
    expect(engine.getText()).toBe('hello world');
    expect(engine.getState().cursorPos).toBe(6);
  });

  it('inserts at middle', () => {
    const engine = new Engine({ text: 'helo', cursorPos: 2 });
    engine.dispatch({ type: 'INSERT_TEXT', text: 'l' });
    expect(engine.getText()).toBe('hello');
    expect(engine.getState().cursorPos).toBe(3);
  });

  it('inserts at end', () => {
    const engine = new Engine({ text: 'hello', cursorPos: 5 });
    engine.dispatch({ type: 'INSERT_TEXT', text: '!' });
    expect(engine.getText()).toBe('hello!');
    expect(engine.getState().cursorPos).toBe(6);
  });

  it('inserts newline character', () => {
    const engine = new Engine({ text: 'ab', cursorPos: 1 });
    engine.dispatch({ type: 'INSERT_TEXT', text: '\n' });
    expect(engine.getText()).toBe('a\nb');
    expect(engine.getState().cursorPos).toBe(2);
  });

  it('advances cursor by inserted text length', () => {
    const engine = new Engine({ text: '', cursorPos: 0 });
    engine.dispatch({ type: 'INSERT_TEXT', text: 'abc' });
    expect(engine.getState().cursorPos).toBe(3);
  });

  it('calls onSave with updated raw text', () => {
    const onSave = vi.fn();
    const engine = new Engine({ onSave });
    engine.dispatch({ type: 'INSERT_TEXT', text: 'hi' });
    expect(onSave).toHaveBeenCalledWith('hi');
  });

  it('calls onChange with new EditorState', () => {
    const onChange = vi.fn();
    const engine = new Engine({ onChange });
    engine.dispatch({ type: 'INSERT_TEXT', text: 'hi' });
    expect(onChange).toHaveBeenCalledTimes(1);
    const state: EditorState = onChange.mock.calls[0][0];
    expect(state.cursorPos).toBe(2);
    expect(state.content.length).toBeGreaterThan(0);
  });
});

// ─── Engine: DELETE_BACKWARD ───

describe('Engine DELETE_BACKWARD', () => {
  it('deletes from middle of text', () => {
    const engine = new Engine({ text: 'hello', cursorPos: 3 });
    engine.dispatch({ type: 'DELETE_BACKWARD' });
    expect(engine.getText()).toBe('helo');
    expect(engine.getState().cursorPos).toBe(2);
  });

  it('no-op at position 0', () => {
    const onSave = vi.fn();
    const engine = new Engine({ text: 'hello', cursorPos: 0, onSave });
    engine.dispatch({ type: 'DELETE_BACKWARD' });
    expect(engine.getText()).toBe('hello');
    expect(engine.getState().cursorPos).toBe(0);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('deleting markdown syntax char breaks formatting', () => {
    const engine = new Engine({ text: '**bold**', cursorPos: 2 });
    // Delete one * — breaks the bold syntax
    engine.dispatch({ type: 'DELETE_BACKWARD' });
    expect(engine.getText()).toBe('*bold**');
    // Should no longer parse as bold
    const state = engine.getState();
    const hasBold = state.content.some(
      n => n.type === 'text' && (n as TextNode).marks?.includes('bold')
    );
    expect(hasBold).toBe(false);
  });

  it('decrements cursor by 1', () => {
    const engine = new Engine({ text: 'abc', cursorPos: 2 });
    engine.dispatch({ type: 'DELETE_BACKWARD' });
    expect(engine.getState().cursorPos).toBe(1);
  });

  it('calls onSave when text changes', () => {
    const onSave = vi.fn();
    const engine = new Engine({ text: 'ab', cursorPos: 1, onSave });
    engine.dispatch({ type: 'DELETE_BACKWARD' });
    expect(onSave).toHaveBeenCalledWith('b');
  });
});

// ─── Engine: Cursor Movement ───

describe('Engine cursor movement', () => {
  it('MOVE_CURSOR_LEFT at 0 stays at 0', () => {
    const engine = new Engine({ text: 'abc', cursorPos: 0 });
    engine.dispatch({ type: 'MOVE_CURSOR_LEFT' });
    expect(engine.getState().cursorPos).toBe(0);
  });

  it('MOVE_CURSOR_LEFT decrements by 1', () => {
    const engine = new Engine({ text: 'abc', cursorPos: 2 });
    engine.dispatch({ type: 'MOVE_CURSOR_LEFT' });
    expect(engine.getState().cursorPos).toBe(1);
  });

  it('MOVE_CURSOR_RIGHT at end stays at end', () => {
    const engine = new Engine({ text: 'abc', cursorPos: 3 });
    engine.dispatch({ type: 'MOVE_CURSOR_RIGHT' });
    expect(engine.getState().cursorPos).toBe(3);
  });

  it('MOVE_CURSOR_RIGHT increments by 1', () => {
    const engine = new Engine({ text: 'abc', cursorPos: 1 });
    engine.dispatch({ type: 'MOVE_CURSOR_RIGHT' });
    expect(engine.getState().cursorPos).toBe(2);
  });

  it('MOVE_CURSOR to specific position (clamped)', () => {
    const engine = new Engine({ text: 'abc', cursorPos: 0 });
    engine.dispatch({ type: 'MOVE_CURSOR', position: 2 });
    expect(engine.getState().cursorPos).toBe(2);
    // Clamp above
    engine.dispatch({ type: 'MOVE_CURSOR', position: 100 });
    expect(engine.getState().cursorPos).toBe(3);
    // Clamp below
    engine.dispatch({ type: 'MOVE_CURSOR', position: -5 });
    expect(engine.getState().cursorPos).toBe(0);
  });

  it('MOVE_CURSOR_TO_START moves to 0', () => {
    const engine = new Engine({ text: 'abc', cursorPos: 2 });
    engine.dispatch({ type: 'MOVE_CURSOR_TO_START' });
    expect(engine.getState().cursorPos).toBe(0);
  });

  it('MOVE_CURSOR_TO_END moves to text length', () => {
    const engine = new Engine({ text: 'abc', cursorPos: 0 });
    engine.dispatch({ type: 'MOVE_CURSOR_TO_END' });
    expect(engine.getState().cursorPos).toBe(3);
  });

  it('cursor-only changes call onChange but NOT onSave', () => {
    const onSave = vi.fn();
    const onChange = vi.fn();
    const engine = new Engine({ text: 'abc', cursorPos: 0, onSave, onChange });
    engine.dispatch({ type: 'MOVE_CURSOR_RIGHT' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  // ─── Up / Down ───

  it('MOVE_CURSOR_UP moves to same column on previous line', () => {
    const engine = new Engine({ text: 'hello\nworld', cursorPos: 8 }); // "wor|ld"
    engine.dispatch({ type: 'MOVE_CURSOR_UP' });
    expect(engine.getState().cursorPos).toBe(2); // "he|llo"
  });

  it('MOVE_CURSOR_UP clamps to shorter previous line', () => {
    const engine = new Engine({ text: 'ab\nhello', cursorPos: 7 }); // "hell|o"
    engine.dispatch({ type: 'MOVE_CURSOR_UP' });
    expect(engine.getState().cursorPos).toBe(2); // "ab|" (clamped to line length)
  });

  it('MOVE_CURSOR_UP on first line is a no-op', () => {
    const engine = new Engine({ text: 'hello\nworld', cursorPos: 3 });
    engine.dispatch({ type: 'MOVE_CURSOR_UP' });
    expect(engine.getState().cursorPos).toBe(3);
  });

  it('MOVE_CURSOR_DOWN moves to same column on next line', () => {
    const engine = new Engine({ text: 'hello\nworld', cursorPos: 2 }); // "he|llo"
    engine.dispatch({ type: 'MOVE_CURSOR_DOWN' });
    expect(engine.getState().cursorPos).toBe(8); // "wo|rld"
  });

  it('MOVE_CURSOR_DOWN clamps to shorter next line', () => {
    const engine = new Engine({ text: 'hello\nab', cursorPos: 4 }); // "hell|o"
    engine.dispatch({ type: 'MOVE_CURSOR_DOWN' });
    expect(engine.getState().cursorPos).toBe(8); // "ab|" (clamped to line length)
  });

  it('MOVE_CURSOR_DOWN on last line is a no-op', () => {
    const engine = new Engine({ text: 'hello\nworld', cursorPos: 8 });
    engine.dispatch({ type: 'MOVE_CURSOR_DOWN' });
    expect(engine.getState().cursorPos).toBe(8);
  });

  it('MOVE_CURSOR_UP then DOWN returns to original position on equal-length lines', () => {
    const engine = new Engine({ text: 'abcde\nfghij', cursorPos: 8 }); // col 2 of line 1
    engine.dispatch({ type: 'MOVE_CURSOR_UP' });
    expect(engine.getState().cursorPos).toBe(2);
    engine.dispatch({ type: 'MOVE_CURSOR_DOWN' });
    expect(engine.getState().cursorPos).toBe(8);
  });

  it('MOVE_CURSOR_DOWN across multiple lines', () => {
    const engine = new Engine({ text: 'aaa\nbbb\nccc', cursorPos: 1 }); // col 1, line 0
    engine.dispatch({ type: 'MOVE_CURSOR_DOWN' });
    expect(engine.getState().cursorPos).toBe(5); // col 1, line 1
    engine.dispatch({ type: 'MOVE_CURSOR_DOWN' });
    expect(engine.getState().cursorPos).toBe(9); // col 1, line 2
  });

  it('MOVE_CURSOR_UP across multiple lines', () => {
    const engine = new Engine({ text: 'aaa\nbbb\nccc', cursorPos: 9 }); // col 1, line 2
    engine.dispatch({ type: 'MOVE_CURSOR_UP' });
    expect(engine.getState().cursorPos).toBe(5); // col 1, line 1
    engine.dispatch({ type: 'MOVE_CURSOR_UP' });
    expect(engine.getState().cursorPos).toBe(1); // col 1, line 0
  });

  it('MOVE_CURSOR_UP/DOWN with empty lines', () => {
    const engine = new Engine({ text: 'hello\n\nworld', cursorPos: 3 }); // "hel|lo"
    engine.dispatch({ type: 'MOVE_CURSOR_DOWN' });
    expect(engine.getState().cursorPos).toBe(6); // empty line, clamped to col 0
    engine.dispatch({ type: 'MOVE_CURSOR_DOWN' });
    expect(engine.getState().cursorPos).toBe(7); // "w|orld", col 0
  });
});

// ─── Engine: INSERT_IMAGE ───

describe('Engine INSERT_IMAGE', () => {
  it('inserts image syntax on its own line', () => {
    const engine = new Engine({ text: 'hello', cursorPos: 5 });
    engine.dispatch({ type: 'INSERT_IMAGE', src: 'img.png' });
    expect(engine.getText()).toContain('![](img.png)');
  });

  it('resulting Node[] contains ImageNode', () => {
    const engine = new Engine();
    engine.dispatch({ type: 'INSERT_IMAGE', src: 'photo.jpg' });
    const state = engine.getState();
    const hasImage = state.content.some(n => n.type === 'image');
    expect(hasImage).toBe(true);
  });

  it('adds newline before image when not at line start', () => {
    const engine = new Engine({ text: 'text', cursorPos: 4 });
    engine.dispatch({ type: 'INSERT_IMAGE', src: 'img.png' });
    const text = engine.getText();
    // Should have newline before image
    expect(text).toContain('\n![](img.png)');
  });

  it('adds newline after image when inserting mid-text', () => {
    const engine = new Engine({ text: 'abcd', cursorPos: 2 });
    engine.dispatch({ type: 'INSERT_IMAGE', src: 'pic.png' });
    const text = engine.getText();
    // Should have newlines both before and after the image syntax
    expect(text).toBe('ab\n![](pic.png)\ncd');
  });

  it('does not add extra newline when next char is already newline', () => {
    const engine = new Engine({ text: 'ab\ncd', cursorPos: 2 });
    engine.dispatch({ type: 'INSERT_IMAGE', src: 'pic.png' });
    const text = engine.getText();
    // Should add newline before but not after (next char is already \n)
    expect(text).toBe('ab\n![](pic.png)\ncd');
  });
});

// ─── Engine: SET_CONTENT ───

describe('Engine SET_CONTENT', () => {
  it('replaces entire text', () => {
    const engine = new Engine({ text: 'old text', cursorPos: 3 });
    engine.dispatch({ type: 'SET_CONTENT', text: 'new text' });
    expect(engine.getText()).toBe('new text');
  });

  it('resets cursor to 0', () => {
    const engine = new Engine({ text: 'old', cursorPos: 3 });
    engine.dispatch({ type: 'SET_CONTENT', text: 'new content' });
    expect(engine.getState().cursorPos).toBe(0);
  });

  it('parses new content correctly', () => {
    const engine = new Engine();
    engine.dispatch({ type: 'SET_CONTENT', text: '# Hello' });
    const state = engine.getState();
    const heading = state.content.find(
      n => n.type === 'text' && (n as TextNode).size === '32px'
    );
    expect(heading).toBeDefined();
  });
});

// ─── Edge Cases ───

describe('Edge cases', () => {
  it('rapid sequential inserts', () => {
    const engine = new Engine();
    engine.dispatch({ type: 'INSERT_TEXT', text: 'a' });
    engine.dispatch({ type: 'INSERT_TEXT', text: 'b' });
    engine.dispatch({ type: 'INSERT_TEXT', text: 'c' });
    expect(engine.getText()).toBe('abc');
    expect(engine.getState().cursorPos).toBe(3);
  });

  it('delete all content leads to empty state', () => {
    const engine = new Engine({ text: 'ab', cursorPos: 2 });
    engine.dispatch({ type: 'DELETE_BACKWARD' });
    engine.dispatch({ type: 'DELETE_BACKWARD' });
    expect(engine.getText()).toBe('');
    expect(engine.getState().cursorPos).toBe(0);
    expect(engine.getState().content).toEqual([]);
  });

  it('cursor at text boundary after deletion', () => {
    const engine = new Engine({ text: 'a', cursorPos: 1 });
    engine.dispatch({ type: 'DELETE_BACKWARD' });
    expect(engine.getState().cursorPos).toBe(0);
    expect(engine.getText()).toBe('');
  });

  it('getTextLength returns correct length', () => {
    const engine = new Engine({ text: 'hello' });
    expect(engine.getTextLength()).toBe(5);
  });

  it('constructor clamps cursor to text length', () => {
    const engine = new Engine({ text: 'hi', cursorPos: 100 });
    expect(engine.getState().cursorPos).toBe(2);
  });
});
