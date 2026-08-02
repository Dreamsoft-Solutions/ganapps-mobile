import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getStateFromPath } from 'expo-router/build/fork/getStateFromPath';
import { getReactNavigationConfig } from 'expo-router/build/getReactNavigationConfig';
import { getRoutes } from 'expo-router/build/getRoutes';
import { Routes } from './routes';

const APP_DIR: string = join(__dirname, '..', 'app');

/**
 * Lists the route files under `src/app/`, in the shape Metro's `require.context`
 * reports them (`'./(app)/(home)/index.tsx'`).
 *
 * Read from disk rather than hand-listed on purpose: a hardcoded list would let these
 * tests pass against a tree the app does not have, which is precisely the failure this
 * suite exists to catch.
 *
 * @param dir - Directory to walk. Recurses into subdirectories.
 * @returns Context keys, sorted.
 */
function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listRouteFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      // Metro context keys use POSIX separators even when tests run on Windows.
      out.push(`./${relative(APP_DIR, full).replaceAll('\\', '/')}`);
    }
  }
  return out.sort();
}

/**
 * Minimal stand-in for a Metro require.context over `src/app/`.
 *
 * @returns A callable with the `keys`/`resolve`/`id` properties expo-router expects.
 */
function makeContext(): any {
  const ctx = (_key: string): unknown => ({ default: (): null => null });
  ctx.keys = (): string[] => listRouteFiles(APP_DIR);
  ctx.resolve = (key: string): string => key;
  ctx.id = 'routes-test';
  return ctx;
}

/**
 * Resolves a URL through expo-router's real matcher and returns the focused
 * route as a list of segments.
 *
 * @param url - The URL to resolve, as the app would receive it on launch or via a deep link.
 * @returns The focused route's segments, outermost first.
 */
function resolve(url: string): string[] {
  const tree = getRoutes(makeContext(), { platform: 'android' });
  const config = getReactNavigationConfig(tree as any, true);
  const state = getStateFromPath(url, config as any);

  const segments: string[] = [];
  let node: any = state;
  while (node?.routes?.length) {
    const route = node.routes[node.index ?? node.routes.length - 1];
    segments.push(route.name);
    node = route.state;
  }
  return segments;
}

/**
 * Reads the `pathname` out of an object-form entry in the route table.
 *
 * @param href - An entry from {@link Routes}, always written in object form.
 * @returns The pathname string.
 */
function pathnameOf(href: any): string {
  return href.pathname;
}

describe('cold-start route resolution (DS-34)', () => {
  it('resolves the launch URL to the Map tab', () => {
    expect(resolve('/')).toEqual(['(app)', '(home)', 'index']);
  });
});

describe('route table entries resolve to their screens', () => {
  it('opens the Map tab', () => {
    expect(resolve(pathnameOf(Routes.app.home))).toEqual(['(app)', '(home)', 'index']);
  });

  it('opens the Events tab', () => {
    expect(resolve(pathnameOf(Routes.app.ganaps))).toEqual(['(app)', '(ganaps)', 'ganaps']);
  });

  it('opens the Chat tab', () => {
    expect(resolve(pathnameOf(Routes.app.chat))).toEqual(['(app)', '(chat)', 'chat']);
  });

  it('opens the Profile tab', () => {
    expect(resolve(pathnameOf(Routes.app.profile))).toEqual(['(app)', '(profile)', 'profile']);
  });

  it('opens a Ganap detail screen', () => {
    expect(resolve('/(app)/(ganaps)/abc123')).toEqual(['(app)', '(ganaps)', '[ganap-id]']);
  });

  it('opens the welcome screen', () => {
    expect(resolve(pathnameOf(Routes.public.welcome))).toEqual(['(public)', 'index']);
  });

  it('opens the login screen', () => {
    expect(resolve(pathnameOf(Routes.auth.login))).toEqual(['(auth)', 'login']);
  });
});
