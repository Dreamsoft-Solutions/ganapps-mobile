import type {
  GoogleAuthRequestDto,
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
  login: (dto: LoginDto): Promise<TokenResponse> =>
    axiosInstance.post<TokenResponse>('/auth/login', dto).then((res) => res.data),

  register: (dto: RegisterDto): Promise<RegisterResponse> =>
    axiosInstance.post<RegisterResponse>('/auth/register', dto).then((res) => res.data),

  logout: (refreshToken?: string): Promise<void> =>
    axiosInstance.post<void>('/auth/logout', { refreshToken }).then((res) => res.data),

  getMe: (): Promise<User> => axiosInstance.get<User>('/auth/me').then((res) => res.data),

  refreshToken: (dto: RefreshRequest): Promise<TokenResponse> =>
    axiosInstance.post<TokenResponse>('/auth/refresh', dto).then((res) => res.data),

  verifyEmail: (dto: VerifyEmailRequest): Promise<User> =>
    axiosInstance.post<User>('/auth/verify-email', dto).then((res) => res.data),

  resendVerification: (): Promise<{ message: string }> =>
    axiosInstance.post<{ message: string }>('/auth/resend-verification').then((res) => res.data),

  updateProfile: (dto: UpdateProfileRequest | FormData): Promise<User> => {
    if (dto instanceof FormData) {
      return axiosInstance
        .patch<User>('/auth/me', dto, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((res) => res.data);
    }
    return axiosInstance.patch<User>('/auth/me', dto).then((res) => res.data);
  },

  googleLogin: (dto: GoogleAuthRequestDto): Promise<TokenResponse> =>
    axiosInstance.post<TokenResponse>('/auth/google', dto).then((res) => res.data),
};
