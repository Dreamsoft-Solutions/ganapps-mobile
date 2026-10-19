import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { clearPendingAppleName, getAppleSignInCredential, isAppleSignInCancelled } from './apple-auth.service';

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

const signInAsync = AppleAuthentication.signInAsync as jest.MockedFunction<typeof AppleAuthentication.signInAsync>;
const getRandomBytes = Crypto.getRandomBytes as jest.MockedFunction<typeof Crypto.getRandomBytes>;
const digestStringAsync = Crypto.digestStringAsync as jest.MockedFunction<typeof Crypto.digestStringAsync>;

const FIXED_BYTES: Uint8Array = Uint8Array.from({ length: 32 }, (_value: unknown, index: number): number => index);
const FIXED_HEX: string = Array.from(FIXED_BYTES, (byte: number): string => byte.toString(16).padStart(2, '0')).join(
  '',
);

interface CredentialOverrides {
  user?: string;
  identityToken?: string | null;
  authorizationCode?: string | null;
  fullName?: { givenName: string | null; familyName: string | null } | null;
}

function credential(overrides: CredentialOverrides = {}): AppleAuthentication.AppleAuthenticationCredential {
  return {
    user: 'apple-user-1',
    identityToken: 'identity-token',
    authorizationCode: 'auth-code',
    fullName: null,
    email: null,
    realUserStatus: 0,
    state: null,
    authorizedScopes: [],
    ...overrides,
  } as AppleAuthentication.AppleAuthenticationCredential;
}

function names(givenName: string | null, familyName: string | null): CredentialOverrides {
  return {
    fullName: { givenName, familyName },
  };
}

describe('apple-auth.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPendingAppleName();
    getRandomBytes.mockReturnValue(FIXED_BYTES);
    digestStringAsync.mockResolvedValue('hashed-nonce');
    signInAsync.mockResolvedValue(credential());
  });

  it('sends Apple the SHA-256 of the raw nonce and returns the raw nonce', async () => {
    const result = await getAppleSignInCredential();

    expect(getRandomBytes).toHaveBeenCalledWith(32);
    expect(digestStringAsync).toHaveBeenCalledWith('SHA-256', FIXED_HEX);
    expect(signInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'hashed-nonce' }));
    expect(result.nonce).toBe(FIXED_HEX);
    expect(result.nonce).toHaveLength(64);
    expect(result.identityToken).toBe('identity-token');
    expect(result.authorizationCode).toBe('auth-code');
  });

  it('requests the full name and email scopes', async () => {
    await getAppleSignInCredential();

    expect(signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      }),
    );
  });

  it('trims names, drops blank ones and clamps them to 64 characters', async () => {
    signInAsync.mockResolvedValue(credential(names('  Maria  ', 'x'.repeat(100))));
    const clamped = await getAppleSignInCredential();
    expect(clamped.givenName).toBe('Maria');
    expect(clamped.familyName).toBe('x'.repeat(64));

    clearPendingAppleName();
    signInAsync.mockResolvedValue(credential(names('   ', '')));
    const blank = await getAppleSignInCredential();
    expect(blank.givenName).toBeUndefined();
    expect(blank.familyName).toBeUndefined();
  });

  it('reuses the name Apple sent earlier for the same Apple user', async () => {
    signInAsync.mockResolvedValueOnce(credential(names('Maria', 'Santos')));
    await getAppleSignInCredential();

    signInAsync.mockResolvedValueOnce(credential({ fullName: null }));
    const second = await getAppleSignInCredential();

    expect(second.givenName).toBe('Maria');
    expect(second.familyName).toBe('Santos');
  });

  it('does not reuse a name for a different Apple user', async () => {
    signInAsync.mockResolvedValueOnce(credential(names('Maria', 'Santos')));
    await getAppleSignInCredential();

    signInAsync.mockResolvedValueOnce(credential({ user: 'apple-user-2', fullName: null }));
    const second = await getAppleSignInCredential();

    expect(second.givenName).toBeUndefined();
    expect(second.familyName).toBeUndefined();
  });

  it('forgets the pending name after clearPendingAppleName', async () => {
    signInAsync.mockResolvedValueOnce(credential(names('Maria', 'Santos')));
    await getAppleSignInCredential();
    clearPendingAppleName();

    signInAsync.mockResolvedValueOnce(credential({ fullName: null }));
    const second = await getAppleSignInCredential();

    expect(second.givenName).toBeUndefined();
    expect(second.familyName).toBeUndefined();
  });

  it('keeps the cached name when a later response has only blank name parts', async () => {
    signInAsync.mockResolvedValueOnce(credential(names('Maria', 'Santos')));
    await getAppleSignInCredential();

    signInAsync.mockResolvedValueOnce(credential(names(' ', null)));
    const second = await getAppleSignInCredential();

    expect(second.givenName).toBe('Maria');
    expect(second.familyName).toBe('Santos');
  });

  it.each([
    ['identity token', { identityToken: null }],
    ['authorization code', { authorizationCode: null }],
  ])('throws when Apple returns no %s', async (_label: string, overrides: CredentialOverrides): Promise<void> => {
    signInAsync.mockResolvedValue(credential(overrides));

    await expect(getAppleSignInCredential()).rejects.toThrow('Apple did not return a sign-in token');
  });

  it('recognises a cancelled Apple sheet', () => {
    expect(isAppleSignInCancelled({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isAppleSignInCancelled(Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' }))).toBe(true);
    expect(isAppleSignInCancelled({ code: 'ERR_REQUEST_FAILED' })).toBe(false);
    expect(isAppleSignInCancelled(new Error('ERR_REQUEST_CANCELED'))).toBe(false);
    expect(isAppleSignInCancelled(null)).toBe(false);
    expect(isAppleSignInCancelled('ERR_REQUEST_CANCELED')).toBe(false);
  });
});
