import type { User } from '@/types/user.types';
import axiosInstance from '../axios-instance';

export const usersAPI = {
  getById: (id: string) => axiosInstance.get<User>(`/users/${id}`).then((res) => res.data),
};
