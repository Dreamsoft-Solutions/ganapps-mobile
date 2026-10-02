import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const files = new Set(
  execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean),
);
const docs = [...files].filter(
  (file) =>
    /^(?:AGENTS|CLAUDE|README|CONTEXT(?:-MAP)?)\.md$/i.test(file) ||
    /^docs\/(?:agents\/.*|architecture\/[^/]+|adr\/README)\.md$/i.test(file),
);

function prose(text) {
  let fence = '';
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
    .map((line) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = '';
        return '';
      }
      return fence ? '' : line;
    })
    .join('\n');
}

function anchors(text) {
  const counts = new Map();
  return new Set(
    [...prose(text).matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*$/gm)].map((match) => {
      const slug = match[1]
        .replace(/<[^>]*>/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, '')
        .replace(/ /g, '-');
      const count = counts.get(slug) ?? 0;
      counts.set(slug, count + 1);
      return count ? `${slug}-${count}` : slug;
    }),
  );
}

const failures = []; // ponytail: inline/ATX; parser for richer Markdown
for (const file of docs) {
  const text = prose(readFileSync(resolve(root, file), 'utf8'));
  for (const match of text.matchAll(
    /!?\[(?:[^[\]\n]|\[[^\]\n]*\])*\]\((<[^>\n]+>|(?:[^()\s]|\([^()\n]*\))+)(?:\s+"[^"]*")?\)/g,
  )) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
    try {
      const [pathname, fragment] = href.split('#');
      const target = resolve(dirname(resolve(root, file)), decodeURIComponent(pathname.split('?')[0] || '.'));
      const local = pathname ? relative(root, target).split(sep).join('/') : file;
      if (local === '..' || local.startsWith('../')) continue;
      const isFile = files.has(local);
      if (!isFile && ![...files].some((entry) => entry.startsWith(`${local}/`))) {
        failures.push(`${file}: ${href}: missing path or incorrect filename case`);
      } else if (
        fragment &&
        isFile &&
        /\.md$/i.test(local) &&
        !anchors(readFileSync(resolve(root, local), 'utf8')).has(decodeURIComponent(fragment))
      ) {
        failures.push(`${file}: ${href}: missing anchor`);
      }
    } catch (error) {
      failures.push(`${file}: ${href}: ${error.message}`);
    }
  }
}
if (!docs.length) failures.push('No navigation documents found');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${docs.length} navigation documents (sibling/workspace links are optional).`);
}
