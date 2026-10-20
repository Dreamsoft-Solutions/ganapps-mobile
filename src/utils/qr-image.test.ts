import { saveQrImage } from './qr-image';

describe('saveQrImage', (): void => {
  it('does not capture or save when photo access is denied', async (): Promise<void> => {
    const calls: string[] = [];

    const result = await saveQrImage({
      requestWritePermission: async (): Promise<boolean> => {
        calls.push('permission');
        return false;
      },
      captureImage: async (): Promise<string> => {
        calls.push('capture');
        return 'file:///qr.png';
      },
      saveImage: async (uri: string): Promise<void> => {
        calls.push(`save:${uri}`);
      },
    });

    expect(result).toBe('permission-denied');
    expect(calls).toEqual(['permission']);
  });

  it('captures and saves the image after photo access is granted', async (): Promise<void> => {
    const calls: string[] = [];

    const result = await saveQrImage({
      requestWritePermission: async (): Promise<boolean> => {
        calls.push('permission');
        return true;
      },
      captureImage: async (): Promise<string> => {
        calls.push('capture');
        return 'file:///qr.png';
      },
      saveImage: async (uri: string): Promise<void> => {
        calls.push(`save:${uri}`);
      },
    });

    expect(result).toBe('saved');
    expect(calls).toEqual(['permission', 'capture', 'save:file:///qr.png']);
  });
});
