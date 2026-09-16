const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { validatePlayEnvironment } = require('./check-play-release.cjs');
const { applyLocalReleaseSigning } = require('../plugins/with-local-android-release-signing');

const valid = {
  APP_ENV: 'production',
  EXPO_PUBLIC_API_URL: 'https://api.ganapps.test/api/v1',
  EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://ganapps.test/privacy',
  EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://ganapps.test/delete-account',
  EXPO_PUBLIC_TERMS_URL: 'https://ganapps.test/terms',
  EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test',
  EXPO_PUBLIC_FEATURE_FLAG_REMOTE_CONFIG_PARAMETER: 'mobile_prod',
  EXPO_PUBLIC_FEATURE_FLAG_ENV_OVERRIDE: 'false',
};

test('release environment rejects missing, insecure and development configuration', () => {
  assert.deepEqual(validatePlayEnvironment(valid), []);
  for (const key of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_PRIVACY_POLICY_URL', 'EXPO_PUBLIC_ACCOUNT_DELETION_URL', 'EXPO_PUBLIC_TERMS_URL']) {
    for (const value of ['', 'http://example.com', 'https://localhost', 'https://10.0.2.2', 'https://user:password@example.com']) {
      assert.ok(validatePlayEnvironment({ ...valid, [key]: value }).length > 0, `${key}: ${value}`);
    }
  }
  assert.ok(validatePlayEnvironment({ ...valid, APP_ENV: 'local' }).length > 0);
  assert.ok(validatePlayEnvironment({ ...valid, EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'sk.secret' }).length > 0);
  assert.ok(validatePlayEnvironment({ ...valid, EXPO_PUBLIC_FEATURE_FLAG_REMOTE_CONFIG_PARAMETER: 'mobile_dev' }).length > 0);
  assert.ok(validatePlayEnvironment({ ...valid, EXPO_PUBLIC_FEATURE_FLAG_ENV_OVERRIDE: 'true' }).length > 0);
});

test('all photo selection flows use the system picker without broad library permission', () => {
  for (const path of ['src/hooks/useChat.ts', 'src/hooks/useDirectChat.ts', 'src/components/forms/EditProfileForm.tsx', 'src/components/forms/OnboardingForm.tsx', 'src/app/(app)/(home)/scan/[ganap-id].tsx']) {
    const source = readFileSync(path, 'utf8');
    assert.ok(source.includes('launchImageLibraryAsync'), path);
    assert.ok(!source.includes('requestMediaLibraryPermissionsAsync'), path);
  }
});

test('production uses an incremented store bundle and blocks unused sensitive permissions', () => {
  const eas = require('../eas.json');
  const { android, plugins } = require('../app.config.js').expo;
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal(eas.build.production.environment, 'production');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(android.package, 'com.ganapps.app');
  for (const permission of ['RECORD_AUDIO', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']) {
    assert.ok(android.blockedPermissions.includes(`android.permission.${permission}`));
  }
  assert.equal(plugins.find((plugin) => plugin[0] === 'expo-camera')[1].recordAudioAndroid, false);
});

test('local release signing is opt-in and never falls back to the debug key', () => {
  const generatedGradle = `
android {
  signingConfigs {
    debug {
      storeFile file('debug.keystore')
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.debug
    }
  }
}
`;

  const configuredGradle = applyLocalReleaseSigning(generatedGradle);

  assert.match(configuredGradle, /GANAPPS_RELEASE_STORE_FILE/);
  assert.match(configuredGradle, /signingConfig signingConfigs\.release/);
  assert.match(configuredGradle, /signingConfig = null/);
  assert.doesNotMatch(configuredGradle, /release\s*\{\s*signingConfig signingConfigs\.debug/);
  assert.equal(applyLocalReleaseSigning(configuredGradle), configuredGradle);
});
