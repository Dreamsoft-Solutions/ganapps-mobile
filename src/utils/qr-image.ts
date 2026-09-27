/** Result of attempting to save a QR image to the device photo library. */
export type SaveQrImageResult = 'saved' | 'permission-denied';

/** Inputs for saving a captured QR view after requesting write-only photo access. */
export interface SaveQrImageOptions {
  requestWritePermission: () => Promise<boolean>;
  captureImage: () => Promise<string>;
  saveImage: (uri: string) => Promise<void>;
}

/**
 * Captures and saves a QR image only after the user grants photo-library write access.
 *
 * @param options - Permission, capture, and save operations supplied by the native caller
 * @returns Whether the image was saved or permission was denied
 */
export async function saveQrImage(options: SaveQrImageOptions): Promise<SaveQrImageResult> {
  const hasPermission: boolean = await options.requestWritePermission();
  if (!hasPermission) return 'permission-denied';

  const imageUri: string = await options.captureImage();
  await options.saveImage(imageUri);
  return 'saved';
}
