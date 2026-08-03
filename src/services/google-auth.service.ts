import auth, { GoogleAuthProvider } from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

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
  configureGoogleSignIn();

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

function configureGoogleSignIn(): void {
  if (isConfigured) return;

  const extra: unknown = Constants.expoConfig?.extra;
  const extraRecord = typeof extra === 'object' && extra !== null ? (extra as Record<string, unknown>) : {};
  const configuredExtra = extraRecord.googleWebClientId;
  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? (typeof configuredExtra === 'string' ? configuredExtra : undefined);
  if (!webClientId) throw new Error('Google sign-in is not configured');

  GoogleSignin.configure({ webClientId });
  isConfigured = true;
}
