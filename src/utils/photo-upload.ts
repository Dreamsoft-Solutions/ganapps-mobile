import { File } from 'expo-file-system';
import { ImageManipulator, type ImageRef, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

const MAX_PHOTO_BYTES: number = 5 * 1024 * 1024;
const MAX_PHOTO_EDGE: number = 4096;
const JPEG_QUALITIES: readonly number[] = [0.8, 0.65, 0.5];

function extension(value: string | null | undefined): string {
  const path: string = value?.split(/[?#]/, 1)[0] ?? '';
  return /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? '';
}

function isHeifExtension(value: string | null | undefined): boolean {
  const suffix: string = extension(value);
  return suffix === 'heic' || suffix === 'heif' || suffix === 'hif';
}

type PhotoFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'heif' | 'heif-sequence' | 'unsupported' | 'unknown';

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function photoFormatFromFtyp(bytes: Uint8Array): PhotoFormat | null {
  if (ascii(bytes, 4, 8) !== 'ftyp') return null;
  const brands: string[] = [];
  for (let offset: number = 8; offset + 4 <= bytes.length; offset += 4) {
    if (offset !== 12) brands.push(ascii(bytes, offset, offset + 4));
  }
  if (brands.includes('avif') || brands.includes('avis')) return 'unsupported';
  if (brands.some((brand: string): boolean => ['hevc', 'hevx', 'hevm', 'hevs', 'msf1'].includes(brand))) {
    return 'heif-sequence';
  }
  return brands.some((brand: string): boolean => ['heic', 'heix', 'heim', 'heis', 'mif1'].includes(brand))
    ? 'heif'
    : 'unsupported';
}

function photoFormatFromHeader(bytes: Uint8Array): PhotoFormat {
  const containerFormat: PhotoFormat | null = photoFormatFromFtyp(bytes);
  if (containerFormat) return containerFormat;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) return 'gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 2) === 'BM' || ascii(bytes, 0, 4) === 'II*\x00' || ascii(bytes, 0, 4) === 'MM\x00*') {
    return 'unsupported';
  }
  return 'unknown';
}

function inspectPhoto(asset: ImagePickerAsset): { format: PhotoFormat; fileSize: number } {
  const file: File = new File(asset.uri);
  const fileSize: number | null = file.size;
  if (fileSize === null || fileSize <= 0) throw new Error('Could not read the photo.');
  const handle = file.open();
  try {
    const header: Uint8Array = handle.readBytes(32);
    const format: PhotoFormat = asset.mimeType?.toLowerCase().endsWith('-sequence')
      ? 'heif-sequence'
      : photoFormatFromHeader(header);
    return { format, fileSize };
  } finally {
    handle.close();
  }
}

function hasHeifMetadata(asset: ImagePickerAsset): boolean {
  const mimeType: string = asset.mimeType?.toLowerCase() ?? '';
  return (
    mimeType === 'image/heic' ||
    mimeType === 'image/heif' ||
    isHeifExtension(asset.uri) ||
    isHeifExtension(asset.fileName)
  );
}

function mimeFromExtension(value: string | null | undefined): string | undefined {
  const suffix: string = extension(value);
  if (suffix === 'jpg' || suffix === 'jpeg') return 'image/jpeg';
  if (suffix === 'png') return 'image/png';
  if (suffix === 'webp') return 'image/webp';
  if (suffix === 'gif') return 'image/gif';
  return undefined;
}

function filenameForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'photo.png';
  if (mimeType === 'image/webp') return 'photo.webp';
  if (mimeType === 'image/gif') return 'photo.gif';
  return 'photo.jpg';
}

function mimeForPhotoFormat(
  format: Exclude<PhotoFormat, 'heif' | 'heif-sequence' | 'unsupported' | 'unknown'>,
): string {
  return `image/${format}`;
}

function photoMimeType(asset: ImagePickerAsset): string {
  const declaredMime: string = asset.mimeType?.toLowerCase() ?? '';
  if (declaredMime === 'image/jpg') return 'image/jpeg';
  if (declaredMime && declaredMime !== 'application/octet-stream') return declaredMime;
  return mimeFromExtension(asset.uri) ?? mimeFromExtension(asset.fileName) ?? '';
}

async function saveJpegWithinLimit(image: ImageRef, asset: ImagePickerAsset): Promise<ImagePickerAsset | null> {
  for (const quality of JPEG_QUALITIES) {
    const output = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    const file: File = new File(output.uri);
    const fileSize: number = file.size ?? 0;
    if (fileSize <= 0) throw new Error('Could not read the converted photo.');
    if (fileSize <= MAX_PHOTO_BYTES) {
      return {
        ...asset,
        uri: output.uri,
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize,
        width: output.width,
        height: output.height,
      };
    }
    file.delete();
  }
  return null;
}

async function convertHeifPhoto(asset: ImagePickerAsset): Promise<ImagePickerAsset> {
  const original: ImageRef = await ImageManipulator.manipulate(asset.uri).renderAsync();
  const longestEdge: number = Math.max(original.width, original.height);
  if (longestEdge <= 0) throw new Error('Could not read the photo.');
  const firstEdge: number = Math.min(longestEdge, MAX_PHOTO_EDGE);
  const edges: number[] = [firstEdge, 2048, 1024].filter(
    (edge: number, index: number, values: number[]): boolean => edge <= firstEdge && values.indexOf(edge) === index,
  );

  for (const edge of edges) {
    const image: ImageRef =
      edge < longestEdge
        ? await ImageManipulator.manipulate(original)
            .resize(original.width >= original.height ? { width: edge } : { height: edge })
            .renderAsync()
        : original;
    const prepared: ImagePickerAsset | null = await saveJpegWithinLimit(image, asset);
    if (prepared) return prepared;
  }
  throw new Error('Photo is too large.');
}

/**
 * Converts a selected HEIC or HEIF photo to a bounded JPEG for upload.
 *
 * @param asset - Photo returned by the native image picker
 * @returns The original supported photo or a JPEG with matching metadata
 * @throws When the photo cannot be decoded or reduced to the upload limit
 */
export async function prepareUploadPhoto(asset: ImagePickerAsset): Promise<ImagePickerAsset> {
  const inspected: { format: PhotoFormat; fileSize: number } = inspectPhoto(asset);
  if (inspected.format === 'heif-sequence') throw new Error('Choose a still photo.');
  if (inspected.format === 'heif' || (inspected.format === 'unknown' && hasHeifMetadata(asset))) {
    return convertHeifPhoto(asset);
  }
  if (inspected.format === 'unknown' || inspected.format === 'unsupported') {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF photo.');
  }
  const mimeType: string = mimeForPhotoFormat(inspected.format);
  const extensionMatchesFormat: boolean =
    (mimeType === 'image/jpeg' && ['jpg', 'jpeg'].includes(extension(asset.fileName))) ||
    (mimeType === 'image/png' && extension(asset.fileName) === 'png') ||
    (mimeType === 'image/webp' && extension(asset.fileName) === 'webp') ||
    (mimeType === 'image/gif' && extension(asset.fileName) === 'gif');
  return {
    ...asset,
    mimeType,
    fileName:
      asset.fileName && (!extension(asset.fileName) || extensionMatchesFormat)
        ? asset.fileName
        : filenameForMime(mimeType),
    fileSize: inspected.fileSize,
  };
}

/**
 * Builds native multipart metadata from the selected profile photo.
 *
 * @param asset - Prepared photo returned by the picker
 * @returns URI, filename, and MIME type for the profile upload
 */
export function profilePhotoFile(asset: ImagePickerAsset): { uri: string; name: string; type: string } {
  const type: string = photoMimeType(asset) || 'image/jpeg';
  return { uri: asset.uri, name: filenameForMime(type), type };
}
