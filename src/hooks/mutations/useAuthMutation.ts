import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/auth.store';
import type {
  GoogleAuthRequestDto,
  LoginDto,
  RegisterDto,
  RegisterResponse,
  TokenResponse,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from '@/types/auth.types';
import type { User } from '@/types/user.types';
import { authQueryKeys } from '../queries/useAuthQuery';

export function useLoginMutation(): UseMutationResult<TokenResponse, Error, LoginDto> {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<TokenResponse, Error, LoginDto>({
    mutationFn: (dto: LoginDto): Promise<TokenResponse> => authAPI.login(dto),
    onSuccess: (data: TokenResponse): void => {
      setAuth(data.accessToken, data.refreshToken, data.expiresIn);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
    },
  });
}

export function useRegisterMutation(): UseMutationResult<RegisterResponse, Error, RegisterDto> {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<RegisterResponse, Error, RegisterDto>({
    mutationFn: (dto: RegisterDto): Promise<RegisterResponse> => authAPI.register(dto),
    onSuccess: (data: RegisterResponse): void => {
      setAuth(data.accessToken, data.refreshToken, data.expiresIn);
    },
  });
}

export function useGoogleLoginMutation(): UseMutationResult<TokenResponse, Error, GoogleAuthRequestDto> {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<TokenResponse, Error, GoogleAuthRequestDto>({
    mutationFn: (dto: GoogleAuthRequestDto): Promise<TokenResponse> => authAPI.googleLogin(dto),
    onSuccess: (data: TokenResponse): void => {
      setAuth(data.accessToken, data.refreshToken, data.expiresIn);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
    },
  });
}

export function useLogoutMutation(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation<void, Error, void>({
    mutationFn: () => authAPI.logout(),
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
    },
  });
}

export function useVerifyEmailMutation(): UseMutationResult<User, Error, VerifyEmailRequest> {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<User, Error, VerifyEmailRequest>({
    mutationFn: (dto: VerifyEmailRequest): Promise<User> => authAPI.verifyEmail(dto),
    onSuccess: (user: User): void => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
    },
  });
}

export function useResendVerificationMutation(): UseMutationResult<{ message: string }, Error, void> {
  return useMutation<{ message: string }, Error, void>({
    mutationFn: () => authAPI.resendVerification(),
  });
}

export function useUpdateProfileMutation(): UseMutationResult<User, Error, UpdateProfileRequest | FormData> {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<User, Error, UpdateProfileRequest | FormData>({
    mutationFn: (dto: UpdateProfileRequest | FormData): Promise<User> => authAPI.updateProfile(dto),
    onSuccess: (user: User): void => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
    },
  });
}
