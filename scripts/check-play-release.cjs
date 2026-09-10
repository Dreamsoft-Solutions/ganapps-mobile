const { readFileSync } = require('node:fs');

/** Validate public release configuration without printing environment values. */
function validatePlayEnvironment(env) {
  const errors = [];
  for (const key of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_PRIVACY_POLICY_URL', 'EXPO_PUBLIC_ACCOUNT_DELETION_URL', 'EXPO_PUBLIC_TERMS_URL']) {
    try {
      const url = new URL(env[key]);
      if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) {
        throw new Error();
      }
      if (key === 'EXPO_PUBLIC_API_URL' && !/\/api\/v1\/?$/.test(url.pathname)) throw new Error();
    } catch {
      errors.push(`${key} must be a public HTTPS URL${key === 'EXPO_PUBLIC_API_URL' ? ' ending in /api/v1' : ''}.`);
    }
  }
  if (env.APP_ENV !== 'production') errors.push('APP_ENV must be production.');
  if (!env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.startsWith('pk.')) errors.push('Use a public Mapbox pk. token.');
  if (env.EXPO_PUBLIC_FEATURE_FLAG_REMOTE_CONFIG_PARAMETER !== 'mobile_prod') errors.push('Remote Config must use mobile_prod.');
  if (env.EXPO_PUBLIC_FEATURE_FLAG_ENV_OVERRIDE !== 'false') errors.push('Disable environment feature flag overrides for production.');
  return errors;
}

module.exports = { validatePlayEnvironment };

if (require.main === module && (process.argv.includes('--production') || (process.env.EAS_BUILD_PROFILE === 'production' && process.env.EAS_BUILD_PLATFORM === 'android'))) {
  const errors = validatePlayEnvironment(process.env);
  try {
    const firebase = JSON.parse(readFileSync(process.env.GOOGLE_SERVICES_JSON || './google-services.json', 'utf8'));
    const client = firebase.client?.find((entry) => entry.client_info?.android_client_info?.package_name === 'com.ganapps.app');
    if (!client) errors.push('Firebase must contain the com.ganapps.app Android client.');
    if (!client?.oauth_client?.some((entry) => Number(entry.client_type) === 1)) errors.push('Register the Play app-signing certificate in Firebase and download its Android OAuth configuration.');
    const oauth = firebase.client?.flatMap((entry) => [...(entry.oauth_client || []), ...(entry.services?.appinvite_service?.other_platform_oauth_client || [])]) || [];
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID && !oauth.some((entry) => Number(entry.client_type) === 3)) errors.push('Configure the Google web OAuth client ID.');
  } catch {
    errors.push('Provide a readable GOOGLE_SERVICES_JSON file for the production Firebase project.');
  }
  if (errors.length) {
    console.error(`Play release configuration is incomplete:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('Play release configuration checks passed. Verify deployed policies, signing, and the final AAB before submission.');
  }
}
