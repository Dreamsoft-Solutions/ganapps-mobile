import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { basename, extname } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const MESSAGE = 'If you think you need a comment to explain this code, you need to write clearer code.';
const DOCUMENT_EXTENSIONS = new Set(['.md', '.mdc', '.mmd']);
const LANGUAGE_EXTENSIONS = new Map([
  ['.cjs', 'typescript'],
  ['.cts', 'typescript'],
  ['.css', 'css'],
  ['.js', 'typescript'],
  ['.jsx', 'typescript'],
  ['.mjs', 'typescript'],
  ['.mts', 'typescript'],
  ['.prisma', 'prisma'],
  ['.sh', 'hash'],
  ['.bash', 'hash'],
  ['.zsh', 'hash'],
  ['.fish', 'hash'],
  ['.sql', 'sql'],
  ['.toml', 'hash'],
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.yaml', 'yaml'],
  ['.yml', 'yaml'],
]);

function git(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

function isExcluded(path) {
  const normalized = normalizePath(path);
  const lower = normalized.toLowerCase();
  const extension = extname(lower);

  if (DOCUMENT_EXTENSIONS.has(extension) || extension === '.snap') {
    return true;
  }

  if (
    /(^|\/)(docs?|documentation|node_modules|vendor|vendored|third_party|dist|build|coverage|\.next|\.expo|out|web-build|ios|android|__snapshots__|snapshots|generated)(\/|$)/.test(
      lower,
    )
  ) {
    return true;
  }

  if (/^drizzle\/meta(?:\/|$)/.test(lower) || /^drizzle\/[^/]+\.sql$/.test(lower)) {
    return true;
  }

  if (/^prisma\/migrations(?:\/|$)/.test(lower) || /\.generated\.[^/]+$/.test(lower)) {
    return true;
  }

  return false;
}

function languageFor(path) {
  const normalized = normalizePath(path).toLowerCase();
  const name = basename(normalized);

  if (name === 'dockerfile' || name.startsWith('dockerfile.')) {
    return 'hash';
  }

  if (name === '.env' || name.startsWith('.env.')) {
    return 'hash';
  }

  return LANGUAGE_EXTENSIONS.get(extname(normalized));
}

function parseStagedPaths(raw) {
  const tokens = raw.split('\0');
  const paths = new Map();

  for (let index = 0; index < tokens.length; ) {
    const statusToken = tokens[index++];
    if (!statusToken) {
      continue;
    }

    let status = statusToken;
    let firstPath;
    const tab = statusToken.indexOf('\t');
    if (tab !== -1) {
      status = statusToken.slice(0, tab);
      firstPath = statusToken.slice(tab + 1);
    }

    if (!/^[ACMR]\d*$/.test(status)) {
      continue;
    }

    const kind = status[0];
    if (kind === 'R' || kind === 'C') {
      const oldPath = firstPath ?? tokens[index++];
      const newPath = tokens[index++];
      if (newPath) {
        paths.set(normalizePath(newPath), { oldPath: normalizePath(oldPath ?? '') });
      }
      continue;
    }

    const path = firstPath ?? tokens[index++];
    if (path) {
      paths.set(normalizePath(path), {});
    }
  }

  return paths;
}

function parsePatch(raw) {
  const files = new Map();
  let current;
  let inHunk = false;
  let oldLine = 0;
  let newLine = 0;
  let pendingDeletes = [];

  for (const sourceLine of raw.split('\n')) {
    const line = sourceLine.endsWith('\r') ? sourceLine.slice(0, -1) : sourceLine;

    if (line.startsWith('diff --git ')) {
      current = undefined;
      inHunk = false;
      pendingDeletes = [];
      continue;
    }

    if (line.startsWith('+++ b/')) {
      const path = normalizePath(line.slice(6));
      current = files.get(path) ?? {
        addedLines: new Set(),
        replacements: new Map(),
      };
      files.set(path, current);
      inHunk = false;
      pendingDeletes = [];
      continue;
    }

    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      inHunk = true;
      pendingDeletes = [];
      continue;
    }

    if (!current || !inHunk || line.startsWith('\\')) {
      continue;
    }

    if (line.startsWith('+')) {
      current.addedLines.add(newLine);
      const deleted = pendingDeletes.shift();
      if (deleted) {
        current.replacements.set(newLine, deleted.text);
      }
      newLine += 1;
      continue;
    }

    if (line.startsWith('-')) {
      pendingDeletes.push({ line: oldLine, text: line.slice(1) });
      oldLine += 1;
      continue;
    }

    if (line.startsWith(' ')) {
      pendingDeletes = [];
      oldLine += 1;
      newLine += 1;
    }
  }

  return files;
}

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
}

function lineNumberAt(starts, position) {
  let low = 0;
  let high = starts.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= position) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low + 1;
}

function token(kind, start, end, text) {
  return { kind, start, end, text };
}

function scanTypeScript(text, extension) {
  const variant = extension === '.jsx' || extension === '.tsx' ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, variant, text);
  const comments = [];

  while (true) {
    const syntaxKind = scanner.scan();
    if (syntaxKind === ts.SyntaxKind.EndOfFileToken) {
      break;
    }

    if (syntaxKind === ts.SyntaxKind.SingleLineCommentTrivia) {
      comments.push(token('line', scanner.getTokenPos(), scanner.getTextPos(), scanner.getTokenText()));
    } else if (syntaxKind === ts.SyntaxKind.MultiLineCommentTrivia) {
      comments.push(token('block', scanner.getTokenPos(), scanner.getTextPos(), scanner.getTokenText()));
    }
  }

  return comments;
}

function skipQuoted(text, start, quote) {
  let index = start + quote.length;

  while (index < text.length) {
    if (text[index] === '\\') {
      index += 2;
      continue;
    }

    if (text.startsWith(quote, index)) {
      if (quote.length === 1 && text.startsWith(quote + quote, index)) {
        index += 2;
        continue;
      }
      return index + quote.length;
    }

    index += 1;
  }

  return text.length;
}

function scanGeneric(text, options) {
  const comments = [];
  let index = 0;

  while (index < text.length) {
    const quote = options.quotes.find((value) => text.startsWith(value, index));
    if (quote) {
      index = skipQuoted(text, index, quote);
      continue;
    }

    if (options.dollarQuotes && text[index] === '$') {
      const match = text.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (match) {
        const close = text.indexOf(match[0], index + match[0].length);
        index = close === -1 ? text.length : close + match[0].length;
        continue;
      }
    }

    if (options.blockStart && text.startsWith(options.blockStart, index)) {
      const close = text.indexOf(options.blockEnd, index + options.blockStart.length);
      const end = close === -1 ? text.length : close + options.blockEnd.length;
      comments.push(token('block', index, end, text.slice(index, end)));
      index = end;
      continue;
    }

    if (options.lineStart && text.startsWith(options.lineStart, index)) {
      if (!options.lineBoundary || options.lineBoundary(text, index)) {
        const newline = text.indexOf('\n', index);
        const end = newline === -1 ? text.length : newline;
        comments.push(token('line', index, end, text.slice(index, end)));
        index = end;
        continue;
      }
    }

    index += 1;
  }

  return comments;
}

function maskYamlBlockScalars(text) {
  const chars = text.split('');
  let offset = 0;
  let scalarIndent;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    const indent = (line.match(/^[ \t]*/) ?? [''])[0].length;
    const blank = line.trim() === '';

    if (scalarIndent !== undefined) {
      if (blank || indent > scalarIndent) {
        for (let index = offset; index < offset + line.length; index += 1) {
          chars[index] = ' ';
        }
        offset += rawLine.length + 1;
        continue;
      }
      scalarIndent = undefined;
    }

    if (/(?:^|[\s:,-])[|>][+-]?\d*[+-]?(?:\s+#.*)?\s*$/.test(line)) {
      scalarIndent = indent;
    }

    offset += rawLine.length + 1;
  }

  return chars.join('');
}

function hashBoundary(text, index) {
  return index === 0 || /\s/.test(text[index - 1]);
}

function scanComments(text, language) {
  if (language === 'css') {
    return scanGeneric(text, {
      blockStart: '/*',
      blockEnd: '*/',
      quotes: ['"', "'"],
    });
  }

  if (language === 'sql') {
    return scanGeneric(text, {
      lineStart: '--',
      blockStart: '/*',
      blockEnd: '*/',
      quotes: ['"', "'", String.fromCharCode(96)],
      dollarQuotes: true,
    });
  }

  if (language === 'prisma') {
    return scanGeneric(text, {
      lineStart: '//',
      blockStart: '/*',
      blockEnd: '*/',
      quotes: ['"""', "'''", '"', "'"],
    });
  }

  if (language === 'yaml') {
    return scanGeneric(maskYamlBlockScalars(text), {
      lineStart: '#',
      quotes: ['"', "'"],
      lineBoundary: hashBoundary,
    });
  }

  if (language === 'hash') {
    return scanGeneric(text, {
      lineStart: '#',
      quotes: ['"""', "'''", '"', "'", String.fromCharCode(96)],
      lineBoundary: hashBoundary,
    });
  }

  return [];
}

function cleanCommentText(text) {
  return text.replace(/\r$/, '');
}

function isExempt(comment, line, language) {
  const text = cleanCommentText(comment.text);
  const trimmed = text.trimStart();

  if (language === 'typescript' && comment.kind === 'block' && text.startsWith('/**')) {
    return true;
  }

  if (line === 1 && trimmed.startsWith('#!')) {
    return true;
  }

  if (line <= 2 && /\bcoding\s*[:=]/i.test(text)) {
    return true;
  }

  if (line <= 20 && /\bSPDX-License-Identifier:\s*\S+/i.test(text)) {
    return true;
  }

  if (/\bbiome-ignore\b/.test(text)) {
    return true;
  }

  if (/^\/\/\/\s*<reference\b/i.test(text)) {
    return true;
  }

  if (/^\s*\/\/\s*@ts-(?:check|nocheck|ignore|expect-error)\b/i.test(text)) {
    return true;
  }

  if (/^\s*#\s*(?:syntax|escape)\s*=/i.test(text) && line <= 5) {
    return true;
  }

  return /^\s*(?:\/\/|#|--|\/\*)\s*(?:istanbul|c8|coverage)\s+ignore\b/i.test(text);
}

function codeBeforeComment(text, starts, comments, comment) {
  const line = lineNumberAt(starts, comment.start);
  const lineStart = starts[line - 1];
  let prefix = text.slice(lineStart, comment.start);

  for (const previous of comments) {
    if (previous.start >= comment.start) {
      break;
    }

    const previousLine = lineNumberAt(starts, previous.start);
    if (previousLine === line && previous.end <= comment.start) {
      const from = previous.start - lineStart;
      const to = previous.end - lineStart;
      prefix = prefix.slice(0, from) + ' '.repeat(to - from) + prefix.slice(to);
    }
  }

  const compact = prefix.replace(/\s/g, '');
  if (compact === '{') {
    return false;
  }

  return compact.replace(/[[\]();,]/g, '').length > 0;
}

function isUnchangedReplacement(comment, change, language) {
  if (!change.replacements.has(comment.line)) {
    return false;
  }

  const oldLine = change.replacements.get(comment.line);
  const oldComments = language === 'typescript' ? scanTypeScript(oldLine, '.ts') : scanComments(oldLine, language);
  const text = cleanCommentText(comment.text);

  return oldComments.some((oldComment) => {
    return oldComment.kind === comment.kind && cleanCommentText(oldComment.text) === text;
  });
}

function getStagedContent(path) {
  try {
    return git(['show', `:${path}`]);
  } catch {
    return undefined;
  }
}

function checkFile(path, change) {
  if (!change || change.addedLines.size === 0 || isExcluded(path)) {
    return [];
  }

  const language = languageFor(path);
  if (!language) {
    return [];
  }

  const text = getStagedContent(path);
  if (text === undefined) {
    return [];
  }

  const extension = extname(path).toLowerCase();
  const comments = language === 'typescript' ? scanTypeScript(text, extension) : scanComments(text, language);
  const starts = lineStarts(text);
  const findings = [];

  for (const comment of comments) {
    const firstLine = lineNumberAt(starts, comment.start);
    const lastLine = lineNumberAt(starts, Math.max(comment.start, comment.end - 1));
    let added = false;

    for (let line = firstLine; line <= lastLine; line += 1) {
      if (change.addedLines.has(line)) {
        added = true;
        break;
      }
    }

    if (
      !added ||
      isExempt(comment, firstLine, language) ||
      isUnchangedReplacement({ ...comment, line: firstLine }, change, language)
    ) {
      continue;
    }

    const commentText = cleanCommentText(comment.text);
    const multiline = /[\r\n]/.test(commentText);
    const postfix = codeBeforeComment(text, starts, comments, comment);
    const violation = multiline || !postfix || commentText.length > 50;

    if (violation) {
      findings.push({
        comment: commentText,
        line: firstLine,
        path,
      });
    }
  }

  return findings;
}

function main() {
  const statuses = parseStagedPaths(
    git([
      'diff',
      '--cached',
      '--name-status',
      '-z',
      '--diff-filter=ACMR',
      '--find-renames',
      '--find-copies',
      '--find-copies-harder',
      '--no-ext-diff',
      '--',
    ]),
  );

  if (statuses.size === 0) {
    return;
  }

  const changes = parsePatch(
    git([
      'diff',
      '--cached',
      '--unified=0',
      '--diff-filter=ACMR',
      '--find-renames',
      '--find-copies',
      '--find-copies-harder',
      '--no-color',
      '--no-ext-diff',
      '--',
    ]),
  );

  const findings = [];
  for (const [path] of statuses) {
    findings.push(...checkFile(path, changes.get(path)));
  }

  findings.sort((left, right) => {
    if (left.path !== right.path) {
      return left.path < right.path ? -1 : 1;
    }
    if (left.line !== right.line) {
      return left.line - right.line;
    }
    return left.comment < right.comment ? -1 : left.comment > right.comment ? 1 : 0;
  });

  if (findings.length > 0) {
    process.stdout.write(
      MESSAGE +
        '\n' +
        findings
          .map((finding) => {
            const comment = finding.comment.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
            return `${finding.path}:${finding.line}: ${comment}`;
          })
          .join('\n') +
        '\n',
    );
    process.exitCode = 1;
  }
}

main();
