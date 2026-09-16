const fs = require('node:fs');

// On EAS Build, google-services.json is gitignored and arrives as a file
// environment variable (GOOGLE_SERVICES_JSON). Locally, the file sits in the
// project root as usual.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
const googleServiceInfoPlist = process.env.GOOGLE_SERVICE_INFO_PLIST ?? './GoogleService-Info.plist';
const androidPackage = 'com.ganapps.app';

function getGoogleClientConfiguration() {
  const environmentWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(googleServicesFile, 'utf8'));
    const clients = Array.isArray(firebaseConfig.client) ? firebaseConfig.client : [];
    const androidClient = clients.find(
      (client) => client.client_info?.android_client_info?.package_name === androidPackage,
    );
    const androidOAuthClients =
      androidClient?.oauth_client?.filter(
        (client) => Number(client.client_type) === 1 && client.android_info?.package_name === androidPackage,
      ) ?? [];
    const androidOAuthClient = androidOAuthClients[0];
    const oauthClients = clients.flatMap((client) => [
      ...(Array.isArray(client.oauth_client) ? client.oauth_client : []),
      ...(Array.isArray(client.services?.appinvite_service?.other_platform_oauth_client)
        ? client.services.appinvite_service.other_platform_oauth_client
        : []),
    ]);

    return {
      webClientId: environmentWebClientId ?? oauthClients.find((client) => Number(client.client_type) === 3)?.client_id,
      androidOAuthClientConfigured: Boolean(androidOAuthClient),
      androidOAuthCertificateHash: androidOAuthClient?.android_info?.certificate_hash,
      androidOAuthCertificateHashes: androidOAuthClients
        .map((client) => client.android_info?.certificate_hash)
        .filter(Boolean),
    };
  } catch {
    return {
      webClientId: environmentWebClientId,
      androidOAuthClientConfigured: undefined,
      androidOAuthCertificateHash: undefined,
      androidOAuthCertificateHashes: undefined,
    };
  }
}

const googleClientConfiguration = getGoogleClientConfiguration();

module.exports = {
  expo: {
    name: 'Ganapps',
    slug: 'dreamsoft-cpu',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/brand/ganap-logo-1.png',
    scheme: 'ganappsmobile',
    userInterfaceStyle: 'light',
    ios: {
      icon: './assets/brand/ganap-logo-1.png',
      bundleIdentifier: 'com.ganapps.app',
      googleServicesFile: googleServiceInfoPlist,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Ganapps uses your location to show events happening near you in Iloilo City.',
      },
    },
    android: {
      package: 'com.ganapps.app',
      versionCode: 2,
      googleServicesFile,
      blockedPermissions: [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
      adaptiveIcon: {
        backgroundColor: '#22C55E',
        foregroundImage: './assets/brand/ganap-logo-1.png',
      },
      predictiveBackGestureEnabled: false,
      usesCleartextTraffic: process.env.APP_ENV === 'local',
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Ganapps uses your location to show events happening near you in Iloilo City.',
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          motionUsagePermission: false,
        },
      ],
      [
        'expo-notifications',
        {
          defaultChannel: 'registration-status',
          icon: './assets/images/notification-icon.png',
          color: '#22C55E',
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#22C55E',
          image: './assets/brand/ganap-logo-1.png',
          imageWidth: 200,
        },
      ],
      [
        'expo-font',
        {
          fonts: [
            './assets/fonts/Inter-Regular.otf',
            './assets/fonts/Inter-Medium.otf',
            './assets/fonts/Inter-SemiBold.otf',
            './assets/fonts/Inter-Bold.otf',
            './assets/fonts/Inter-Black.otf',
          ],
        },
      ],
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-google-signin/google-signin',
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsImpl: 'mapbox',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: "Ganapps uses the camera to scan the organizer's attendance QR code.",
          // The app only scans QR codes — it never records video or audio. Without this,
          // expo-camera writes its default NSMicrophoneUsageDescription and the app asks
          // for a permission it never uses, which App Review rejects under 5.1.1.
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      [
        'expo-image-picker',
        {
          // Apple requires the purpose string to cover every use of the data, so this
          // names both the profile picture and sharing media in event chats. Update it
          // whenever a new picker call site is added.
          photosPermission:
            'Ganapps uses your photos so you can set a profile picture and share photos and videos in event chats.',
          // Media is only ever chosen from the existing library — the picker never
          // records, so it must not declare NSMicrophoneUsageDescription.
          microphonePermission: false,
        },
      ],
      './plugins/with-local-android-release-signing',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'e2daec7d-354d-4c9a-bc92-66e74c75e92e',
      },
      googleWebClientId: googleClientConfiguration.webClientId,
      googleAndroidOAuthClientConfigured: googleClientConfiguration.androidOAuthClientConfigured,
      googleAndroidOAuthCertificateHash: googleClientConfiguration.androidOAuthCertificateHash,
      googleAndroidOAuthCertificateHashes: googleClientConfiguration.androidOAuthCertificateHashes,
    },
    owner: 'dreamsoft-cpu',
  },
};
