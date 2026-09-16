const { withAppBuildGradle } = require('@expo/config-plugins');

const START_MARKER = '// @generated begin ganapps-local-release-signing';
const END_MARKER = '// @generated end ganapps-local-release-signing';

const RELEASE_SIGNING_BLOCK = `
${START_MARKER}
def ganappsReleaseBuildRequested = gradle.startParameter.taskNames.any { taskName ->
  taskName.toLowerCase().contains('release')
}
def ganappsReleaseSigningProperties = [
  storeFile: findProperty('GANAPPS_RELEASE_STORE_FILE'),
  storePassword: findProperty('GANAPPS_RELEASE_STORE_PASSWORD'),
  keyAlias: findProperty('GANAPPS_RELEASE_KEY_ALIAS'),
  keyPassword: findProperty('GANAPPS_RELEASE_KEY_PASSWORD'),
]
def ganappsReleaseSigningConfigured = ganappsReleaseSigningProperties.values().every { value ->
  value != null && value.toString().trim().length() > 0
}
def ganappsRunningOnEas = System.getenv('EAS_BUILD')

if (!ganappsRunningOnEas) {
  if (ganappsReleaseSigningConfigured) {
    android {
      signingConfigs {
        release {
          storeFile file(ganappsReleaseSigningProperties.storeFile)
          storePassword ganappsReleaseSigningProperties.storePassword
          keyAlias ganappsReleaseSigningProperties.keyAlias
          keyPassword ganappsReleaseSigningProperties.keyPassword
        }
      }
      buildTypes {
        release {
          signingConfig signingConfigs.release
        }
      }
    }
  } else {
    android.buildTypes.release.signingConfig = null
    if (ganappsReleaseBuildRequested) {
      throw new GradleException(
        'Local release signing is not configured. Set the four ORG_GRADLE_PROJECT_GANAPPS_RELEASE_* variables before building bundleRelease.',
      )
    }
  }
}
${END_MARKER}
`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

/**
 * Adds the local release-signing guard to generated Android Gradle content.
 *
 * @param {string} buildGradle - Generated android/app/build.gradle content.
 * @returns {string} Gradle content with the local release-signing guard.
 */
function applyLocalReleaseSigning(buildGradle) {
  const blockPattern = new RegExp(
    `[\\r\\n]*${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}[\\r\\n]*`,
    'g',
  );
  const withoutPreviousBlock = buildGradle.replace(blockPattern, '');
  const withoutDebugReleaseSigning = withoutPreviousBlock.replace(
    /(buildTypes\s*\{\s*[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    '$1signingConfig null',
  );
  return `${withoutDebugReleaseSigning.trimEnd()}\n${RELEASE_SIGNING_BLOCK.trim()}\n`;
}

/**
 * Applies the local Android release-signing config plugin.
 *
 * @param {object} config - Expo config passed to the plugin.
 * @returns {object} Expo config with the Android Gradle mod registered.
 */
function withLocalAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('Local Android release signing requires a Groovy android/app/build.gradle file.');
    }

    config.modResults.contents = applyLocalReleaseSigning(config.modResults.contents);
    return config;
  });
}

module.exports = withLocalAndroidReleaseSigning;
module.exports.applyLocalReleaseSigning = applyLocalReleaseSigning;
