"use strict";

/**
 * @param {string} content
 * @returns {"LF" | "CRLF"}
 */
function detectEol(content) {
  let crlfCount = 0;
  let lfCount = 0;
  
  let i = 0;
  while (i < content.length) {
    const idx = content.indexOf('\n', i);
    if (idx === -1) break;
    if (idx > 0 && content[idx - 1] === '\r') crlfCount++;
    else lfCount++;
    i = idx + 1;
  }
  
  if (crlfCount > lfCount) return "CRLF";
  return "LF";
}

/**
 * @param {string} content
 * @returns {object}
 */
function createBuffer(content) {
  const eol = detectEol(content);
  // tách theo \n, bỏ \r cuối dòng nếu có
  const lines = content.split('\n').map(line => line.endsWith('\r') ? line.slice(0, -1) : line);
  
  return {
    lines,
    eol,
    cursor: { line: 0, col: 0 },
    scroll: { top: 0, left: 0 },
    dirty: false,
    _lastMoveVertical: false
  };
}

/**
 * @param {object} buffer
 * @returns {string}
 */
function serialize(buffer) {
  const joiner = buffer.eol === "CRLF" ? "\r\n" : "\n";
  return buffer.lines.join(joiner);
}

/**
 * @param {object} buffer
 * @returns {object}
 */
function clampCursor(buffer) {
  const lines = buffer.lines;
  let { line, col } = buffer.cursor;
  
  if (line < 0) line = 0;
  if (line >= lines.length) line = lines.length - 1;
  
  const currentLineLength = lines[line].length;
  if (col < 0) col = 0;
  if (col > currentLineLength) col = currentLineLength;
  
  buffer.cursor.line = line;
  buffer.cursor.col = col;
  return buffer;
}

/**
 * @param {object} buffer
 * @param {string} text
 * @returns {object}
 */
function insertText(buffer, text) {
  clampCursor(buffer);
  const { line, col } = buffer.cursor;
  const currentLine = buffer.lines[line];
  
  buffer.lines[line] = currentLine.slice(0, col) + text + currentLine.slice(col);
  buffer.cursor.col += text.length;
  buffer.cursor.desiredCol = buffer.cursor.col;
  buffer.dirty = true;
  buffer._lastMoveVertical = false;
  return buffer;
}

/**
 * @param {object} buffer
 * @returns {object}
 */
function insertNewline(buffer) {
  clampCursor(buffer);
  const { line, col } = buffer.cursor;
  const currentLine = buffer.lines[line];
  
  buffer.lines[line] = currentLine.slice(0, col);
  buffer.lines.splice(line + 1, 0, currentLine.slice(col));
  
  buffer.cursor.line++;
  buffer.cursor.col = 0;
  buffer.cursor.desiredCol = 0;
  buffer.dirty = true;
  buffer._lastMoveVertical = false;
  return buffer;
}

/**
 * @param {object} buffer
 * @returns {object}
 */
function deleteBackward(buffer) {
  clampCursor(buffer);
  const { line, col } = buffer.cursor;
  
  if (col > 0) {
    const currentLine = buffer.lines[line];
    buffer.lines[line] = currentLine.slice(0, col - 1) + currentLine.slice(col);
    buffer.cursor.col--;
    buffer.dirty = true;
  } else if (line > 0) {
    const prevLineLength = buffer.lines[line - 1].length;
    buffer.lines[line - 1] += buffer.lines[line];
    buffer.lines.splice(line, 1);
    buffer.cursor.line--;
    buffer.cursor.col = prevLineLength;
    buffer.dirty = true;
  }
  buffer.cursor.desiredCol = buffer.cursor.col;
  buffer._lastMoveVertical = false;
  return buffer;
}

/**
 * @param {object} buffer
 * @returns {object}
 */
function deleteForward(buffer) {
  clampCursor(buffer);
  const { line, col } = buffer.cursor;
  const currentLine = buffer.lines[line];
  
  if (col < currentLine.length) {
    buffer.lines[line] = currentLine.slice(0, col) + currentLine.slice(col + 1);
    buffer.dirty = true;
  } else if (line < buffer.lines.length - 1) {
    buffer.lines[line] += buffer.lines[line + 1];
    buffer.lines.splice(line + 1, 1);
    buffer.dirty = true;
  }
  buffer.cursor.desiredCol = buffer.cursor.col;
  buffer._lastMoveVertical = false;
  return buffer;
}

/**
 * @param {object} buffer
 * @param {string} to
 * @param {number} [viewportRows]
 * @returns {object}
 */
function moveCursor(buffer, to, viewportRows = 10) {
  clampCursor(buffer);
  let { line, col } = buffer.cursor;
  const lines = buffer.lines;

  const vertical = to === "up" || to === "down" || to === "pageup" || to === "pagedown";
  if (!vertical || !buffer._lastMoveVertical) {
    buffer.cursor.desiredCol = col;
  }

  switch (to) {
    case "left":
      if (col > 0) {
        col--;
      } else if (line > 0) {
        line--;
        col = lines[line].length;
      }
      break;
    case "right":
      if (col < lines[line].length) {
        col++;
      } else if (line < lines.length - 1) {
        line++;
        col = 0;
      }
      break;
    case "up":
      if (line > 0) line--;
      break;
    case "down":
      if (line < lines.length - 1) line++;
      break;
    case "home":
      col = 0;
      break;
    case "end":
      col = lines[line].length;
      break;
    case "pageup":
      line = Math.max(0, line - viewportRows);
      break;
    case "pagedown":
      line = Math.min(lines.length - 1, line + viewportRows);
      break;
  }
  
  if (vertical) {
    col = Math.min(buffer.cursor.desiredCol, lines[line].length);
    buffer._lastMoveVertical = true;
  } else {
    buffer.cursor.desiredCol = col;
    buffer._lastMoveVertical = false;
  }

  buffer.cursor.line = line;
  buffer.cursor.col = col;
  clampCursor(buffer);
  return buffer;
}

module.exports = {
  detectEol,
  createBuffer,
  serialize,
  insertText,
  insertNewline,
  deleteBackward,
  deleteForward,
  moveCursor,
  clampCursor
};
