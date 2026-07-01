import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { featuresAPI } from '@/api/endpoints/features';
import type {
  Feature,
  CreateFeatureDto,
  UpdateFeatureDto,
} from '@/types/feature.types';

export const featureQueryKeys = {
  all: ['features'] as const,
  list: () => [...featureQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...featureQueryKeys.all, 'detail', id] as const,
};

export function useFeatures() {
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: featureQueryKeys.list(),
    queryFn: ({ pageParam = 0 }) =>
      featuresAPI.getAll({
        skip: pageParam as number,
        take: 10,
      }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const nextSkip =
        lastPage.pagination.skip + lastPage.pagination.take;
      return nextSkip < lastPage.pagination.total ? nextSkip : undefined;
    },
    initialPageParam: 0,
  });

  const detailQuery = (id: string) =>
    useQuery<Feature, Error>({
      queryKey: featureQueryKeys.detail(id),
      queryFn: () => featuresAPI.getById(id),
      enabled: !!id,
    });

  const createMutation = useMutation<Feature, Error, CreateFeatureDto>({
    mutationFn: (dto) => featuresAPI.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: featureQueryKeys.all,
      });
    },
  });

  const updateMutation = useMutation<
    Feature,
    Error,
    { id: string; dto: UpdateFeatureDto }
  >({
    mutationFn: ({ id, dto }) => featuresAPI.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: featureQueryKeys.all,
      });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => featuresAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: featureQueryKeys.all,
      });
    },
  });

  return {
    items: data?.pages.flatMap((page) => page.data) ?? [],
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    detail: detailQuery,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
