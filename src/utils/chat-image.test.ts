import { describe, expect, it } from '@jest/globals';
import type * as ImagePicker from 'expo-image-picker';
import {
  CHAT_IMAGE_MAX_BYTES,
  CHAT_IMAGE_PICKER_OPTIONS,
  CHAT_IMAGE_VALIDATION_MESSAGE,
  getChatImageErrorMessage,
  getChatImagePrecheckError,
  getChatImageRetryAfterSeconds,
  isChatImageAuthorizationError,
  isRetryableChatImageError,
  toChatImageAsset,
} from './chat-image';

const pickerAsset: ImagePicker.ImagePickerAsset = {
  uri: 'file:///chat-image.jpg',
  width: 1600,
  height: 1200,
  type: 'image',
  fileName: 'chat-image.jpg',
  fileSize: CHAT_IMAGE_MAX_BYTES,
  mimeType: 'image/jpeg',
};

function errorWithMetadata(code: string, retryAfterSeconds?: number): Error {
  return Object.assign(new Error('image request failed'), { errorCode: code, retryAfterSeconds });
}

describe('chat image picker contract', (): void => {
  it('opens the existing library for exactly one image without camera or video options', (): void => {
    expect(CHAT_IMAGE_PICKER_OPTIONS).toMatchObject({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      selectionLimit: 1,
      allowsEditing: false,
      exif: false,
      base64: false,
    });
  });

  it('rejects known disallowed MIME/type and over-limit input at the 5 MiB boundary', (): void => {
    expect(getChatImagePrecheckError({ ...pickerAsset, mimeType: 'image/gif' })).toBe(CHAT_IMAGE_VALIDATION_MESSAGE);
    expect(getChatImagePrecheckError({ ...pickerAsset, fileName: 'clip.mp4', type: 'video' })).toBe(
      CHAT_IMAGE_VALIDATION_MESSAGE,
    );
    expect(getChatImagePrecheckError({ ...pickerAsset, fileSize: CHAT_IMAGE_MAX_BYTES + 1 })).toBe(
      CHAT_IMAGE_VALIDATION_MESSAGE,
    );
    expect(getChatImagePrecheckError(pickerAsset)).toBeNull();
  });

  it('keeps WebP eligible for server-owned animation and decode validation', (): void => {
    const webpAsset: ImagePicker.ImagePickerAsset = {
      ...pickerAsset,
      fileName: 'candidate.webp',
      mimeType: 'image/webp',
    };
    expect(getChatImagePrecheckError(webpAsset)).toBeNull();
    expect(toChatImageAsset(webpAsset)).toMatchObject({ mimeType: 'image/webp', name: 'candidate.webp' });
  });
});

describe('chat image error handling', (): void => {
  it('extracts a positive Retry-After value and gates capacity retries with safe copy', (): void => {
    const error: Error = errorWithMetadata('MEDIA_CAPACITY_EXCEEDED', 2);
    expect(getChatImageRetryAfterSeconds(error)).toBe(2);
    expect(getChatImageErrorMessage(error)).toBe('Images are busy. Try again in 2 seconds.');
    expect(isRetryableChatImageError(error)).toBe(true);
  });

  it('keeps permanent validation and moderation failures out of retry state', (): void => {
    const error: Error = errorWithMetadata('IMAGE_MALFORMED');
    expect(isRetryableChatImageError(error)).toBe(false);
    expect(getChatImageErrorMessage(error)).toBe("This image can't be sent. Choose a different image.");
  });

  it('recognizes signed URL authorization failures without exposing URL details', (): void => {
    expect(isChatImageAuthorizationError('HTTP 403 signature expired')).toBe(true);
    expect(isChatImageAuthorizationError('decode failed')).toBe(false);
  });
});
