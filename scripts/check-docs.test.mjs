import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('navigation links fail on missing paths, filename case, and anchors', () => {
  const root = mkdtempSync(join(tmpdir(), 'ganapps-docs-'));
  try {
    mkdirSync(join(root, 'docs'));
    writeFileSync(join(root, 'docs', 'Guide.md'), '## First & Last\n## Repeat\n## Repeat\n');
    writeFileSync(join(root, 'AGENTS.md'), '# Agent guide\n');
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    const checker = fileURLToPath(new URL('./check-docs.mjs', import.meta.url));
    const valid =
      '[guide](docs/Guide.md#first--last)\n[repeat](docs/Guide.md#repeat-1)\n' +
      '[directory](docs/)\n[web](https://example.com)\n[sibling](../ganapps-server/AGENTS.md)\n' +
      '```md\n[example](missing.md)\n```\n';
    for (const [content, status, diagnostic] of [
      [valid, 0, 'Checked 1 navigation document'],
      ['[bad](missing.md)', 1, 'missing path or incorrect filename case'],
      ['[case](docs/guide.md)', 1, 'missing path or incorrect filename case'],
      ['[anchor](docs/Guide.md#missing)', 1, 'missing anchor'],
      ['[case](Docs/)', 1, 'missing path or incorrect filename case'],
    ]) {
      writeFileSync(join(root, 'AGENTS.md'), content);
      const result = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, status, result.stdout + result.stderr);
      assert.match(result.stdout + result.stderr, new RegExp(diagnostic));
    }
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'ganapps-docs-')));
    rmSync(root, { recursive: true, force: true });
  }
});
