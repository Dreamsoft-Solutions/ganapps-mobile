// On EAS Build, google-services.json is gitignored and arrives as a file
// environment variable (GOOGLE_SERVICES_JSON). Locally, the file sits in the
// project root as usual.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

module.exports = {
  expo: {
    name: 'ganapps-mobile',
    slug: 'dreamsoft-cpu',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'ganappsmobile',
    userInterfaceStyle: 'light',
    ios: {
      icon: './assets/expo.icon',
      bundleIdentifier: 'com.ganapps.app',
      googleServicesFile: './GoogleService-Info.plist',
    },
    android: {
      package: 'com.ganapps.app',
      googleServicesFile,
      adaptiveIcon: {
        backgroundColor: '#22C55E',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
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
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsImpl: 'mapbox',
        },
      ],
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
    },
    owner: 'dreamsoft-cpu',
  },
};
