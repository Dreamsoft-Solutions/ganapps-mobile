import axiosInstance from '../axios-instance';
import type { LoginDto, RegisterDto, LoginResponse } from '@/types/auth.types';
import type { User } from '@/types/user.types';

export const authAPI = {
  login: (dto: LoginDto) =>
    axiosInstance
      .post<LoginResponse>('/auth/login', dto)
      .then((res) => res.data),

  register: (dto: RegisterDto) =>
    axiosInstance
      .post<LoginResponse>('/auth/register', dto)
      .then((res) => res.data),

  logout: () =>
    axiosInstance.post('/auth/logout').then((res) => res.data),

  getMe: () =>
    axiosInstance.get<User>('/auth/me').then((res) => res.data),

  refreshToken: (refreshToken: string) =>
    axiosInstance
      .post<LoginResponse>('/auth/refresh', { refreshToken })
      .then((res) => res.data),
};
