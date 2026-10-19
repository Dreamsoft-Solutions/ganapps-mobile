import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import type { AppleAuthRequestDto } from '@/types/auth.types';

const APPLE_CANCELLED_CODE = 'ERR_REQUEST_CANCELED';
const NONCE_BYTE_COUNT = 32;
const MAX_NAME_LENGTH = 64;

interface PendingAppleName {
  user: string;
  givenName?: string;
  familyName?: string;
}

let pendingName: PendingAppleName | null = null;

/**
 * Signs in with Apple natively and returns the credential the Ganapps API verifies.
 *
 * Apple receives the SHA-256 hex digest of a fresh random nonce; the raw nonce goes to
 * the server. Apple sends the name only on the first authorization, so a name received
 * for an Apple user is kept in memory and reused until `clearPendingAppleName` runs.
 * Names are trimmed, dropped when blank, and cut to 64 characters.
 *
 * @returns The identity token, authorization code, raw nonce and optional name parts.
 * @throws {Error} When the Apple sheet fails, is cancelled, or returns no token or code.
 */
export async function getAppleSignInCredential(): Promise<AppleAuthRequestDto> {
  const nonce: string = bytesToHex(Crypto.getRandomBytes(NONCE_BYTE_COUNT));
  const hashedNonce: string = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

  const credential: AppleAuthentication.AppleAuthenticationCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken || !credential.authorizationCode) {
    throw new Error('Apple did not return a sign-in token');
  }

  const givenName: string | undefined = cleanName(credential.fullName?.givenName);
  const familyName: string | undefined = cleanName(credential.fullName?.familyName);
  if (givenName !== undefined || familyName !== undefined) {
    pendingName = { user: credential.user, givenName, familyName };
  }

  const name: PendingAppleName | null = pendingName?.user === credential.user ? pendingName : null;

  return {
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode,
    nonce,
    ...(name?.givenName !== undefined && { givenName: name.givenName }),
    ...(name?.familyName !== undefined && { familyName: name.familyName }),
  };
}

/**
 * Identifies a user-cancelled Apple sign-in sheet.
 *
 * @param error - Unknown rejected value.
 * @returns True when the value carries the Apple cancellation error code.
 */
export function isAppleSignInCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === APPLE_CANCELLED_CODE
  );
}

/**
 * Forgets the Apple name kept in memory, for example after the server accepted it or
 * the User signed out.
 */
export function clearPendingAppleName(): void {
  pendingName = null;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte: number): string => byte.toString(16).padStart(2, '0')).join('');
}

function cleanName(value: string | null | undefined): string | undefined {
  const trimmed: string = (value ?? '').trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length <= MAX_NAME_LENGTH) return trimmed;
  const lastCode: number = trimmed.charCodeAt(MAX_NAME_LENGTH - 1);
  const isSplitPair: boolean = lastCode >= 0xd800 && lastCode <= 0xdbff;
  const clamped: string = trimmed.slice(0, isSplitPair ? MAX_NAME_LENGTH - 1 : MAX_NAME_LENGTH).trim();
  return clamped.length === 0 ? undefined : clamped;
}
