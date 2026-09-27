import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getStateFromPath } from 'expo-router/build/fork/getStateFromPath';
import { getReactNavigationConfig } from 'expo-router/build/getReactNavigationConfig';
import { getRoutes } from 'expo-router/build/getRoutes';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import ChatLayout from '@/app/(app)/(chat)/_layout';
import GanapsLayout from '@/app/(app)/(ganaps)/_layout';
import ProfileLayout from '@/app/(app)/(profile)/_layout';
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

/**
 * Reads the first explicitly configured screen from a stack layout.
 *
 * Expo Router preserves explicitly configured screens ahead of routes it
 * discovers automatically. A stale first screen can therefore make a detail
 * route the stack default even when the generated route tree has another
 * initial route.
 *
 * @param layout - Rendered stack layout element
 * @returns The first configured screen name, or undefined when absent
 */
function firstConfiguredScreenName(layout: ReactElement): string | undefined {
  if (!isValidElement<{ children?: ReactNode }>(layout)) return undefined;

  const firstScreen: ReactNode = Children.toArray(layout.props.children)[0];
  return isValidElement<{ name?: string }>(firstScreen) ? firstScreen.props.name : undefined;
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
    expect(resolve('/(app)/(home)/abc123')).toEqual(['(app)', '(home)', '[ganap-id]']);
  });

  it('opens a Ganap registration form screen', () => {
    expect(resolve('/(app)/(home)/registration/abc123')).toEqual(['(app)', '(home)', 'registration/[ganap-id]']);
  });

  it('builds an object-form registration route with the Ganap parameter', () => {
    expect(Routes.ganapRegistration('abc123')).toEqual({
      pathname: '/(app)/(home)/registration/[ganap-id]',
      params: { 'ganap-id': 'abc123' },
    });
  });

  it('opens the Event Hub screen', () => {
    expect(resolve('/(app)/(home)/event-hub/abc123')).toEqual(['(app)', '(home)', 'event-hub/[ganap-id]']);
  });

  it('opens an Event Chat thread inside the existing chat route group', () => {
    expect(resolve('/(app)/(chat)/event-chat/abc123')).toEqual(['(app)', '(chat)', 'event-chat/[ganap-id]']);
  });

  it('builds an object-form Event Chat route with the Ganap parameter', () => {
    expect(Routes.eventChat('abc123')).toEqual({
      pathname: '/(app)/(chat)/event-chat/[ganap-id]',
      params: { 'ganap-id': 'abc123' },
    });
  });

  it('builds an object-form Event Hub route with the Ganap parameter', () => {
    expect(Routes.eventHub('abc123')).toEqual({
      pathname: '/(app)/(home)/event-hub/[ganap-id]',
      params: { 'ganap-id': 'abc123' },
    });
  });

  it('builds an object-form attendance scanner route with the Ganap parameter', () => {
    expect(Routes.attendanceScan('abc123')).toEqual({
      pathname: '/(app)/(home)/scan/[ganap-id]',
      params: { 'ganap-id': 'abc123' },
    });
  });

  it('opens the welcome screen', () => {
    expect(resolve(pathnameOf(Routes.public.welcome))).toEqual(['(public)', 'index']);
  });

  it('opens the login screen', () => {
    expect(resolve(pathnameOf(Routes.auth.login))).toEqual(['(auth)', 'login']);
  });
});

describe('canonical shared links resolve to their public handoff routes', () => {
  it('routes Friend Code links through the public stack', () => {
    expect(resolve('/friends/0123456789AB')).toEqual(['(public)', 'friends/[code]']);
    expect(Routes.public.friendShare('0123456789AB')).toEqual({
      pathname: '/(public)/friends/[code]',
      params: { code: '0123456789AB' },
    });
  });

  it('routes Ganap links through the public stack', () => {
    expect(resolve('/ganaps/event-123')).toEqual(['(public)', 'ganaps/[id]']);
    expect(Routes.public.ganapShare('event-123')).toEqual({
      pathname: '/(public)/ganaps/[id]',
      params: { id: 'event-123' },
    });
  });

  it('carries share targets through sign-in and opens the existing Add Friend modal', () => {
    expect(Routes.auth.loginForFriendShare('0123456789AB')).toEqual({
      pathname: '/(auth)/login',
      params: { returnFriendCode: '0123456789AB' },
    });
    expect(Routes.friendAddWithCode('0123456789AB')).toEqual({
      pathname: '/(app)/(chat)/chat',
      params: { friendCode: '0123456789AB' },
    });
  });

  it('carries Ganap targets through sign-in', () => {
    expect(Routes.auth.loginForGanapShare('event-123')).toEqual({
      pathname: '/(auth)/login',
      params: { returnGanapId: 'event-123' },
    });
  });
});

describe('tab stack roots', () => {
  it('declares each tab root as the first configured stack screen', (): void => {
    expect(firstConfiguredScreenName(GanapsLayout())).toBe('ganaps');
    expect(firstConfiguredScreenName(ChatLayout())).toBe('chat');
    expect(firstConfiguredScreenName(ProfileLayout())).toBe('profile');
  });
});
