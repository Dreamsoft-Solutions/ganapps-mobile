import type { AxiosResponse } from 'axios';
import type {
  CompletePasswordResetDto,
  DeleteAccountResponse,
  GoogleAuthRequestDto,
  GoogleAuthResponse,
  LoginDto,
  PasswordResetResponse,
  RefreshRequest,
  RegisterDto,
  RegisterResponse,
  RequestPasswordResetDto,
  TokenResponse,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from '@/types/auth.types';
import type { User } from '@/types/user.types';
import axiosInstance from '../axios-instance';

/** Version-free authentication endpoints using the shared envelope-aware client. */
export const authAPI = {
  /**
   * Deletes the current account or recovers the result of a prior attempt.
   * @param confirmationPhrase - Exact user-entered confirmation after trimming.
   * @param idempotencyKey - Stable key reused for explicit retries.
   * @returns Confirmed deletion metadata.
   * @throws A parsed API error retaining the server status and error code.
   */
  deleteAccount: (confirmationPhrase: string, idempotencyKey: string): Promise<DeleteAccountResponse> =>
    axiosInstance
      .delete<DeleteAccountResponse>('/auth/me', {
        data: { confirmationPhrase },
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .then((res: AxiosResponse<DeleteAccountResponse>): DeleteAccountResponse => res.data),

  login: (dto: LoginDto): Promise<TokenResponse> =>
    axiosInstance.post<TokenResponse>('/auth/login', dto).then((res) => res.data),

  register: (dto: RegisterDto): Promise<RegisterResponse> =>
    axiosInstance.post<RegisterResponse>('/auth/register', dto).then((res) => res.data),

  requestPasswordReset: (dto: RequestPasswordResetDto): Promise<PasswordResetResponse> =>
    axiosInstance.post<PasswordResetResponse>('/auth/password-reset/request', dto).then((res) => res.data),

  completePasswordReset: (dto: CompletePasswordResetDto): Promise<PasswordResetResponse> =>
    axiosInstance.post<PasswordResetResponse>('/auth/password-reset/complete', dto).then((res) => res.data),

  logout: (refreshToken?: string): Promise<void> =>
    axiosInstance.post<void>('/auth/logout', { refreshToken }).then((res) => res.data),

  getMe: (): Promise<User> => axiosInstance.get<User>('/auth/me').then((res) => res.data),

  refreshToken: (dto: RefreshRequest): Promise<TokenResponse> =>
    axiosInstance.post<TokenResponse>('/auth/refresh', dto).then((res) => res.data),

  verifyEmail: (dto: VerifyEmailRequest): Promise<User> =>
    axiosInstance.post<User>('/auth/verify-email', dto).then((res) => res.data),

  resendVerification: (): Promise<{ message: string }> =>
    axiosInstance.post<{ message: string }>('/auth/resend-verification').then((res) => res.data),

  updateProfile: (dto: UpdateProfileRequest | FormData): Promise<User> =>
    axiosInstance
      .patch<User>(
        '/auth/me',
        dto,
        isFormData(dto)
          ? {
              headers: { 'Content-Type': undefined },
              transformRequest: [(data: unknown): unknown => data],
            }
          : undefined,
      )
      .then((res) => res.data),

  googleLogin: (dto: GoogleAuthRequestDto): Promise<GoogleAuthResponse> =>
    axiosInstance.post<GoogleAuthResponse>('/auth/google', dto).then((res) => res.data),
};

/**
 * Detects a native or web FormData payload without assuming a specific runtime constructor.
 *
 * @param value - Profile update payload.
 * @returns True when the payload is FormData.
 */
function isFormData(value: UpdateProfileRequest | FormData): value is FormData {
  if (typeof FormData !== 'undefined' && value instanceof FormData) return true;

  if (typeof value !== 'object' || value === null) return false;
  const nativeFormData = value as unknown as { getParts?: unknown };
  return typeof nativeFormData.getParts === 'function';
}
