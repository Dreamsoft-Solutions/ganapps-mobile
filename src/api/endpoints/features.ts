import axiosInstance from '../axios-instance';
import type {
  Feature,
  CreateFeatureDto,
  UpdateFeatureDto,
} from '@/types/feature.types';
import type { PaginatedResponse } from '../types/api-response';

export const featuresAPI = {
  getAll: (params?: { skip?: number; take?: number }) =>
    axiosInstance
      .get<PaginatedResponse<Feature>>('/features', { params })
      .then((res) => res.data),

  getById: (id: string) =>
    axiosInstance.get<Feature>(`/features/${id}`).then((res) => res.data),

  create: (dto: CreateFeatureDto) =>
    axiosInstance.post<Feature>('/features', dto).then((res) => res.data),

  update: (id: string, dto: UpdateFeatureDto) =>
    axiosInstance
      .put<Feature>(`/features/${id}`, dto)
      .then((res) => res.data),

  delete: (id: string) =>
    axiosInstance.delete(`/features/${id}`).then((res) => res.data),
};
