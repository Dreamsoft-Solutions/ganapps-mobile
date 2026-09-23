import { readdirSync } from 'node:fs';
import { join } from 'node:path';

type BuildPropertiesIos = {
  useFrameworks?: string;
  usePrecompiledModules?: boolean;
  forceStaticLinking?: string[];
};

type PluginEntry = string | [string, { ios?: BuildPropertiesIos }?];

type AppConfig = {
  expo: { plugins: PluginEntry[]; ios: { config?: { usesNonExemptEncryption?: boolean } } };
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
