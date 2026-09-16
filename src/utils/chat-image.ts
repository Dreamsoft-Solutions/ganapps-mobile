import type * as ImagePicker from 'expo-image-picker';
import type { ChatImageAsset, ChatImageMimeType } from '@/types/chat.types';

/** Maximum input size accepted by the DS-97 multipart image endpoint. */
export const CHAT_IMAGE_MAX_BYTES: number = 5 * 1024 * 1024;

/** Safe validation copy shared by picker prechecks and permanent server rejections. */
export const CHAT_IMAGE_VALIDATION_MESSAGE: string = 'Choose a JPEG, PNG, or WebP image under 5 MiB.';

/** Picker configuration for exactly one existing-library image. */
export const CHAT_IMAGE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsMultipleSelection: false,
  selectionLimit: 1,
  allowsEditing: false,
  exif: false,
  base64: false,
};

/** Retryable server error codes for explicit image-send retries. */
export const CHAT_IMAGE_RETRYABLE_ERROR_CODES: ReadonlyArray<string> = [
  'MEDIA_SCANNER_UNAVAILABLE',
  'MEDIA_CAPACITY_EXCEEDED',
  'IMAGE_PERSISTENCE_FAILED',
  'NETWORK_ERROR',
];

/** Permanent image-send error codes that keep the preview but cannot be retried. */
export const CHAT_IMAGE_PERMANENT_ERROR_CODES: ReadonlyArray<string> = [
  'IMAGE_FILE_REQUIRED',
  'IMAGE_TYPE_NOT_ALLOWED',
  'IMAGE_INPUT_TOO_LARGE',
  'IMAGE_MALFORMED',
  'IMAGE_PIXEL_LIMIT_EXCEEDED',
  'IMAGE_CANONICAL_TOO_LARGE',
  'CONTENT_BLOCKED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CLIENT_MESSAGE_ID_REUSED',
  'FEATURE_DISABLED',
];

interface ImagePickerAssetLike {
  uri: string;
  width: number;
  height: number;
  type?: 'image' | 'video' | 'livePhoto' | 'pairedVideo' | null;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string;
}

/** Returns whether a MIME value is one of the three accepted input formats. */
export function isSupportedChatImageMimeType(value: string | undefined): value is ChatImageMimeType {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function extensionFromName(fileName: string | null | undefined): string {
  const match: RegExpExecArray | null = fileName ? /\.([a-z0-9]+)$/i.exec(fileName) : null;
  return match?.[1]?.toLowerCase() ?? '';
}

function mimeFromExtension(fileName: string | null | undefined): ChatImageMimeType | null {
  const extension: string = extensionFromName(fileName);
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return null;
}

function hasKnownDisallowedType(asset: ImagePickerAssetLike): boolean {
  const mimeType: string = asset.mimeType?.toLowerCase() ?? '';
  const extension: string = extensionFromName(asset.fileName);
  const isKnownDisallowedMime: boolean =
    mimeType === 'image/gif' || mimeType === 'image/heic' || mimeType === 'image/heif' || mimeType.startsWith('video/');
  const isKnownDisallowedExtension: boolean = extension === 'gif' || extension === 'heic' || extension === 'heif';
  return Boolean(asset.type && asset.type !== 'image') || isKnownDisallowedMime || isKnownDisallowedExtension;
}

/**
 * Applies only local, known MIME/type and byte-size checks to a picker asset.
 *
 * The server remains responsible for signatures, decoding, dimensions, and animation.
 * In particular, a WebP is eligible until the server validates it.
 *
 * @param asset - Metadata returned by `expo-image-picker`
 * @returns A safe validation message, or `null` when the asset may be sent
 */
export function getChatImagePrecheckError(asset: ImagePickerAssetLike): string | null {
  const normalizedMimeType: string | undefined = asset.mimeType?.toLowerCase();
  if (hasKnownDisallowedType(asset)) return CHAT_IMAGE_VALIDATION_MESSAGE;
  if (normalizedMimeType && !isSupportedChatImageMimeType(normalizedMimeType)) {
    return CHAT_IMAGE_VALIDATION_MESSAGE;
  }
  if (asset.fileSize !== undefined && asset.fileSize > CHAT_IMAGE_MAX_BYTES) {
    return CHAT_IMAGE_VALIDATION_MESSAGE;
  }
  return null;
}

/**
 * Converts picker metadata into the transport-neutral asset retained by the composer.
 *
 * @param asset - Image picker asset accepted by the local precheck
 * @returns Typed local asset for preview and multipart upload
 */
export function toChatImageAsset(asset: ImagePicker.ImagePickerAsset): ChatImageAsset {
  const mimeType: string =
    asset.mimeType?.toLowerCase() ?? mimeFromExtension(asset.fileName) ?? 'application/octet-stream';
  const extension: string = extensionFromName(asset.fileName);
  const fallbackExtension: string = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const name: string = asset.fileName || `chat-image.${extension || fallbackExtension}`;
  return {
    uri: asset.uri,
    name,
    mimeType,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
  };
}

/**
 * Reads a safe retry-after value from a normalized image error.
 *
 * @param error - Error returned by the mobile API layer
 * @returns Positive delay in seconds, or `null` when no gate applies
 */
export function getChatImageRetryAfterSeconds(error: Error): number | null {
  const candidate: unknown = (error as Error & { retryAfterSeconds?: unknown }).retryAfterSeconds;
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0 ? Math.ceil(candidate) : null;
}

/** Returns the normalized server error code when one is present. */
export function getChatImageErrorCode(error: Error): string | undefined {
  const candidate: unknown = (error as Error & { errorCode?: unknown }).errorCode;
  return typeof candidate === 'string' ? candidate : undefined;
}

/**
 * Identifies the private-media load failures that can indicate an expired signed URL.
 *
 * @param error - Native image-loader error text
 * @returns Whether the error looks like an authorization or expiry response
 */
export function isChatImageAuthorizationError(error: string): boolean {
  const normalized: string = error.toLowerCase();
  return (
    /\b401\b/.test(normalized) ||
    /\b403\b/.test(normalized) ||
    normalized.includes('unauthor') ||
    normalized.includes('forbidden') ||
    normalized.includes('expired') ||
    normalized.includes('signature')
  );
}

/**
 * Identifies errors safe to retry with the same client message id.
 *
 * @param error - Normalized image-send error
 * @returns Whether the composer should retain an explicit retry action
 */
export function isRetryableChatImageError(error: Error): boolean {
  const errorCode: string | undefined = getChatImageErrorCode(error);
  if (errorCode && CHAT_IMAGE_RETRYABLE_ERROR_CODES.includes(errorCode)) return true;
  if (errorCode && CHAT_IMAGE_PERMANENT_ERROR_CODES.includes(errorCode)) return false;
  const status: unknown = (error as Error & { status?: unknown }).status;
  return status === undefined || (typeof status === 'number' && status >= 500);
}

/**
 * Maps image-send failures to non-disclosing composer copy.
 *
 * @param error - Normalized image-send error
 * @returns User-facing copy that never includes private media details
 */
export function getChatImageErrorMessage(error: Error): string {
  const errorCode: string | undefined = getChatImageErrorCode(error);
  if (errorCode === 'MEDIA_CAPACITY_EXCEEDED') {
    const retryAfterSeconds: number | null = getChatImageRetryAfterSeconds(error);
    return retryAfterSeconds === null
      ? 'Images are busy. Try again shortly.'
      : `Images are busy. Try again in ${retryAfterSeconds} seconds.`;
  }
  if (isRetryableChatImageError(error)) return "Image couldn't be sent. Check your connection and try again.";
  return "This image can't be sent. Choose a different image.";
}
