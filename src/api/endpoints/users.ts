import axiosInstance from '../axios-instance';
import type { User } from '@/types/user.types';

export const usersAPI = {
  getById: (id: string) =>
    axiosInstance.get<User>(`/users/${id}`).then((res) => res.data),
};
