import type {
  LoginDto,
  RefreshRequest,
  RegisterDto,
  RegisterResponse,
  TokenResponse,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from '@/types/auth.types';
import type { User } from '@/types/user.types';
import axiosInstance from '../axios-instance';

export const authAPI = {
  login: (dto: LoginDto) => axiosInstance.post<TokenResponse>('/auth/login', dto).then((res) => res.data),

  register: (dto: RegisterDto) => axiosInstance.post<RegisterResponse>('/auth/register', dto).then((res) => res.data),

  logout: (refreshToken?: string) => axiosInstance.post<void>('/auth/logout', { refreshToken }).then((res) => res.data),

  getMe: () => axiosInstance.get<User>('/auth/me').then((res) => res.data),

  refreshToken: (dto: RefreshRequest) =>
    axiosInstance.post<TokenResponse>('/auth/refresh', dto).then((res) => res.data),

  verifyEmail: (dto: VerifyEmailRequest) => axiosInstance.post<User>('/auth/verify-email', dto).then((res) => res.data),

  resendVerification: () =>
    axiosInstance.post<{ message: string }>('/auth/resend-verification').then((res) => res.data),

  updateProfile: (dto: UpdateProfileRequest) => axiosInstance.patch<User>('/auth/me', dto).then((res) => res.data),
};
