const { withPodfile } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const TAG = 'ganapps-pod-deployment-target-floor';
const ANCHOR = /^\s*react_native_post_install\(/m;

const RAISE_POD_DEPLOYMENT_TARGETS = `    ganapps_app_deployment_target = installer.aggregate_targets
      .map(&:platform)
      .select { |platform| platform.name == :ios }
      .map(&:deployment_target)
      .compact
      .min
    unless ganapps_app_deployment_target.nil?
      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |build_configuration|
          pod_deployment_target = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_s
          next if pod_deployment_target.empty? || !Pod::Version.correct?(pod_deployment_target)
          next unless Pod::Version.new(pod_deployment_target) < ganapps_app_deployment_target

          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = ganapps_app_deployment_target.to_s
        end
      end
    end`;

/**
 * Adds a Podfile post_install step that raises every Pods project target whose
 * IPHONEOS_DEPLOYMENT_TARGET is below the app's own iOS deployment target up to that target.
 *
 * The app target comes from the Podfile's `platform :ios` declaration at install time, so
 * `ios.deploymentTarget` in Podfile.properties.json still controls it. The step runs before
 * `react_native_post_install`, which only raises each pod's main target to React Native's
 * minimum and never touches resource-bundle targets.
 *
 * @param {string} podfile - Generated ios/Podfile content.
 * @returns {string} Podfile content with the deployment-target floor in its post_install hook.
 */
function applyPodDeploymentTargetFloor(podfile) {
  if (!ANCHOR.test(podfile)) {
    throw new Error(
      'iOS pod deployment-target floor: ios/Podfile has no react_native_post_install( call to insert before.',
    );
  }

  return mergeContents({
    src: podfile,
    newSrc: RAISE_POD_DEPLOYMENT_TARGETS,
    tag: TAG,
    anchor: ANCHOR,
    offset: 0,
    comment: '#',
  }).contents;
}

/**
 * Applies the iOS pod deployment-target floor config plugin.
 *
 * @param {object} config - Expo config passed to the plugin.
 * @returns {object} Expo config with the Podfile mod registered.
 */
function withIosPodDeploymentTargetFloor(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = applyPodDeploymentTargetFloor(config.modResults.contents);
    return config;
  });
}

module.exports = withIosPodDeploymentTargetFloor;
module.exports.applyPodDeploymentTargetFloor = applyPodDeploymentTargetFloor;
