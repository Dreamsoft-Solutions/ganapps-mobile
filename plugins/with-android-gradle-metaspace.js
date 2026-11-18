const { withGradleProperties } = require('@expo/config-plugins');

const GRADLE_JVM_ARGS = 'org.gradle.jvmargs';
const METASPACE_LIMIT = '-XX:MaxMetaspaceSize=1024m';
const METASPACE_OPTION = /(^|\s)-XX:MaxMetaspaceSize=\S+/g;

/**
 * Gives the Gradle daemon enough Metaspace for Android release compilation.
 *
 * @param {object} config - Expo config passed to the plugin.
 * @returns {object} Expo config with the Android Gradle properties mod registered.
 */
function withAndroidGradleMetaspace(config) {
  return withGradleProperties(config, (config) => {
    const jvmArgs = config.modResults.find((item) => item.type === 'property' && item.key === GRADLE_JVM_ARGS);

    if (!jvmArgs) {
      config.modResults.push({ type: 'property', key: GRADLE_JVM_ARGS, value: METASPACE_LIMIT });
    } else if (METASPACE_OPTION.test(jvmArgs.value)) {
      jvmArgs.value = jvmArgs.value.replace(METASPACE_OPTION, `$1${METASPACE_LIMIT}`);
    } else {
      jvmArgs.value = `${jvmArgs.value.trimEnd()} ${METASPACE_LIMIT}`.trimStart();
    }

    return config;
  });
}

module.exports = withAndroidGradleMetaspace;
