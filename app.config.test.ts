import { readdirSync } from 'node:fs';
import { join } from 'node:path';

type BuildPropertiesIos = {
  useFrameworks?: string;
  usePrecompiledModules?: boolean;
  forceStaticLinking?: string[];
};

type PluginEntry = string | [string, { ios?: BuildPropertiesIos }?];

type IntentFilter = {
  action: string;
  autoVerify?: boolean;
  data: Array<{ scheme?: string; host?: string; pathPrefix?: string }>;
  category?: string[];
};

type AppConfig = {
  expo: {
    scheme: string;
    plugins: PluginEntry[];
    ios: { associatedDomains?: string[]; config?: { usesNonExemptEncryption?: boolean } };
    android: { intentFilters?: IntentFilter[] };
  };
};

type PackageManifest = { dependencies: Record<string, string> };

const { expo } = jest.requireActual<AppConfig>('./app.config');
const manifest = jest.requireActual<PackageManifest>('./package.json');

const RNFB_MODULES_DIR = join(__dirname, 'node_modules', '@react-native-firebase');
const PODSPEC_SUFFIX = '.podspec';

function buildPropertiesIos(): BuildPropertiesIos | undefined {
  const entry = expo.plugins.find(
    (plugin: PluginEntry): boolean => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  );
  return Array.isArray(entry) ? entry[1]?.ios : undefined;
}

function installedFirebasePods(): string[] {
  return readdirSync(RNFB_MODULES_DIR).flatMap((packageDir: string): string[] =>
    readdirSync(join(RNFB_MODULES_DIR, packageDir))
      .filter((file: string): boolean => file.endsWith(PODSPEC_SUFFIX))
      .map((file: string): string => file.slice(0, -PODSPEC_SUFFIX.length)),
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

  it('force-links every installed React Native Firebase pod statically', () => {
    const firebasePods: string[] = installedFirebasePods();

    expect(firebasePods.length).toBeGreaterThan(0);
    expect(buildPropertiesIos()?.forceStaticLinking).toEqual(expect.arrayContaining(firebasePods));
  });
});

describe('App Store export compliance (DS-91)', () => {
  it('declares that the app uses only exempt encryption', () => {
    expect(expo.ios.config?.usesNonExemptEncryption).toBe(false);
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
