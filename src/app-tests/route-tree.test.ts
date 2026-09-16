import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';

function collectRouteTreeTestFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry): string[] => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectRouteTreeTestFiles(entryPath);
    return /\.test\.[cm]?[jt]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

describe('Expo Router route tree', (): void => {
  it('contains route modules only, keeping Jest tests outside src/app', (): void => {
    const appDirectory = join(__dirname, '..', 'app');

    expect(collectRouteTreeTestFiles(appDirectory)).toEqual([]);
  });
});
