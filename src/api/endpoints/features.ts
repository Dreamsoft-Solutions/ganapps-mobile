import type { CreateFeatureDto, Feature, UpdateFeatureDto } from '@/types/feature.types';
import axiosInstance from '../axios-instance';
import type { PaginatedResponse } from '../types/api-response';

export const featuresAPI = {
  getAll: (params?: { skip?: number; take?: number }): Promise<PaginatedResponse<Feature>> =>
    axiosInstance.get<PaginatedResponse<Feature>>('/features', { params }).then((res) => res.data),

  getById: (id: string): Promise<Feature> => axiosInstance.get<Feature>(`/features/${id}`).then((res) => res.data),

  create: (dto: CreateFeatureDto): Promise<Feature> =>
    axiosInstance.post<Feature>('/features', dto).then((res) => res.data),

  update: (id: string, dto: UpdateFeatureDto): Promise<Feature> =>
    axiosInstance.put<Feature>(`/features/${id}`, dto).then((res) => res.data),

  delete: (id: string): Promise<void> => axiosInstance.delete<void>(`/features/${id}`).then((res) => res.data),
};
