import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

type Files = Record<string, string>;

type ScenarioOptions = {
  base?: Files;
  copy?: [string, string];
  rename?: [string, string];
  unstaged?: Files;
};

type CheckResult = {
  status: number | null;
  stderr: string;
  stdout: string;
};

const checkerPath = join(process.cwd(), 'scripts', 'check-standalone-comments.mjs');
jest.setTimeout(30_000);

function isolatedGitEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^GIT_/i.test(key)) delete env[key];
  }
  return env;
}

function git(root: string, args: string[]): void {
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: isolatedGitEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeFiles(root: string, files: Files): void {
  for (const [file, content] of Object.entries(files)) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
  }
}

function runCheck(staged: Files, options: ScenarioOptions = {}): CheckResult {
  const root = mkdtempSync(join(tmpdir(), 'ganapps-standalone-comments-'));

  try {
    writeFiles(root, { 'README.md': 'base\n', ...options.base });
    git(root, ['init', '--quiet']);
    git(root, ['add', '--all']);
    git(root, [
      '-c',
      'user.name=Comment Linter Test',
      '-c',
      'user.email=comment-linter@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--quiet',
      '-m',
      'initial',
    ]);

    if (options.rename) {
      git(root, ['mv', options.rename[0], options.rename[1]]);
    }
    if (options.copy) {
      const destination = join(root, options.copy[1]);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(root, options.copy[0]), destination);
    }

    writeFiles(root, staged);
    git(root, ['add', '--all', '--']);
    writeFiles(root, options.unstaged ?? {});

    const result = spawnSync(process.execPath, [checkerPath], {
      cwd: root,
      encoding: 'utf8',
      env: isolatedGitEnvironment(),
    });

    return {
      status: result.status,
      stderr: result.stderr ?? '',
      stdout: result.stdout ?? '',
    };
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

describe('standalone comment checker', () => {
  it('allows documentation in environment files without exempting shell scripts', () => {
    const result = runCheck({
      '.env': '# Local environment\nAPP_ENV=local\n',
      '.env.example': '# Public HTTPS pages, required in the EAS production environment.\nPRIVACY_URL=\n',
      'config/.env.production': '# Production configuration\nAPP_ENV=production\n',
      'scripts/env.sh': '# explain\nvalue=1\n',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('scripts/env.sh:1: # explain');
    expect(result.stdout).not.toContain('.env');
    expect(result.stderr).toBe('');
  });

  it('exits zero without output for comment-free staged code', () => {
    const result = runCheck({ 'src/example.ts': 'const value = 1;\n' });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('blocks a newly added standalone one-line comment', () => {
    const result = runCheck({ 'src/example.ts': '// explain this\nconst value = 1;\n' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('src/example.ts:1: // explain this');
  });

  it('blocks consecutive standalone comments', () => {
    const result = runCheck({ 'src/example.ts': '// first\n// second\nconst value = 1;\n' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('src/example.ts:1: // first');
    expect(result.stdout).toContain('src/example.ts:2: // second');
  });

  it('blocks standalone hash and double-hyphen comments', () => {
    const result = runCheck({
      'scripts/run.sh': '# explain\nvalue=1\n',
      'config/settings.yml': '# explain\nvalue: 1\n',
      'db/query.sql': '-- explain\nSELECT 1;\n',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('scripts/run.sh:1: # explain');
    expect(result.stdout).toContain('config/settings.yml:1: # explain');
    expect(result.stdout).toContain('db/query.sql:1: -- explain');
  });

  it('blocks standalone block and triple-slash comments', () => {
    const result = runCheck({
      'src/example.ts': '/* block */\n/// documentation\nconst value = 1;\n',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('src/example.ts:1: /* block */');
    expect(result.stdout).toContain('src/example.ts:2: /// documentation');
  });

  it('allows standalone TSDoc comments', () => {
    const result = runCheck({
      'src/example.ts': '/**\n * Documents the value.\n */\nconst value = 1;\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('allows a short postfix comment', () => {
    const result = runCheck({ 'src/example.ts': 'const value = 1; // short\n' });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('allows a postfix comment of exactly 50 characters', () => {
    const comment = `// ${'x'.repeat(47)}`;
    expect(comment).toHaveLength(50);

    const result = runCheck({ 'src/example.ts': `const value = 1; ${comment}\n` });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('blocks a postfix comment of 51 characters', () => {
    const comment = `// ${'x'.repeat(48)}`;
    expect(comment).toHaveLength(51);

    const result = runCheck({ 'src/example.ts': `const value = 1; ${comment}\n` });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`src/example.ts:1: ${comment}`);
  });

  it('blocks a multi-line postfix block comment', () => {
    const result = runCheck({ 'src/example.ts': 'const url = "http://code"; /* start\ncontinued */\n' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('src/example.ts:1: /* start\\ncontinued */');
  });

  it('ignores comment markers inside strings, templates, regular expressions, and SQL strings', () => {
    const result = runCheck({
      'src/example.ts': String.raw`const url = "http://code";
const template = \`/* template */\`;
const regex = /\/\/ inside|\/\* inside/;
`,
      'db/query.sql': "SELECT '-- inside', '/* inside */', 'http://code';\n",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('supports the repository source languages and ignores YAML block scalar content', () => {
    const result = runCheck({
      'src/styles.css': 'body { color: red; /* short */ }\n',
      'db/query.sql': 'SELECT 1; -- short\n',
      'prisma/schema.prisma': 'model User { id String @id } // short\n',
      'config/settings.yml': 'command: |\n  # block scalar content\n  echo ready\nversion: 1 # short\n',
      'scripts/run.sh': '#!/bin/sh\nvalue=1 # short\n',
      Dockerfile: 'FROM node:22 # short\n',
      'config/settings.toml': 'value = "ready" # short\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('allows verified directives, shebangs, encoding declarations, and generated paths', () => {
    const result = runCheck({
      'src/directives.ts':
        '// biome-ignore lint/suspicious/noExplicitAny: required\n// @ts-expect-error required\nconst value: any = 1;\n',
      'src/types.d.ts': '/// <reference types="node" />\n',
      'src/encoded.ts': '// -*- coding: utf-8 -*-\nconst value = 1;\n',
      'scripts/runner.sh': '#!/usr/bin/env node\nvalue=1\n',
      'README.md': '# documentation comment\n',
      'drizzle/0002_generated.sql': '-- generated migration\n--> statement-breakpoint\n',
      'dist/generated.js': '// generated output\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('does not report unchanged pre-existing comments', () => {
    const result = runCheck(
      { 'src/example.ts': '// existing\nconst value = 2;\n' },
      { base: { 'src/example.ts': '// existing\nconst value = 1;\n' } },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('inspects staged content without reporting unstaged comments', () => {
    const result = runCheck(
      { 'src/example.ts': 'const value = 1;\n' },
      { unstaged: { 'src/example.ts': 'const value = 1;\n// unstaged\n' } },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('handles added, copied, modified, and renamed paths', () => {
    const result = runCheck(
      {
        'src/renamed.ts': 'const renamed = 1;\n// renamed finding\n',
        'src/copied.ts': 'const copied = 1;\n// copied finding\n',
        'src/added.ts': 'const added = 1;\n// added finding\n',
        'src/modified.ts': 'const modified = 2; // existing\n// modified finding\n',
      },
      {
        base: {
          'src/old.ts': 'const renamed = 1;\n',
          'src/source.ts': 'const copied = 1;\n',
          'src/modified.ts': 'const modified = 1; // existing\n',
        },
        copy: ['src/source.ts', 'src/copied.ts'],
        rename: ['src/old.ts', 'src/renamed.ts'],
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('src/renamed.ts:2: // renamed finding');
    expect(result.stdout).toContain('src/copied.ts:2: // copied finding');
    expect(result.stdout).toContain('src/added.ts:2: // added finding');
    expect(result.stdout).toContain('src/modified.ts:2: // modified finding');
  });

  it('reports every finding with accurate paths and line numbers and prints the sentence once', () => {
    const sentence = 'If you think you need a comment to explain this code, you need to write clearer code.';
    const result = runCheck({
      'src/one.ts': 'const one = 1;\n// first\n',
      'src/two.sql': '-- second\nSELECT 2;\n',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`${sentence}\n`);
    expect(result.stdout).toContain('src/one.ts:2: // first');
    expect(result.stdout).toContain('src/two.sql:1: -- second');
    expect(result.stdout.match(new RegExp(sentence, 'g'))).toHaveLength(1);
    expect(result.stderr).toBe('');
  });
});
