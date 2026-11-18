/** @vitest-environment happy-dom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { ImagePickerAsset, ImagePickerResult } from 'expo-image-picker';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axiosInstance } from '@/api/axios-instance';
import { useChat } from '@/hooks/useChat';
import { useDirectChat } from '@/hooks/useDirectChat';
import { useAuthStore } from '@/store/auth.store';
import type { ChatImageAsset, ChatImageDraft } from '@/types/chat.types';

interface PhotoComposer {
  canSend: boolean;
  imageDraft: ChatImageDraft | null;
  imagePickerError: Error | null;
  isPreparingImage: boolean;
  pickImage: () => Promise<void>;
  sendImage: () => Promise<void>;
  retryImage: () => Promise<void>;
}

const runtime = vi.hoisted(() => ({
  files: new Map<string, { size: number; header: Uint8Array; width: number; height: number }>(),
  pickerResult: null as unknown,
  nativeFatalErrors: [] as string[],
  savedImages: 0,
  jpegBytesPerPixel: 0.4,
  liveImages: 0,
  peakLiveImages: 0,
  composer: null as unknown,
}));

type PhotoFileFormat = 'jpeg' | 'png' | 'webp' | 'gif';

/** Builds the first bytes of a photo file, which the app reads to detect its real format. */
const fileHeader: (format: PhotoFileFormat) => Uint8Array = vi.hoisted(
  (): ((format: PhotoFileFormat) => Uint8Array) =>
    (format: PhotoFileFormat): Uint8Array => {
      const signatures: Record<PhotoFileFormat, string> = {
        jpeg: '\xff\xd8\xff',
        png: '\x89PNG\r\n\x1a\n',
        webp: 'RIFF\0\0\0\0WEBP',
        gif: 'GIF89a',
      };
      const header: Uint8Array = new Uint8Array(32);
      header.set(Array.from(signatures[format], (character: string): number => character.charCodeAt(0)));
      return header;
    },
);

vi.mock('expo-secure-store', () => ({}));
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: async (): Promise<unknown> => runtime.pickerResult,
}));
vi.mock('expo-file-system', () => ({
  File: class {
    readonly uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    get size(): number | null {
      return runtime.files.get(this.uri)?.size ?? null;
    }

    open(): { readBytes: (length: number) => Uint8Array; close: () => void } {
      const header: Uint8Array = runtime.files.get(this.uri)?.header ?? new Uint8Array(32);
      return { readBytes: (length: number): Uint8Array => header.slice(0, length), close: (): void => {} };
    }

    delete(): void {
      runtime.files.delete(this.uri);
    }
  },
}));
vi.mock('expo-image-manipulator', () => {
  type SavedFormat = 'jpeg' | 'png' | 'webp';

  interface FakeImage {
    width: number;
    height: number;
    saveAsync: (options: {
      compress: number;
      format: SavedFormat;
    }) => Promise<{ uri: string; width: number; height: number }>;
    release: () => void;
  }

  interface FakeContext {
    resize: (size: { width?: number; height?: number }) => FakeContext;
    renderAsync: () => Promise<FakeImage>;
    release: () => void;
  }

  /**
   * Holds one decoded bitmap. Like the native image, it counts toward memory until released,
   * releasing it twice is harmless, and reading it after release fails.
   */
  function fakeImage(width: number, height: number): FakeImage {
    let released: boolean = false;
    runtime.liveImages += 1;
    runtime.peakLiveImages = Math.max(runtime.peakLiveImages, runtime.liveImages);
    const assertNotReleased: () => void = (): void => {
      if (released) throw new Error('The image has been released.');
    };
    return {
      get width(): number {
        assertNotReleased();
        return width;
      },
      get height(): number {
        assertNotReleased();
        return height;
      },
      saveAsync: async ({
        compress,
        format,
      }: {
        compress: number;
        format: SavedFormat;
      }): Promise<{ uri: string; width: number; height: number }> => {
        assertNotReleased();
        runtime.savedImages += 1;
        const uri = `file:///cache/ImageManipulator/${runtime.savedImages}.${format === 'jpeg' ? 'jpg' : format}`;
        const size: number = Math.round(width * height * compress * runtime.jpegBytesPerPixel);
        runtime.files.set(uri, { size, header: fileHeader(format), width, height });
        return { uri, width, height };
      },
      release: (): void => {
        if (released) return;
        released = true;
        runtime.liveImages -= 1;
      },
    };
  }

  /**
   * Mirrors native `ImageManipulator.manipulate`. On iOS, expo-modules-core converts a source that
   * is not a string property by property, and reaching a function-valued property ends the process
   * with "Fatal error: Unimplemented" (DS-235). The fake records that instead of letting the
   * hook's catch hide it.
   *
   * @param source - Photo file URI, or whatever else the app passes
   * @returns A context that decodes, and optionally resizes, the stored photo
   */
  function manipulate(source: unknown): FakeContext {
    if (typeof source !== 'string') {
      runtime.nativeFatalErrors.push('ImageManipulator.manipulate received a native image');
      throw new Error('Fatal error: Unimplemented');
    }
    const stored = runtime.files.get(source);
    let width: number = stored?.width ?? 0;
    let height: number = stored?.height ?? 0;
    const context: FakeContext = {
      resize: (size: { width?: number; height?: number }): FakeContext => {
        const ratio: number = width / height;
        if (size.width) [width, height] = [size.width, Math.round(size.width / ratio)];
        else if (size.height) [width, height] = [Math.round(size.height * ratio), size.height];
        return context;
      },
      renderAsync: async (): Promise<FakeImage> => {
        if (!stored || width <= 0) throw new Error('Could not load the image.');
        return fakeImage(width, height);
      },
      release: (): void => {},
    };
    return context;
  }

  return { SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' }, ImageManipulator: { manipulate } };
});
vi.mock('@/services/chat-socket.service', () => ({
  chatSocketClient: {
    getConnectionState: (): string => 'connected',
    onConnectionStateChange: (): (() => void) => () => {},
    onModerationEvent: (): (() => void) => () => {},
    setBeforeJoin: (): (() => void) => () => {},
    subscribe: (): (() => void) => () => {},
    subscribeDirect: (): (() => void) => () => {},
    leaveConversation: (): void => {},
    setDirectFocus: (): void => {},
  },
}));

const HEIC_URI = 'file:///cache/ImagePicker/IMG_0001.heic';
const TIFF_URI = 'file:///cache/ImagePicker/scan.tiff';
const GIF_URI = 'file:///cache/ImagePicker/loop.gif';
const friend = { userId: 'friend-1', username: 'friend', displayName: 'Friend', displayPicture: null };

function heicHeader(): Uint8Array {
  const header: Uint8Array = new Uint8Array(32);
  header.set([0, 0, 0, 0x20]);
  header.set(
    Array.from('ftypheic', (character: string): number => character.charCodeAt(0)),
    4,
  );
  header.set(
    Array.from('mif1miafMiHBheic', (character: string): number => character.charCodeAt(0)),
    16,
  );
  return header;
}

function pick(asset: Partial<ImagePickerAsset> & Pick<ImagePickerAsset, 'uri' | 'width' | 'height'>): void {
  runtime.pickerResult = { canceled: false, assets: [{ type: 'image', ...asset }] } as ImagePickerResult;
}

/** Picks a 24 MP portrait HEIC, the default from an iPhone 15 Pro or later, as the picker reports it. */
function pickRecentIphonePhoto(): void {
  runtime.files.set(HEIC_URI, { size: 1_631_779, header: heicHeader(), width: 4284, height: 5712 });
  pick({
    uri: HEIC_URI,
    width: 4284,
    height: 5712,
    fileName: 'IMG_0001.HEIC',
    mimeType: 'image/heic',
    fileSize: 1_631_779,
  });
}

interface PickedPhoto {
  uri: string;
  format: PhotoFileFormat;
  size: number;
  width: number;
  height: number;
  fileName: string;
  mimeType: string;
}

function pickPhoto(photo: PickedPhoto): void {
  runtime.files.set(photo.uri, {
    size: photo.size,
    header: fileHeader(photo.format),
    width: photo.width,
    height: photo.height,
  });
  pick({
    uri: photo.uri,
    width: photo.width,
    height: photo.height,
    fileName: photo.fileName,
    mimeType: photo.mimeType,
    fileSize: photo.size,
  });
}

/**
 * Checks the file a draft would upload against the chat server's input rules in
 * `chat-media.service.ts`: a JPEG of at most 5 MiB and 20 MP. The app also keeps the long edge
 * within 4096 px, the largest size the server stores.
 */
function expectAcceptedByChatServer(asset: ChatImageAsset | undefined): void {
  const file = runtime.files.get(asset?.uri ?? '');
  if (!asset || !file) throw new Error('The draft has no photo file to upload.');
  expect(asset.mimeType).toBe('image/jpeg');
  expect(Array.from(file.header.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);
  expect(file.size).toBeLessThanOrEqual(5 * 1024 * 1024);
  expect(file.width * file.height).toBeLessThanOrEqual(20_000_000);
  expect(Math.max(file.width, file.height)).toBeLessThanOrEqual(4096);
  expect(asset).toMatchObject({ fileSize: file.size, width: file.width, height: file.height });
}

interface PhotoSize {
  width: number;
  height: number;
}

const PHOTOS_TO_SHRINK: ReadonlyArray<[string, PickedPhoto, PhotoSize]> = [
  [
    'a 24 MP iPhone JPEG over 5 MB',
    {
      uri: 'file:///cache/ImagePicker/IMG_0002.jpg',
      format: 'jpeg',
      size: 10_525_732,
      width: 4284,
      height: 5712,
      fileName: 'IMG_0002.JPG',
      mimeType: 'image/jpeg',
    },
    { width: 3072, height: 4096 },
  ],
  [
    'a 54 MP panorama under 5 MB',
    {
      uri: 'file:///cache/ImagePicker/IMG_0003.jpg',
      format: 'jpeg',
      size: 2_366_285,
      width: 16000,
      height: 3400,
      fileName: 'IMG_0003.JPG',
      mimeType: 'image/jpeg',
    },
    { width: 4096, height: 870 },
  ],
  [
    'a 5184 x 3888 camera JPEG, just over 20 MP',
    {
      uri: 'file:///cache/ImagePicker/P1000123.jpg',
      format: 'jpeg',
      size: 4_718_592,
      width: 5184,
      height: 3888,
      fileName: 'P1000123.JPG',
      mimeType: 'image/jpeg',
    },
    { width: 4096, height: 3072 },
  ],
  [
    'a PNG over 5 MB',
    {
      uri: 'file:///cache/ImagePicker/export.png',
      format: 'png',
      size: 14_680_064,
      width: 4032,
      height: 3024,
      fileName: 'export.png',
      mimeType: 'image/png',
    },
    { width: 4032, height: 3024 },
  ],
  [
    'a WebP over 5 MB',
    {
      uri: 'file:///cache/ImagePicker/download.webp',
      format: 'webp',
      size: 6_291_456,
      width: 3000,
      height: 4000,
      fileName: 'download.webp',
      mimeType: 'image/webp',
    },
    { width: 3000, height: 4000 },
  ],
];

const PHOTOS_TO_KEEP: ReadonlyArray<[string, PickedPhoto]> = [
  [
    'a 12 MP JPEG of 3 MiB',
    {
      uri: 'file:///cache/ImagePicker/IMG_0004.jpg',
      format: 'jpeg',
      size: 3_145_728,
      width: 4032,
      height: 3024,
      fileName: 'IMG_0004.JPG',
      mimeType: 'image/jpeg',
    },
  ],
  [
    'a JPEG of exactly 20 MP and exactly 5 MiB',
    {
      uri: 'file:///cache/ImagePicker/IMG_0006.jpg',
      format: 'jpeg',
      size: 5_242_880,
      width: 5000,
      height: 4000,
      fileName: 'IMG_0006.JPG',
      mimeType: 'image/jpeg',
    },
  ],
];

function respond(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    config,
    data: { success: true, statusCode: 200, data, message: 'OK' },
    status: 200,
    statusText: 'OK',
    headers: {},
  };
}

function sentImage(conversationId: string, clientMessageId: string): unknown {
  return {
    id: clientMessageId,
    conversationId,
    content: '',
    sentAt: '2026-11-18T09:00:00Z',
    senderId: 'viewer',
    senderUsername: 'viewer',
    senderDisplayPicture: null,
    type: 'IMAGE',
    media: { id: 'media-1', url: 'https://example.test/media-1', width: 3072, height: 4096, mimeType: 'image/webp' },
  };
}

const imageSends: { failNext: boolean; attempts: number } = { failNext: false, attempts: 0 };

function chatServer(config: InternalAxiosRequestConfig): AxiosResponse {
  const request = `${config.method} ${config.url}`;
  switch (request) {
    case 'get /me/blocks':
      return respond(config, { items: [], nextCursor: null });
    case 'post /ganaps/ganap-1/chat':
      return respond(config, {
        conversationId: 'event-thread',
        ganapId: 'ganap-1',
        type: 'EVENT',
        capability: 'READ_WRITE',
        canRead: true,
        canSend: true,
        isBusinessOnly: false,
        ganapStatus: 'PUBLISHED',
      });
    case 'get /ganaps/ganap-1/chat/messages':
    case 'get /direct/conversations/thread-1/messages':
      return respond(config, { items: [], nextCursor: null });
    case 'post /ganaps/ganap-1/chat/messages':
    case 'post /direct/conversations/thread-1/messages': {
      imageSends.attempts += 1;
      if (imageSends.failNext) {
        imageSends.failNext = false;
        throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
      }
      const form = config.data as FormData;
      const conversationId: string = request.includes('direct') ? 'thread-1' : 'event-thread';
      return respond(config, sentImage(conversationId, String(form.get('clientMessageId'))));
    }
    default:
      throw new Error(`Unexpected request: ${request}`);
  }
}

function EventChatComposer(): null {
  const chat = useChat('ganap-1');
  runtime.composer = { ...chat, canSend: chat.session?.canSend === true } satisfies PhotoComposer;
  return null;
}

function DirectChatComposer(): null {
  const chat = useDirectChat({
    conversationId: 'thread-1',
    friendUserId: friend.userId,
    friend,
    canRead: true,
    canSend: true,
    focused: true,
  });
  runtime.composer = { ...chat, canSend: true } satisfies PhotoComposer;
  return null;
}

function composer(): PhotoComposer {
  if (!runtime.composer) throw new Error('Chat composer is not mounted');
  return runtime.composer as PhotoComposer;
}

const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
const originalAdapter: typeof axiosInstance.defaults.adapter = axiosInstance.defaults.adapter;
let root: Root | null = null;

beforeEach((): void => {
  useAuthStore.setState({ token: 'integration-token' });
  axiosInstance.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
    chatServer(config);
});

afterEach((): void => {
  root?.unmount();
  root = null;
  client.clear();
  axiosInstance.defaults.adapter = originalAdapter;
  useAuthStore.setState({ token: null });
  runtime.files.clear();
  runtime.pickerResult = null;
  runtime.nativeFatalErrors.length = 0;
  runtime.savedImages = 0;
  runtime.jpegBytesPerPixel = 0.4;
  runtime.liveImages = 0;
  runtime.peakLiveImages = 0;
  runtime.composer = null;
  imageSends.failNext = false;
  imageSends.attempts = 0;
});

async function openComposer(Component: () => null): Promise<void> {
  const container: HTMLDivElement = document.createElement('div');
  root = createRoot(container);
  root.render(createElement(QueryClientProvider, { client }, createElement(Component as () => ReactElement | null)));
  await vi.waitFor((): void => expect(composer().canSend).toBe(true));
}

describe.each([
  ['Event Chat', EventChatComposer],
  ['Direct Chat', DirectChatComposer],
])('%s photo sending', (_chat: string, Component: () => null): void => {
  it('turns a 24 MP iPhone HEIC into a bounded JPEG draft without stopping the app', async (): Promise<void> => {
    await openComposer(Component);
    pickRecentIphonePhoto();

    await composer().pickImage();

    expect(runtime.nativeFatalErrors).toEqual([]);
    await vi.waitFor((): void =>
      expect(composer().imageDraft).toMatchObject({
        status: 'ready',
        asset: { mimeType: 'image/jpeg', width: 3072, height: 4096 },
      }),
    );
    expect(composer().imagePickerError).toBeNull();
  });

  it('releases the full-size decode before shrinking a large photo', async (): Promise<void> => {
    await openComposer(Component);
    pickRecentIphonePhoto();

    await composer().pickImage();

    await vi.waitFor((): void => expect(composer().imageDraft?.status).toBe('ready'));
    expect(runtime.peakLiveImages).toBe(1);
    expect(runtime.liveImages).toBe(0);
  });

  it('shrinks to 2048 px when the 4096 px JPEG is still over 5 MB', async (): Promise<void> => {
    runtime.jpegBytesPerPixel = 1;
    await openComposer(Component);
    pickRecentIphonePhoto();

    await composer().pickImage();

    expect(runtime.nativeFatalErrors).toEqual([]);
    await vi.waitFor((): void =>
      expect(composer().imageDraft).toMatchObject({
        status: 'ready',
        asset: { mimeType: 'image/jpeg', width: 1536, height: 2048 },
      }),
    );
    expect(runtime.liveImages).toBe(0);
  });

  it('keeps the photo draft when a send fails, then sends it on retry', async (): Promise<void> => {
    await openComposer(Component);
    pickRecentIphonePhoto();
    await composer().pickImage();
    await vi.waitFor((): void => expect(composer().imageDraft?.status).toBe('ready'));
    const draft: ChatImageDraft | null = composer().imageDraft;

    imageSends.failNext = true;
    await composer().sendImage();
    await vi.waitFor((): void => expect(composer().imageDraft?.status).toBe('retryable-failure'));
    expect(composer().imageDraft?.asset).toEqual(draft?.asset);
    expect(composer().imageDraft?.clientMessageId).toBe(draft?.clientMessageId);

    await composer().retryImage();
    await vi.waitFor((): void => expect(composer().imageDraft).toBeNull());
    expect(imageSends.attempts).toBe(2);
  });

  it('shows a recoverable message for a file that is not a supported photo', async (): Promise<void> => {
    await openComposer(Component);
    const tiff: Uint8Array = new Uint8Array(32);
    tiff.set([0x49, 0x49, 0x2a, 0x00]);
    runtime.files.set(TIFF_URI, { size: 48_000, header: tiff, width: 800, height: 600 });
    pick({ uri: TIFF_URI, width: 800, height: 600, fileName: 'scan.tiff', mimeType: 'image/tiff', fileSize: 48_000 });

    await composer().pickImage();

    await vi.waitFor((): void =>
      expect(composer().imagePickerError?.message).toBe('Could not use this photo. Choose another photo or try again.'),
    );
    expect(composer().imageDraft).toBeNull();

    pickRecentIphonePhoto();
    await composer().pickImage();
    expect(runtime.nativeFatalErrors).toEqual([]);
    await vi.waitFor((): void => expect(composer().imageDraft?.status).toBe('ready'));
    expect(composer().imagePickerError).toBeNull();
  });

  it.each(PHOTOS_TO_SHRINK)(
    'shrinks %s into a JPEG the chat server accepts',
    async (_photo: string, picked: PickedPhoto, shrunk: PhotoSize): Promise<void> => {
      await openComposer(Component);
      pickPhoto(picked);

      await composer().pickImage();

      expect(runtime.nativeFatalErrors).toEqual([]);
      await vi.waitFor((): void =>
        expect(composer().imageDraft).toMatchObject({ status: 'ready', asset: { mimeType: 'image/jpeg', ...shrunk } }),
      );
      expectAcceptedByChatServer(composer().imageDraft?.asset);
      expect(composer().imagePickerError).toBeNull();
      expect(runtime.peakLiveImages).toBe(1);
      expect(runtime.liveImages).toBe(0);
    },
  );

  it.each(PHOTOS_TO_KEEP)(
    'sends %s as the original file',
    async (_photo: string, picked: PickedPhoto): Promise<void> => {
      await openComposer(Component);
      pickPhoto(picked);

      await composer().pickImage();

      await vi.waitFor((): void =>
        expect(composer().imageDraft).toMatchObject({
          status: 'ready',
          asset: {
            uri: picked.uri,
            name: picked.fileName,
            mimeType: 'image/jpeg',
            fileSize: picked.size,
            width: picked.width,
            height: picked.height,
          },
        }),
      );
      expect(runtime.savedImages).toBe(0);
      expect(runtime.liveImages).toBe(0);
    },
  );

  it('still rejects a GIF over 5 MB instead of converting it', async (): Promise<void> => {
    await openComposer(Component);
    pickPhoto({
      uri: GIF_URI,
      format: 'gif',
      size: 6_291_456,
      width: 800,
      height: 800,
      fileName: 'loop.gif',
      mimeType: 'image/gif',
    });

    await composer().pickImage();

    await vi.waitFor((): void =>
      expect(composer().imagePickerError?.message).toBe('Choose a JPEG, PNG, or WebP image under 5 MiB.'),
    );
    expect(composer().imageDraft).toBeNull();
    expect(runtime.savedImages).toBe(0);
    expect(runtime.peakLiveImages).toBe(0);
  });

  it('still rejects a HEIC sequence instead of converting it', async (): Promise<void> => {
    await openComposer(Component);
    runtime.files.set(HEIC_URI, { size: 2_400_000, header: heicHeader(), width: 4284, height: 5712 });
    pick({
      uri: HEIC_URI,
      width: 4284,
      height: 5712,
      fileName: 'IMG_0005.HEIC',
      mimeType: 'image/heic-sequence',
      fileSize: 2_400_000,
    });

    await composer().pickImage();

    await vi.waitFor((): void =>
      expect(composer().imagePickerError?.message).toBe('Could not use this photo. Choose another photo or try again.'),
    );
    expect(composer().imageDraft).toBeNull();
    expect(runtime.savedImages).toBe(0);
  });
});
