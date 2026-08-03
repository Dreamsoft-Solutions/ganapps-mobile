import auth, { GoogleAuthProvider } from '@react-native-firebase/auth';
import { GoogleSignin, isErrorWithCode, isSuccessResponse } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const GOOGLE_SIGN_IN_CANCELLED = 'GOOGLE_SIGN_IN_CANCELLED';
let isConfigured = false;

/**
 * Signs in with Google natively, exchanges the credential through Firebase Auth,
 * and returns the Firebase ID token required by the Ganapps API.
 *
 * @returns A Firebase ID token.
 * @throws {Error} When native Google Sign-In or Firebase Auth fails.
 */
export async function getGoogleFirebaseIdToken(): Promise<string> {
  const diagnostics = configureGoogleSignIn();
  if (__DEV__) {
    console.info('[GoogleAuth] configuration', diagnostics);
  }
  if (Platform.OS === 'android' && diagnostics.androidOAuthClientConfigured === false) {
    throw new Error(
      'Android Google OAuth client is missing. Add the app SHA-1/SHA-256 fingerprints in Firebase, then replace google-services.json.',
    );
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      throw new Error(GOOGLE_SIGN_IN_CANCELLED);
    }

    const { idToken } = response.data;
    if (!idToken) throw new Error('Google did not return an ID token');

    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await auth().signInWithCredential(credential);
    return await userCredential.user.getIdToken();
  } catch (error: unknown) {
    if (__DEV__) {
      console.warn('[GoogleAuth] native sign-in failed', {
        code: isErrorWithCode(error) ? error.code : undefined,
        message: error instanceof Error ? error.message : 'Unknown Google sign-in error',
      });
    }
    throw error;
  } finally {
    try {
      await auth().signOut();
    } catch {
      // Firebase may not have an active native session after a cancelled flow.
    }
    try {
      await GoogleSignin.signOut();
    } catch {
      // Google Sign-In may already have cleared its native session.
    }
  }
}

/**
 * Identifies a user-cancelled native Google sign-in attempt.
 *
 * @param error - Unknown rejected value.
 * @returns True when the sign-in flow was cancelled.
 */
export function isGoogleSignInCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === GOOGLE_SIGN_IN_CANCELLED;
}

function configureGoogleSignIn(): {
  androidOAuthClientConfigured: boolean | undefined;
  hasWebClientId: boolean;
  packageName: string | undefined;
  projectId: string | undefined;
} {
  const extra: unknown = Constants.expoConfig?.extra;
  const extraRecord = typeof extra === 'object' && extra !== null ? (extra as Record<string, unknown>) : {};
  const configuredExtra = extraRecord.googleWebClientId;
  const configuredAndroidOAuthClient = extraRecord.googleAndroidOAuthClientConfigured;

  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? (typeof configuredExtra === 'string' ? configuredExtra : undefined);
  if (!webClientId) throw new Error('Google sign-in is not configured');

  if (!isConfigured) {
    GoogleSignin.configure({ webClientId });
    isConfigured = true;
  }

  return {
    androidOAuthClientConfigured:
      typeof configuredAndroidOAuthClient === 'boolean' ? configuredAndroidOAuthClient : undefined,
    hasWebClientId: true,
    packageName: Constants.expoConfig?.android?.package,
    projectId:
      typeof process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID === 'string'
        ? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
        : undefined,
  };
}
