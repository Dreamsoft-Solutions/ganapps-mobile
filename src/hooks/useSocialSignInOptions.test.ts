import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { PlatformOSType } from 'react-native';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import type { SocialSignInOptions } from '@/hooks/useSocialSignInOptions';
import { useSocialSignInOptions } from '@/hooks/useSocialSignInOptions';

jest.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(),
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
}));

type Availability = 'not called' | boolean | 'rejects';

interface Row {
  platform: PlatformOSType;
  appleFlag: boolean;
  availability: Availability;
  googleFlag: boolean;
  showApple: boolean;
  showGoogle: boolean;
}

const rows: Row[] = [
  {
    platform: 'android',
    appleFlag: true,
    availability: 'not called',
    googleFlag: true,
    showApple: false,
    showGoogle: true,
  },
  {
    platform: 'android',
    appleFlag: false,
    availability: 'not called',
    googleFlag: true,
    showApple: false,
    showGoogle: true,
  },
  { platform: 'ios', appleFlag: true, availability: true, googleFlag: true, showApple: true, showGoogle: true },
  { platform: 'ios', appleFlag: true, availability: false, googleFlag: true, showApple: false, showGoogle: false },
  { platform: 'ios', appleFlag: true, availability: 'rejects', googleFlag: true, showApple: false, showGoogle: false },
  {
    platform: 'ios',
    appleFlag: false,
    availability: 'not called',
    googleFlag: true,
    showApple: false,
    showGoogle: false,
  },
  { platform: 'ios', appleFlag: true, availability: true, googleFlag: false, showApple: true, showGoogle: false },
];

const mockUseFeatureFlag: jest.MockedFunction<typeof useFeatureFlag> = jest.mocked(useFeatureFlag);
const mockIsAvailableAsync: jest.MockedFunction<typeof AppleAuthentication.isAvailableAsync> = jest.mocked(
  AppleAuthentication.isAvailableAsync,
);

describe('useSocialSignInOptions', () => {
  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it.each(rows)('$platform apple flag $appleFlag availability $availability google flag $googleFlag', async ({
    platform,
    appleFlag,
    availability,
    googleFlag,
    showApple,
    showGoogle,
  }: Row): Promise<void> => {
    mockUseFeatureFlag.mockImplementation((key: string): boolean =>
      key === 'feature_apple_auth' ? appleFlag : key === 'feature_google_auth' ? googleFlag : false,
    );
    if (availability === 'rejects') {
      mockIsAvailableAsync.mockRejectedValue(new Error('unavailable'));
    } else if (availability !== 'not called') {
      mockIsAvailableAsync.mockResolvedValue(availability);
    }

    const { result } = await renderHook((): SocialSignInOptions => useSocialSignInOptions(platform));

    if (availability === 'not called') {
      expect(mockIsAvailableAsync).not.toHaveBeenCalled();
      expect(result.current).toEqual({ showApple, showGoogle });
      return;
    }

    if (showApple) {
      await waitFor((): void => {
        expect(result.current.showApple).toBe(true);
      });
    } else {
      await waitFor((): void => {
        expect(mockIsAvailableAsync).toHaveBeenCalledTimes(1);
      });
    }
    expect(result.current).toEqual({ showApple, showGoogle });
  });

  it('keeps both buttons hidden on iOS until availability settles', async (): Promise<void> => {
    mockUseFeatureFlag.mockReturnValue(true);
    let resolve: (value: boolean) => void = (): void => undefined;
    mockIsAvailableAsync.mockReturnValue(
      new Promise<boolean>((r: (value: boolean) => void): void => {
        resolve = r;
      }),
    );

    const { result } = await renderHook((): SocialSignInOptions => useSocialSignInOptions('ios'));
    expect(result.current).toEqual({ showApple: false, showGoogle: false });

    resolve(true);
    await waitFor((): void => {
      expect(result.current).toEqual({ showApple: true, showGoogle: true });
    });
  });

  it('treats a rejected availability check as unavailable without an unhandled rejection', async (): Promise<void> => {
    mockUseFeatureFlag.mockReturnValue(true);
    let reject: (reason: Error) => void = (): void => undefined;
    mockIsAvailableAsync.mockReturnValue(
      new Promise<boolean>((_resolve: (value: boolean) => void, r: (reason: Error) => void): void => {
        reject = r;
      }),
    );
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      const { result } = await renderHook((): SocialSignInOptions => useSocialSignInOptions('ios'));
      await act(async (): Promise<void> => {
        reject(new Error('unavailable'));
      });
      await act(async (): Promise<void> => {
        await new Promise<void>((done: () => void): void => {
          setImmediate(done);
        });
      });

      expect(result.current).toEqual({ showApple: false, showGoogle: false });
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
