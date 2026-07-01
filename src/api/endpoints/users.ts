import axiosInstance from '../axios-instance';
import type { User } from '@/types/user.types';

export const usersAPI = {
  getMe: () =>
    axiosInstance.get<User>('/users/me').then((res) => res.data),

  updateProfile: (dto: Partial<Pick<User, 'name' | 'avatar'>>) =>
    axiosInstance
      .patch<User>('/users/me', dto)
      .then((res) => res.data),
};
