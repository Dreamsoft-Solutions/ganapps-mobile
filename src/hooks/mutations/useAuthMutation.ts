import { type QueryClient, type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '@/api/endpoints/auth';
import { revokeRegisteredAndroidPushToken } from '@/services/push-notification.service';
import { useAuthStore } from '@/store/auth.store';
import type {
  AppleAuthRequestDto,
  AppleAuthResponse,
  CompletePasswordResetDto,
  DeleteAccountInput,
  DeleteAccountResponse,
  GoogleAuthRequestDto,
  GoogleAuthResponse,
  LoginDto,
  PasswordResetResponse,
  RegisterDto,
  RegisterResponse,
  RequestPasswordResetDto,
  TokenResponse,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from '@/types/auth.types';
import type { User } from '@/types/user.types';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';
import { authQueryKeys } from '../queries/useAuthQuery';

/**
 * Submits an online deletion attempt without automatic retries or selective invalidation.
 * @returns The deletion mutation; the aggregated auth handler owns session cleanup.
 */
export function useDeleteAccountMutation(): UseMutationResult<DeleteAccountResponse, Error, DeleteAccountInput> {
  return useMutation<DeleteAccountResponse, Error, DeleteAccountInput>({
    mutationFn: (input: DeleteAccountInput): Promise<DeleteAccountResponse> =>
      authAPI.deleteAccount(input.confirmationPhrase, input.idempotencyKey),
    retry: false,
    networkMode: 'always',
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/** Signs in with email and starts a new account session. */
export function useLoginMutation(): UseMutationResult<TokenResponse, Error, LoginDto> {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<TokenResponse, Error, LoginDto>({
    mutationFn: (dto: LoginDto): Promise<TokenResponse> => authAPI.login(dto),
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
    onSuccess: async (data: TokenResponse): Promise<void> => {
      await setAuth(data.accessToken, data.refreshToken, data.expiresIn);
    },
  });
}

export function useRegisterMutation(): UseMutationResult<RegisterResponse, Error, RegisterDto> {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<RegisterResponse, Error, RegisterDto>({
    mutationFn: (dto: RegisterDto): Promise<RegisterResponse> => authAPI.register(dto),
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
    onSuccess: async (data: RegisterResponse): Promise<void> => {
      await setAuth(data.accessToken, data.refreshToken, data.expiresIn);
    },
  });
}

/**
 * Creates the generic password-reset request mutation.
 *
 * @returns A mutation for asking the server to email a reset code.
 */
export function useRequestPasswordResetMutation(): UseMutationResult<
  PasswordResetResponse,
  Error,
  RequestPasswordResetDto
> {
  return useMutation<PasswordResetResponse, Error, RequestPasswordResetDto>({
    mutationFn: (dto: RequestPasswordResetDto): Promise<PasswordResetResponse> => authAPI.requestPasswordReset(dto),
    retry: false,
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Creates the password-reset completion mutation.
 *
 * @returns A mutation for consuming a code and setting the new password.
 */
export function useCompletePasswordResetMutation(): UseMutationResult<
  PasswordResetResponse,
  Error,
  CompletePasswordResetDto
> {
  return useMutation<PasswordResetResponse, Error, CompletePasswordResetDto>({
    mutationFn: (dto: CompletePasswordResetDto): Promise<PasswordResetResponse> => authAPI.completePasswordReset(dto),
    retry: false,
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/** Starts a Google account session with the returned profile and credentials. */
export function useGoogleLoginMutation(): UseMutationResult<GoogleAuthResponse, Error, GoogleAuthRequestDto> {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<GoogleAuthResponse, Error, GoogleAuthRequestDto>({
    mutationFn: (dto: GoogleAuthRequestDto): Promise<GoogleAuthResponse> => authAPI.googleLogin(dto),
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
    onSuccess: async (data: GoogleAuthResponse): Promise<void> => {
      await setAuth(data.accessToken, data.refreshToken, data.expiresIn, { user: data.user });
    },
  });
}

/**
 * Creates the Sign in with Apple mutation that stores the session and user on success.
 *
 * @returns A mutation that exchanges an Apple credential for a Ganapps session without a global error toast.
 */
export function useAppleLoginMutation(): UseMutationResult<AppleAuthResponse, Error, AppleAuthRequestDto> {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<AppleAuthResponse, Error, AppleAuthRequestDto>({
    mutationFn: (dto: AppleAuthRequestDto): Promise<AppleAuthResponse> => authAPI.appleLogin(dto),
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
    onSuccess: async (data: AppleAuthResponse): Promise<void> => {
      await setAuth(data.accessToken, data.refreshToken, data.expiresIn, { user: data.user });
    },
  });
}

/**
 * Creates the logout mutation and starts push-token cleanup without awaiting it.
 *
 * @returns A TanStack mutation for the authenticated logout request.
 */
export function useLogoutMutation(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation<void, Error, void>({
    mutationFn: (): Promise<void> => {
      void revokeRegisteredAndroidPushToken();
      return authAPI.logout();
    },
    onSuccess: async (): Promise<void> => {
      const tokenCleanup = clearAuth();
      queryClient.clear();
      await tokenCleanup;
    },
  });
}

function saveProfile(queryClient: QueryClient, accountSessionId: number, user: User): void {
  useAuthStore.getState().setUser(user, accountSessionId);
  const queryKey = authQueryKeys.me(accountSessionId);
  queryClient.setQueryData(queryKey, user);
  void queryClient.invalidateQueries({ queryKey });
}

/** Verifies the email of the User in the current sign-in session. */
export function useVerifyEmailMutation(): UseMutationResult<User, Error, VerifyEmailRequest> {
  const queryClient = useQueryClient();
  const accountSessionId = useAuthStore((s) => s.accountSessionId);

  return useMutation<User, Error, VerifyEmailRequest>({
    mutationKey: [...authQueryKeys.me(accountSessionId), 'verify-email'],
    mutationFn: (dto: VerifyEmailRequest): Promise<User> =>
      authAPI.verifyEmail(dto, { expectedAuthSessionId: accountSessionId }),
    onSuccess: (user: User): void => {
      saveProfile(queryClient, accountSessionId, user);
    },
  });
}

export function useResendVerificationMutation(): UseMutationResult<{ message: string }, Error, void> {
  return useMutation<{ message: string }, Error, void>({
    mutationFn: () => authAPI.resendVerification(),
  });
}

/** Updates the profile of the User in the current sign-in session. */
export function useUpdateProfileMutation(): UseMutationResult<User, Error, UpdateProfileRequest | FormData> {
  const queryClient = useQueryClient();
  const accountSessionId = useAuthStore((s) => s.accountSessionId);

  return useMutation<User, Error, UpdateProfileRequest | FormData>({
    mutationKey: [...authQueryKeys.me(accountSessionId), 'update-profile'],
    mutationFn: (dto: UpdateProfileRequest | FormData): Promise<User> =>
      authAPI.updateProfile(dto, { expectedAuthSessionId: accountSessionId }),
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
    onSuccess: (user: User): void => {
      saveProfile(queryClient, accountSessionId, user);
    },
  });
}
