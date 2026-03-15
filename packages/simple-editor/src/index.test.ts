import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleEditor } from './index';

describe('SimpleEditor - Constructor', () => {
  it('throws when container element is not found', () => {
    expect(() => {
      new SimpleEditor('nonexistent-id', { content: [] });
    }).toThrow('Container element not found: nonexistent-id');
  });
});

describe('SimpleEditor - Text Rendering', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should render plain text with no marks, newlines, or sizes', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello World' }],
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    expect(editorDiv).toBeDefined();

    const span = editorDiv?.querySelector('span');
    expect(span).toBeDefined();
    expect(span?.textContent).toBe('Hello World');
    expect(span?.style.fontWeight).toBe('');
    expect(span?.style.fontStyle).toBe('');
    expect(span?.style.textDecoration).toBe('');
    expect(span?.style.fontSize).toBe('');
  });

  it('should render cursor at specified position', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello World' }],
      cursorPos: 6,
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    expect(editorDiv).toBeDefined();

    // Find the cursor span
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor');
    expect(cursorSpan).toBeDefined();
    expect(cursorSpan?.textContent).toBe('W'); // Character at position 6 is 'W'
    expect(cursorSpan?.classList.contains('simple-editor-cursor')).toBe(true);
  });

  it('should render text with bold mark', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Bold Text', marks: ['bold'] }],
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const span = editorDiv?.querySelector('span');
    expect(span?.textContent).toBe('Bold Text');
    expect(span?.style.fontWeight).toBe('bold');
  });

  it('should render text with italic mark', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Italic Text', marks: ['italic'] }],
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const span = editorDiv?.querySelector('span');
    expect(span?.textContent).toBe('Italic Text');
    expect(span?.style.fontStyle).toBe('italic');
  });

  it('should render text with underline mark', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Underline Text', marks: ['underline'] }],
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const span = editorDiv?.querySelector('span');
    expect(span?.textContent).toBe('Underline Text');
    expect(span?.style.textDecoration).toBe('underline');
  });

  it('should render text with multiple marks', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Bold Italic', marks: ['bold', 'italic'] }],
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const span = editorDiv?.querySelector('span');
    expect(span?.textContent).toBe('Bold Italic');
    expect(span?.style.fontWeight).toBe('bold');
    expect(span?.style.fontStyle).toBe('italic');
  });

  it('should render text with newlines', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Line 1\nLine 2\nLine 3' }],
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    expect(editorDiv).toBeDefined();

    const spans = editorDiv?.querySelectorAll('span:not(.simple-editor-cursor)');
    const brs = editorDiv?.querySelectorAll('br');

    // Should have 3 spans (one for each line)
    expect(spans?.length).toBe(3);
    expect(spans?.[0]?.textContent).toBe('Line 1');
    expect(spans?.[1]?.textContent).toBe('Line 2');
    expect(spans?.[2]?.textContent).toBe('Line 3');

    // Should have 2 br elements (between lines)
    expect(brs?.length).toBe(2);
  });

  it('should render newlines with marks applied', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Bold 1\nBold 2', marks: ['bold'] }],
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const spans = editorDiv?.querySelectorAll('span:not(.simple-editor-cursor)');

    // Each line should have bold applied
    expect(spans?.[0]?.textContent).toBe('Bold 1');
    expect((spans?.[0] as HTMLElement)?.style.fontWeight).toBe('bold');
    expect(spans?.[1]?.textContent).toBe('Bold 2');
    expect((spans?.[1] as HTMLElement)?.style.fontWeight).toBe('bold');
  });

  it('should render cursor with newlines', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello\nWorld' }],
      cursorPos: 8, // Position in "World" (H=0, e=1, l=2, l=3, o=4, \n=5, W=6, o=7, r=8)
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    expect(editorDiv).toBeDefined();

    // Find the cursor span
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor');
    expect(cursorSpan).toBeDefined();
    expect(cursorSpan?.textContent).toBe('r'); // Character at position 8

    // Verify there are br elements
    const brs = editorDiv?.querySelectorAll('br');
    expect(brs?.length).toBe(1);
  });

  it('should render cursor at end of line with newlines', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello\nWorld\nTest' }],
      cursorPos: 10, // Position at end of second line (H=0, e=1, l=2, l=3, o=4, \n=5, W=6, o=7, r=8, l=9, d=10)
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor');

    // Cursor should show 'd', the last character of second line
    expect(cursorSpan?.textContent).toBe('d');
  });

  it('should render cursor at beginning of line with newlines', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello\nWorld\nTest' }],
      cursorPos: 12, // Position at beginning of third line (after second \n)
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor');

    // Cursor should show 'T', the first character of third line
    expect(cursorSpan?.textContent).toBe('T');
  });

  it('should not allow cursor to be positioned on newline character', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello\nWorld' }],
      cursorPos: 5, // Position exactly on the newline character
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor');

    // Cursor should not show the newline character - should show a space instead
    expect(cursorSpan?.textContent).not.toBe('\n');
    expect(cursorSpan?.textContent).toBe(' ');
  });

  it('should place cursor on first newline at end of current line, not next line', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'AB\n\nCD' }],
      cursorPos: 2, // First \n
    });

    const editorDiv = container.querySelector('#simple-editor-container')!;
    const children = Array.from(editorDiv.childNodes);

    // Expected order: <span>AB</span>, <cursor ' '>, <br>, <br>, <span>CD</span>
    // The cursor should appear at the end of the "AB" line,
    // with the <br> for its newline coming AFTER the cursor
    const cursorIndex = children.findIndex(
      n => n instanceof HTMLElement && n.classList.contains('simple-editor-cursor')
    );
    const firstBrAfterCursor = children.findIndex(
      (n, i) => i > cursorIndex && n.nodeName === 'BR'
    );

    expect(cursorIndex).toBeGreaterThan(-1);
    expect(firstBrAfterCursor).toBeGreaterThan(cursorIndex);
  });

  it('should place cursor on second newline on the blank line', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'AB\n\nCD' }],
      cursorPos: 3, // Second \n
    });

    const editorDiv = container.querySelector('#simple-editor-container')!;
    const children = Array.from(editorDiv.childNodes);

    // Expected order: <span>AB</span>, <br>, <cursor ' '>, <br>, <span>CD</span>
    // The first <br> puts us on the blank line, cursor appears there,
    // then the second <br> pushes CD to the next line
    const cursorIndex = children.findIndex(
      n => n instanceof HTMLElement && n.classList.contains('simple-editor-cursor')
    );

    // There should be a <br> before the cursor (from the first \n in beforeText)
    const brBeforeCursor = children.findIndex(
      (n, i) => i < cursorIndex && n.nodeName === 'BR'
    );
    // There should be a <br> after the cursor (from the cursor's own newline)
    const brAfterCursor = children.findIndex(
      (n, i) => i > cursorIndex && n.nodeName === 'BR'
    );

    expect(brBeforeCursor).toBeGreaterThan(-1);
    expect(cursorIndex).toBeGreaterThan(brBeforeCursor);
    expect(brAfterCursor).toBeGreaterThan(cursorIndex);
  });

  it('should render cursor at end of text after newline with default font size', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello', size: '32px' }, { type: 'text', value: '\n' }],
      cursorPos: 6, // Past all text, on the empty new line
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor') as HTMLElement;

    expect(cursorSpan).toBeDefined();
    expect(cursorSpan?.textContent).toBe(' ');
    // Cursor on a blank line after a newline should use default size to avoid layout shifts
    expect(cursorSpan?.style.fontSize).toBe('');
  });

  it('should render cursor on newline character with previous character font size when in different node', () => {
    new SimpleEditor('test-container', {
      content: [
        { type: 'text', value: 'Big', size: '32px' },
        { type: 'text', value: '\nSmall', size: '16px' },
      ],
      cursorPos: 3, // On the \n character between nodes
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor') as HTMLElement;

    expect(cursorSpan).toBeDefined();
    expect(cursorSpan?.textContent).toBe(' ');
    // Cursor at end of "Big" line should have 32px, not 16px from the next node
    expect(cursorSpan?.style.fontSize).toBe('32px');
  });

  it('should render cursor on newline with font size from same node', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello\n', size: '24px' }],
      cursorPos: 5, // On the \n within the same node
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor') as HTMLElement;

    expect(cursorSpan).toBeDefined();
    expect(cursorSpan?.textContent).toBe(' ');
    // Same node, so font size should already be correct
    expect(cursorSpan?.style.fontSize).toBe('24px');
  });

  it('should place cursor on first char of next node at node boundary', () => {
    new SimpleEditor('test-container', {
      content: [
        { type: 'text', value: 'AB' },
        { type: 'text', value: '\n\n' },
        { type: 'text', value: 'CD' },
      ],
      cursorPos: 4, // Should be 'C' (A=0, B=1, \n=2, \n=3, C=4)
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor');

    // Cursor should be on 'C', not a space from the end of the '\n\n' node
    expect(cursorSpan?.textContent).toBe('C');
  });
});

describe('SimpleEditor - findPreviousCharSize edge cases', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('handles cursor at position 0 on a newline character', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: '\nHello' }],
      cursorPos: 0,
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor') as HTMLElement;
    expect(cursorSpan).toBeDefined();
    expect(cursorSpan?.textContent).toBe(' ');
    // No previous character, so no inherited size
    expect(cursorSpan?.style.fontSize).toBe('');
  });

  it('skips image nodes when looking up previous char size', () => {
    new SimpleEditor('test-container', {
      content: [
        { type: 'text', value: 'AB', size: '24px' },
        { type: 'image', src: 'img.png' },
        { type: 'text', value: 'CD\n' },
      ],
      cursorPos: 4, // On the '\n' in 'CD\n'
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor') as HTMLElement;
    expect(cursorSpan).toBeDefined();
    expect(cursorSpan?.textContent).toBe(' ');
  });
});

describe('SimpleEditor - Image Rendering', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should render an image node as an img element', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'image', src: 'https://example.com/photo.jpg' }],
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const img = editorDiv?.querySelector('img') as HTMLImageElement;

    expect(img).toBeDefined();
    expect(img?.src).toBe('https://example.com/photo.jpg');
    expect(img?.style.width).toBe('500px');
    expect(img?.style.display).toBe('block');
    expect(img?.style.margin).toBe('0px auto');
  });

  it('should not affect cursor positioning with image nodes', () => {
    new SimpleEditor('test-container', {
      content: [
        { type: 'text', value: 'Hello' },
        { type: 'image', src: 'https://example.com/photo.jpg' },
        { type: 'text', value: 'World' },
      ],
      cursorPos: 5, // Should be 'W' in "World" (image contributes 0 length)
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor');

    expect(cursorSpan?.textContent).toBe('W');
  });

  it('should render images in correct order between text nodes', () => {
    new SimpleEditor('test-container', {
      content: [
        { type: 'text', value: 'Before' },
        { type: 'image', src: 'https://example.com/photo.jpg' },
        { type: 'text', value: 'After' },
      ],
    });

    const editorDiv = container.querySelector('#simple-editor-container')!;
    const children = Array.from(editorDiv.childNodes);

    // Find the img element
    const imgIndex = children.findIndex(n => n.nodeName === 'IMG');
    expect(imgIndex).toBeGreaterThan(-1);

    // Text "Before" should be before the image
    const beforeSpan = children.find(
      (n, i) => i < imgIndex && n instanceof HTMLElement && n.textContent === 'Before'
    );
    expect(beforeSpan).toBeDefined();

    // Text "After" should be after the image
    const afterSpan = children.find(
      (n, i) => i > imgIndex && n instanceof HTMLElement && n.textContent === 'After'
    );
    expect(afterSpan).toBeDefined();
  });

  it('should render multiple image nodes', () => {
    new SimpleEditor('test-container', {
      content: [
        { type: 'image', src: 'https://example.com/one.jpg' },
        { type: 'image', src: 'https://example.com/two.jpg' },
      ],
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const imgs = editorDiv?.querySelectorAll('img');

    expect(imgs?.length).toBe(2);
    expect((imgs?.[0] as HTMLImageElement)?.src).toBe('https://example.com/one.jpg');
    expect((imgs?.[1] as HTMLImageElement)?.src).toBe('https://example.com/two.jpg');
  });

  it('should inherit font size across image nodes for cursor', () => {
    new SimpleEditor('test-container', {
      content: [
        { type: 'text', value: 'Big', size: '32px' },
        { type: 'image', src: 'https://example.com/photo.jpg' },
        { type: 'text', value: '\nSmall', size: '16px' },
      ],
      cursorPos: 3, // On the \n character in the third node
    });

    const editorDiv = container.querySelector('#simple-editor-container');
    const cursorSpan = editorDiv?.querySelector('.simple-editor-cursor') as HTMLElement;

    expect(cursorSpan).toBeDefined();
    expect(cursorSpan?.textContent).toBe(' ');
    // Should inherit 32px from "Big" node, skipping the image node
    expect(cursorSpan?.style.fontSize).toBe('32px');
  });
});

describe('SimpleEditor - Cursor Color Options', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should apply custom cursorColor as background-color', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello' }],
      cursorPos: 0,
      cursorColor: 'red',
    });

    const cursorSpan = container.querySelector('.simple-editor-cursor') as HTMLElement;
    expect(cursorSpan.style.backgroundColor).toBe('red');
  });

  it('should apply custom cursorTextColor as color', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello' }],
      cursorPos: 0,
      cursorTextColor: 'white',
    });

    const cursorSpan = container.querySelector('.simple-editor-cursor') as HTMLElement;
    expect(cursorSpan.style.color).toBe('white');
  });

  it('should apply both cursorColor and cursorTextColor together', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello' }],
      cursorPos: 0,
      cursorColor: 'red',
      cursorTextColor: 'white',
    });

    const cursorSpan = container.querySelector('.simple-editor-cursor') as HTMLElement;
    expect(cursorSpan.style.backgroundColor).toBe('red');
    expect(cursorSpan.style.color).toBe('white');
  });

  it('should use default cursor colors when options are not provided', () => {
    new SimpleEditor('test-container', {
      content: [{ type: 'text', value: 'Hello' }],
      cursorPos: 0,
    });

    const cursorSpan = container.querySelector('.simple-editor-cursor') as HTMLElement;
    // No inline overrides — colors come from the CSS class
    expect(cursorSpan.style.backgroundColor).toBe('');
    expect(cursorSpan.style.color).toBe('');
  });
});
