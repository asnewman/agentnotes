(() => {
  // ../simple-editor/dist/engine.js
  var HEADING_SIZES = {
    1: "32px",
    2: "24px",
    3: "20px",
    4: "18px",
    5: "16px",
    6: "14px"
  };
  function parseMarkdownToDecorations(text) {
    const decorations = [];
    const lines = text.split("\n");
    let offset = 0;
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        decorations.push({
          from: offset,
          to: offset + line.length,
          type: "fontSize",
          attributes: { size: HEADING_SIZES[level] }
        });
      }
      const boldRegex = /(\*\*|__)([^*_]+)\1/g;
      let match;
      while ((match = boldRegex.exec(line)) !== null) {
        decorations.push({
          from: offset + match.index,
          to: offset + match.index + match[0].length,
          type: "bold"
        });
      }
      const italicRegex = /(?<!\*|\w)(\*|_)(?!\1)([^*_\n]+)\1(?!\1|\w)/g;
      while ((match = italicRegex.exec(line)) !== null) {
        decorations.push({
          from: offset + match.index,
          to: offset + match.index + match[0].length,
          type: "italic"
        });
      }
      const imageRegex = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
      const imageMatch = line.match(imageRegex);
      if (imageMatch) {
        decorations.push({
          from: offset,
          to: offset + line.length,
          type: "image",
          attributes: { src: imageMatch[2], alt: imageMatch[1] || "image" }
        });
      }
      offset += line.length + 1;
    }
    return decorations;
  }
  function decorationsToNodes(text, decorations) {
    if (text.length === 0)
      return [];
    const imageDecorations = decorations.filter((d) => d.type === "image");
    const styleDecorations = decorations.filter((d) => d.type !== "image");
    if (imageDecorations.length === 0) {
      return textSegmentToNodes(text, 0, text.length, styleDecorations);
    }
    const nodes = [];
    let pos = 0;
    for (const imgDec of imageDecorations) {
      if (pos < imgDec.from) {
        const segment = text.slice(pos, imgDec.from);
        const trimmed = segment.slice(0, -1);
        if (trimmed.length > 0) {
          const segNodes = textSegmentToNodes(text, pos, pos + trimmed.length, styleDecorations);
          nodes.push(...segNodes);
        }
        nodes.push({ type: "text", value: "\n" });
      }
      nodes.push({
        type: "image",
        src: String(imgDec.attributes.src)
      });
      pos = imgDec.to + 1;
    }
    if (pos < text.length) {
      nodes.push({ type: "text", value: "\n" });
      const segNodes = textSegmentToNodes(text, pos, text.length, styleDecorations);
      nodes.push(...segNodes);
    }
    return nodes;
  }
  function textSegmentToNodes(fullText, segStart, segEnd, decorations) {
    const boundaries = /* @__PURE__ */ new Set();
    boundaries.add(segStart);
    boundaries.add(segEnd);
    for (const dec of decorations) {
      if (dec.from > segStart && dec.from < segEnd)
        boundaries.add(dec.from);
      if (dec.to > segStart && dec.to < segEnd)
        boundaries.add(dec.to);
    }
    const sorted = Array.from(boundaries).sort((a, b) => a - b);
    const nodes = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i];
      const to = sorted[i + 1];
      const spanText = fullText.slice(from, to);
      const active = decorations.filter((d) => d.from < to && d.to > from);
      const marks = [];
      let size;
      for (const dec of active) {
        if (dec.type === "bold")
          marks.push("bold");
        if (dec.type === "italic")
          marks.push("italic");
        if (dec.type === "fontSize")
          size = String(dec.attributes.size);
      }
      const node = { type: "text", value: spanText };
      if (marks.length > 0)
        node.marks = marks;
      if (size)
        node.size = size;
      nodes.push(node);
    }
    return mergeTextNodes(nodes);
  }
  function marksEqual(a, b) {
    const aMarks = a ?? [];
    const bMarks = b ?? [];
    if (aMarks.length !== bMarks.length)
      return false;
    const aSorted = [...aMarks].sort();
    const bSorted = [...bMarks].sort();
    return aSorted.every((m, i) => m === bSorted[i]);
  }
  function mergeTextNodes(nodes) {
    const result = [nodes[0]];
    for (let i = 1; i < nodes.length; i++) {
      const prev = result[result.length - 1];
      const curr = nodes[i];
      if (prev.type === "text" && curr.type === "text" && marksEqual(prev.marks, curr.marks) && prev.size === curr.size) {
        result[result.length - 1] = {
          ...prev,
          value: prev.value + curr.value
        };
      } else {
        result.push(curr);
      }
    }
    return result;
  }
  function parseMarkdown(text) {
    const decorations = parseMarkdownToDecorations(text);
    return decorationsToNodes(text, decorations);
  }
  function getLineAndColumn(text, pos) {
    const lines = text.split("\n");
    let offset = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      const lineEnd = offset + lines[i].length;
      if (pos <= lineEnd) {
        return { line: i, col: pos - offset };
      }
      offset = lineEnd + 1;
    }
    return { line: lines.length - 1, col: pos - offset };
  }
  function getPositionFromLineAndColumn(text, line, col) {
    const lines = text.split("\n");
    let offset = 0;
    for (let i = 0; i < line; i++) {
      offset += lines[i].length + 1;
    }
    return offset + Math.min(col, lines[line].length);
  }
  var Engine = class {
    constructor(options) {
      this.text = options?.text ?? "";
      this.cursorPos = Math.min(options?.cursorPos ?? 0, this.text.length);
      this.onSave = options?.onSave;
      this.onChange = options?.onChange;
    }
    dispatch(action) {
      let textChanged = false;
      switch (action.type) {
        case "INSERT_TEXT": {
          this.text = this.text.slice(0, this.cursorPos) + action.text + this.text.slice(this.cursorPos);
          this.cursorPos += action.text.length;
          textChanged = true;
          break;
        }
        case "DELETE_BACKWARD": {
          if (this.cursorPos > 0) {
            this.text = this.text.slice(0, this.cursorPos - 1) + this.text.slice(this.cursorPos);
            this.cursorPos--;
            textChanged = true;
          }
          break;
        }
        case "MOVE_CURSOR": {
          this.cursorPos = Math.max(0, Math.min(action.position, this.text.length));
          break;
        }
        case "MOVE_CURSOR_LEFT": {
          if (this.cursorPos > 0)
            this.cursorPos--;
          break;
        }
        case "MOVE_CURSOR_RIGHT": {
          if (this.cursorPos < this.text.length)
            this.cursorPos++;
          break;
        }
        case "MOVE_CURSOR_UP": {
          const { line, col } = getLineAndColumn(this.text, this.cursorPos);
          if (line > 0) {
            this.cursorPos = getPositionFromLineAndColumn(this.text, line - 1, col);
          }
          break;
        }
        case "MOVE_CURSOR_DOWN": {
          const { line, col } = getLineAndColumn(this.text, this.cursorPos);
          const lineCount = this.text.split("\n").length;
          if (line < lineCount - 1) {
            this.cursorPos = getPositionFromLineAndColumn(this.text, line + 1, col);
          }
          break;
        }
        case "MOVE_CURSOR_TO_START": {
          this.cursorPos = 0;
          break;
        }
        case "MOVE_CURSOR_TO_END": {
          this.cursorPos = this.text.length;
          break;
        }
        case "INSERT_IMAGE": {
          let insertion = `![](${action.src})`;
          if (this.cursorPos > 0 && this.text[this.cursorPos - 1] !== "\n") {
            insertion = "\n" + insertion;
          }
          if (this.cursorPos < this.text.length && this.text[this.cursorPos] !== "\n") {
            insertion = insertion + "\n";
          }
          this.text = this.text.slice(0, this.cursorPos) + insertion + this.text.slice(this.cursorPos);
          this.cursorPos += insertion.length;
          textChanged = true;
          break;
        }
        case "SET_CONTENT": {
          this.text = action.text;
          this.cursorPos = 0;
          textChanged = true;
          break;
        }
      }
      const state = this.getState();
      if (textChanged && this.onSave) {
        this.onSave(this.text);
      }
      if (this.onChange) {
        this.onChange(state);
      }
      return state;
    }
    getState() {
      return {
        content: parseMarkdown(this.text),
        cursorPos: this.cursorPos
      };
    }
    getText() {
      return this.text;
    }
    getTextLength() {
      return this.text.length;
    }
  };

  // ../simple-editor/dist/index.js
  function isTextNode(node) {
    return node.type === "text";
  }
  var CURSOR_BLINK_STYLE = `
  #simple-editor-container {
    font-family: monospace;
  }
  .simple-editor-cursor {
    padding: 0;
    white-space: pre-wrap;
    box-shadow: 2px 0 0 0 var(--cursor-color, #000);
    animation: simple-editor-blink 1s step-end infinite;
  }
  @keyframes simple-editor-blink {
    50% { box-shadow: 2px 0 0 0 transparent; }
  }
`;
  var SimpleEditor = class {
    constructor(containerId, options) {
      const element = document.getElementById(containerId);
      if (!element) {
        throw new Error(`Container element not found: ${containerId}`);
      }
      this.container = element;
      this.options = options;
      this.injectStyles();
      this.render();
    }
    injectStyles() {
      if (document.getElementById("simple-editor-styles"))
        return;
      const style = document.createElement("style");
      style.id = "simple-editor-styles";
      style.textContent = CURSOR_BLINK_STYLE;
      document.head.appendChild(style);
    }
    applyTextNodeStyling(el, marks, size) {
      if (marks && marks.length > 0) {
        for (const mark of marks) {
          switch (mark) {
            case "bold":
              el.style.fontWeight = "bold";
              break;
            case "italic":
              el.style.fontStyle = "italic";
              break;
            case "underline":
              el.style.textDecoration = "underline";
              break;
          }
        }
      }
      if (size) {
        el.style.fontSize = size;
      }
    }
    renderTextWithNewlines(container, text, marks, size) {
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          const span = document.createElement("span");
          span.textContent = lines[i];
          this.applyTextNodeStyling(span, marks, size);
          container.appendChild(span);
        }
        if (i < lines.length - 1) {
          container.appendChild(document.createElement("br"));
        }
      }
    }
    renderImageNode(container, node) {
      const img = document.createElement("img");
      img.src = node.src;
      img.style.width = "500px";
      img.style.display = "block";
      img.style.margin = "0 auto";
      container.appendChild(img);
    }
    findPreviousCharSize(pos) {
      const p = pos - 1;
      if (p < 0)
        return void 0;
      let searchOffset = 0;
      let result;
      for (const n of this.options.content) {
        if (!isTextNode(n))
          continue;
        const nEnd = searchOffset + n.value.length;
        if (p >= searchOffset && p < nEnd) {
          if (n.value[p - searchOffset] !== "\n") {
            result = n.size;
          }
          break;
        }
        searchOffset = nEnd;
      }
      return result;
    }
    createCursor(character = " ", marks, size) {
      const cursor = document.createElement("span");
      cursor.className = "simple-editor-cursor";
      cursor.textContent = character;
      this.applyTextNodeStyling(cursor, marks, size);
      if (this.options.cursorColor) {
        cursor.style.setProperty("--cursor-color", this.options.cursorColor);
      }
      return cursor;
    }
    render() {
      this.container.innerHTML = "";
      const div = document.createElement("div");
      div.id = "simple-editor-container";
      const totalLength = this.options.content.reduce((sum, node) => {
        return sum + (isTextNode(node) ? node.value.length : 0);
      }, 0);
      if (this.options.cursorPos !== void 0 && this.options.cursorPos >= 0) {
        const pos = Math.min(this.options.cursorPos, totalLength);
        let offset = 0;
        let cursorInserted = false;
        for (const node of this.options.content) {
          if (!isTextNode(node)) {
            this.renderImageNode(div, node);
            continue;
          }
          const nodeStart = offset;
          const nodeEnd = offset + node.value.length;
          if (!cursorInserted && pos >= nodeStart && (pos < nodeEnd || nodeEnd === totalLength)) {
            const beforeText = node.value.substring(0, pos - nodeStart);
            const rawCursorChar = node.value.charAt(pos - nodeStart);
            const isNewline = rawCursorChar === "\n";
            const cursorChar = !rawCursorChar || isNewline ? " " : rawCursorChar;
            const afterText = node.value.substring(pos - nodeStart + 1);
            let cursorSize = node.size;
            if (!rawCursorChar || isNewline) {
              cursorSize = this.findPreviousCharSize(pos);
            }
            this.renderTextWithNewlines(div, beforeText, node.marks, node.size);
            div.appendChild(this.createCursor(cursorChar, node.marks, cursorSize));
            if (isNewline) {
              div.appendChild(document.createElement("br"));
            }
            this.renderTextWithNewlines(div, afterText, node.marks, node.size);
            cursorInserted = true;
          } else {
            this.renderTextWithNewlines(div, node.value, node.marks, node.size);
          }
          offset = nodeEnd;
        }
      } else {
        for (const node of this.options.content) {
          if (!isTextNode(node)) {
            this.renderImageNode(div, node);
            continue;
          }
          this.renderTextWithNewlines(div, node.value, node.marks, node.size);
        }
      }
      this.container.appendChild(div);
    }
  };

  // src/renderer.ts
  var currentFilePath = null;
  var isDirty = false;
  var filenameEl = document.getElementById("filename");
  var dirtyIndicatorEl = document.getElementById("dirty-indicator");
  var editorWrapper = document.getElementById("editor-wrapper");
  var hiddenInput = document.getElementById("hidden-input");
  function getDisplayName() {
    if (!currentFilePath) return "Untitled";
    const parts = currentFilePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "Untitled";
  }
  function updateTitle() {
    const name = getDisplayName();
    const prefix = isDirty ? "* " : "";
    filenameEl.textContent = `${prefix}${name}`;
    dirtyIndicatorEl.classList.toggle("hidden", !isDirty);
    window.api.setTitle(`${prefix}${name} - Simple Markdown`);
  }
  var engine = new Engine({
    text: "",
    cursorPos: 0,
    onChange(state) {
      new SimpleEditor("editor-container", {
        content: state.content,
        cursorPos: state.cursorPos,
        cursorColor: "#d4d4d4"
      });
    },
    onSave() {
      if (!isDirty) {
        isDirty = true;
        updateTitle();
      }
    }
  });
  var initialState = engine.getState();
  new SimpleEditor("editor-container", {
    content: initialState.content,
    cursorPos: initialState.cursorPos
  });
  updateTitle();
  async function handleOpen() {
    const result = await window.api.openFile();
    if (result) {
      currentFilePath = result.filePath;
      engine.dispatch({ type: "SET_CONTENT", text: result.content });
      isDirty = false;
      updateTitle();
    }
  }
  async function handleSave() {
    const text = engine.getText();
    if (currentFilePath) {
      const result = await window.api.saveFile(text, currentFilePath);
      if (result.success) {
        isDirty = false;
        updateTitle();
      }
    } else {
      const result = await window.api.saveFileAs(text);
      if (result.success && result.filePath) {
        currentFilePath = result.filePath;
        isDirty = false;
        updateTitle();
      }
    }
  }
  window.api.onMenuOpen(handleOpen);
  window.api.onMenuSave(handleSave);
  editorWrapper.addEventListener("click", () => {
    hiddenInput.focus();
  });
  hiddenInput.addEventListener("blur", () => {
    setTimeout(() => hiddenInput.focus(), 10);
  });
  hiddenInput.focus();
  hiddenInput.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "Backspace":
        e.preventDefault();
        engine.dispatch({ type: "DELETE_BACKWARD" });
        break;
      case "ArrowLeft":
        e.preventDefault();
        engine.dispatch({ type: "MOVE_CURSOR_LEFT" });
        break;
      case "ArrowRight":
        e.preventDefault();
        engine.dispatch({ type: "MOVE_CURSOR_RIGHT" });
        break;
      case "ArrowUp":
        e.preventDefault();
        engine.dispatch({ type: "MOVE_CURSOR_UP" });
        break;
      case "ArrowDown":
        e.preventDefault();
        engine.dispatch({ type: "MOVE_CURSOR_DOWN" });
        break;
      case "Home":
        e.preventDefault();
        engine.dispatch({ type: "MOVE_CURSOR_TO_START" });
        break;
      case "End":
        e.preventDefault();
        engine.dispatch({ type: "MOVE_CURSOR_TO_END" });
        break;
      case "Enter":
        e.preventDefault();
        engine.dispatch({ type: "INSERT_TEXT", text: "\n" });
        break;
    }
  });
  hiddenInput.addEventListener("input", () => {
    const text = hiddenInput.value;
    if (text) {
      engine.dispatch({ type: "INSERT_TEXT", text });
      hiddenInput.value = "";
    }
  });
})();
