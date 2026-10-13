import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

type BuildPropertiesIos = {
  useFrameworks?: string;
  usePrecompiledModules?: boolean;
  forceStaticLinking?: string[];
};

type PluginOptions = {
  ios?: BuildPropertiesIos;
  motionUsagePermission?: string | false;
  photosPermission?: string | false;
};

type PluginEntry = string | [string, PluginOptions?];

type IntentFilter = {
  action: string;
  autoVerify?: boolean;
  data: Array<{ scheme?: string; host?: string; pathPrefix?: string }>;
  category?: string[];
};

type AccessedApiType = { NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] };

type AppConfig = {
  expo: {
    scheme: string;
    userInterfaceStyle: string;
    plugins: PluginEntry[];
    ios: {
      associatedDomains?: string[];
      config?: { usesNonExemptEncryption?: boolean };
      privacyManifests?: { NSPrivacyAccessedAPITypes?: AccessedApiType[] };
    };
    android: { intentFilters?: IntentFilter[] };
  };
};

type PackageManifest = { dependencies: Record<string, string> };

type AutolinkPlatform = 'ios' | 'android';

type AutolinkedDependency = {
  platforms: Partial<Record<AutolinkPlatform, { podspecPath?: string } | null>>;
};

type ReactNativeAutolinkingConfig = { dependencies: Record<string, AutolinkedDependency> };

const { expo } = jest.requireActual<AppConfig>('./app.config');
const manifest = jest.requireActual<PackageManifest>('./package.json');

const FIREBASE_SCOPE = '@react-native-firebase/';
const FIREBASE_ANALYTICS = '@react-native-firebase/analytics';
const FIREBASE_REMOTE_CONFIG = '@react-native-firebase/remote-config';
const PODSPEC_SUFFIX = '.podspec';

function pluginOptions(name: string): PluginOptions | undefined {
  const entry = expo.plugins.find((plugin: PluginEntry): boolean => Array.isArray(plugin) && plugin[0] === name);
  return Array.isArray(entry) ? entry[1] : undefined;
}

function buildPropertiesIos(): BuildPropertiesIos | undefined {
  return pluginOptions('expo-build-properties')?.ios;
}

function autolinkedDependencies(platform: AutolinkPlatform): Record<string, AutolinkedDependency> {
  const output: string = execFileSync(
    process.execPath,
    [
      '--no-warnings',
      '--eval',
      "require('expo/bin/autolinking')",
      'expo-modules-autolinking',
      'react-native-config',
      '--json',
      '--platform',
      platform,
    ],
    { cwd: __dirname, encoding: 'utf8' },
  );
  return (JSON.parse(output) as ReactNativeAutolinkingConfig).dependencies;
}

function autolinkedFirebasePods(): string[] {
  return Object.entries(autolinkedDependencies('ios'))
    .filter(([name]: [string, AutolinkedDependency]): boolean => name.startsWith(FIREBASE_SCOPE))
    .map(([, dependency]: [string, AutolinkedDependency]): string =>
      basename(dependency.platforms.ios?.podspecPath ?? '', PODSPEC_SUFFIX),
    );
}

function loadAppConfigForWebUrl(webUrl: string | undefined): AppConfig['expo'] {
  const originalWebUrl: string | undefined = process.env.EXPO_PUBLIC_WEB_URL;

  try {
    if (webUrl === undefined) {
      delete process.env.EXPO_PUBLIC_WEB_URL;
    } else {
      process.env.EXPO_PUBLIC_WEB_URL = webUrl;
    }
    jest.resetModules();
    return jest.requireActual<AppConfig>('./app.config').expo;
  } finally {
    if (originalWebUrl === undefined) {
      delete process.env.EXPO_PUBLIC_WEB_URL;
    } else {
      process.env.EXPO_PUBLIC_WEB_URL = originalWebUrl;
    }
  }
}

describe('iOS static framework linkage (ADR 0002)', () => {
  it('declares expo-build-properties as a dependency', () => {
    expect(manifest.dependencies).toHaveProperty('expo-build-properties');
  });

  it('links static frameworks and builds Expo modules from source', () => {
    expect(buildPropertiesIos()).toMatchObject({ useFrameworks: 'static', usePrecompiledModules: false });
  });

  it('force-links exactly the React Native Firebase pods that autolink', () => {
    const firebasePods: string[] = autolinkedFirebasePods();
    const forceStaticLinking: string[] = buildPropertiesIos()?.forceStaticLinking ?? [];

    expect(firebasePods.length).toBeGreaterThan(0);
    expect(forceStaticLinking).toHaveLength(firebasePods.length);
    expect(forceStaticLinking).toEqual(expect.arrayContaining(firebasePods));
  });
});

describe('Firebase Analytics stays out of the native build (DS-92)', () => {
  it.each<AutolinkPlatform>([
    'ios',
    'android',
  ])('leaves @react-native-firebase/analytics out of %s autolinking while Remote Config still links', (platform: AutolinkPlatform): void => {
    const linked: string[] = Object.keys(autolinkedDependencies(platform));

    expect(linked).toContain(FIREBASE_REMOTE_CONFIG);
    expect(linked).not.toContain(FIREBASE_ANALYTICS);
  });
});

describe('App Store export compliance (DS-91)', () => {
  it('declares that the app uses only exempt encryption', () => {
    expect(expo.ios.config?.usesNonExemptEncryption).toBe(false);
  });
});

describe('iOS privacy manifest required reasons (DS-93)', () => {
  it.each<[string, string]>([
    ['NSPrivacyAccessedAPICategoryFileTimestamp', 'C617.1'],
    ['NSPrivacyAccessedAPICategorySystemBootTime', '35F9.1'],
    ['NSPrivacyAccessedAPICategoryDiskSpace', 'E174.1'],
    ['NSPrivacyAccessedAPICategoryUserDefaults', 'CA92.1'],
  ])('declares %s with reason %s for linked code that ships no privacy manifest', (category: string, reason: string): void => {
    const declared: AccessedApiType | undefined = expo.ios.privacyManifests?.NSPrivacyAccessedAPITypes?.find(
      (entry: AccessedApiType): boolean => entry.NSPrivacyAccessedAPIType === category,
    );

    expect(declared?.NSPrivacyAccessedAPITypeReasons).toContain(reason);
  });
});

describe('native share-link association configuration', () => {
  it('configures the existing app scheme and HTTPS paths for Android and iOS', () => {
    const config = loadAppConfigForWebUrl('https://links.ganapps.test');

    expect(config.scheme).toBe('ganappsmobile');
    expect(config.ios.associatedDomains).toEqual(['applinks:links.ganapps.test']);
    expect(config.android.intentFilters).toEqual([
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'links.ganapps.test', pathPrefix: '/friends/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'links.ganapps.test', pathPrefix: '/ganaps/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ]);
  });

  it('does not configure verified domains from a local HTTP development origin', () => {
    const config = loadAppConfigForWebUrl('http://192.168.1.42:3000');

    expect(config.ios.associatedDomains).toBeUndefined();
    expect(config.android.intentFilters).toBeUndefined();
  });
});

describe('iOS purpose strings (DS-144)', () => {
  it('declares an app-authored motion purpose string, which ITMS-90683 requires because expo-location links CoreMotion', () => {
    expect(pluginOptions('expo-location')?.motionUsagePermission).toEqual(expect.stringMatching(/^Ganapps /));
  });

  it('gives every plugin that writes NSPhotoLibraryUsageDescription the same app-authored string, since the last one wins', () => {
    const photoStrings: Array<string | false | undefined> = expo.plugins
      .filter(
        (plugin: PluginEntry): plugin is [string, PluginOptions] =>
          Array.isArray(plugin) && plugin[1] !== undefined && 'photosPermission' in plugin[1],
      )
      .map(([, options]: [string, PluginOptions]): string | false | undefined => options.photosPermission);

    expect(photoStrings.length).toBeGreaterThan(0);
    expect(photoStrings).toEqual(photoStrings.map((): unknown => expect.stringMatching(/^Ganapps /)));
    expect(new Set(photoStrings).size).toBe(1);
  });
});

describe('native system appearance (DS-168)', () => {
  it('allows the app to receive device appearance changes', () => {
    expect(expo.userInterfaceStyle).toBe('automatic');
  });
});
