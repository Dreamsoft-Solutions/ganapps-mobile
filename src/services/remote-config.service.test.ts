interface MockRemoteConfigInstance {
  fetchAndActivate: jest.Mock;
  getValue: jest.Mock;
  setConfigSettings: jest.Mock;
  setDefaults: jest.Mock;
}

const mockGetValue: jest.Mock = jest.fn();
const mockRemoteConfigInstance: MockRemoteConfigInstance = {
  fetchAndActivate: jest.fn().mockResolvedValue(true),
  getValue: mockGetValue,
  setConfigSettings: jest.fn(),
  setDefaults: jest.fn(),
};

jest.mock('@react-native-firebase/remote-config', () => ({
  __esModule: true,
  default: () => mockRemoteConfigInstance,
}));

import { remoteConfigService } from './remote-config.service';

describe('RemoteConfigService', () => {
  const originalEnv = { ...process.env };

  afterAll((): void => {
    process.env = originalEnv;
  });

  it('loads feature values from the selected mobile JSON parameter', async (): Promise<void> => {
    process.env.EXPO_PUBLIC_FEATURE_FLAG_REMOTE_CONFIG_PARAMETER = 'mobile_dev';
    mockGetValue.mockImplementation((parameterName: string) => ({
      asString: (): string =>
        JSON.stringify(
          parameterName === 'mobile_default'
            ? { feature_google_auth: true, numeric_flag: 12 }
            : { feature_google_auth: false, string_flag: 'remote' },
        ),
    }));

    await remoteConfigService.initialize();

    expect(mockGetValue).toHaveBeenNthCalledWith(1, 'mobile_default');
    expect(mockGetValue).toHaveBeenNthCalledWith(2, 'mobile_dev');
    expect(remoteConfigService.getBoolean('feature_google_auth', true)).toBe(false);
    expect(remoteConfigService.getNumber('numeric_flag')).toBe(12);
    expect(remoteConfigService.getString('string_flag')).toBe('remote');

    process.env.EXPO_PUBLIC_FEATURE_FLAG_FEATURE_GOOGLE_AUTH = 'true';
    expect(remoteConfigService.getBoolean('feature_google_auth', false)).toBe(true);
  });
});
