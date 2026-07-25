import {
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutateAsyncFunction,
  type UseQueryResult,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { featuresAPI } from '@/api/endpoints/features';
import type { PaginatedResponse } from '@/api/types/api-response';
import type { CreateFeatureDto, Feature, UpdateFeatureDto } from '@/types/feature.types';

type FeaturePage = PaginatedResponse<Feature>;
type FeaturesInfiniteResult = UseInfiniteQueryResult<InfiniteData<FeaturePage, number>, Error>;

export interface UseFeaturesResult {
  items: Feature[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  fetchNextPage: FeaturesInfiniteResult['fetchNextPage'];
  isFetchingNextPage: boolean;
  create: UseMutateAsyncFunction<Feature, Error, CreateFeatureDto>;
  update: UseMutateAsyncFunction<Feature, Error, { id: string; dto: UpdateFeatureDto }>;
  delete: UseMutateAsyncFunction<void, Error, string>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export const featureQueryKeys = {
  all: ['features'] as const,
  list: () => [...featureQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...featureQueryKeys.all, 'detail', id] as const,
};

export function useFeatureDetail(id: string): UseQueryResult<Feature, Error> {
  return useQuery<Feature, Error>({
    queryKey: featureQueryKeys.detail(id),
    queryFn: () => featuresAPI.getById(id),
    enabled: !!id,
  });
}

export function useFeatures(): UseFeaturesResult {
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery<
    FeaturePage,
    Error,
    InfiniteData<FeaturePage, number>,
    readonly unknown[],
    number
  >({
    queryKey: featureQueryKeys.list(),
    queryFn: ({ pageParam }: { pageParam: number }) =>
      featuresAPI.getAll({
        skip: pageParam,
        take: 10,
      }),
    getNextPageParam: (lastPage: FeaturePage): number | undefined => {
      if (!lastPage.meta) return undefined;
      const nextSkip = lastPage.meta.skip + lastPage.meta.take;
      return nextSkip < lastPage.meta.total ? nextSkip : undefined;
    },
    initialPageParam: 0,
  });

  const createMutation = useMutation<Feature, Error, CreateFeatureDto>({
    mutationFn: (dto: CreateFeatureDto): Promise<Feature> => featuresAPI.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: featureQueryKeys.all,
      });
    },
  });

  const updateMutation = useMutation<Feature, Error, { id: string; dto: UpdateFeatureDto }>({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFeatureDto }): Promise<Feature> => featuresAPI.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: featureQueryKeys.all,
      });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id: string): Promise<void> => featuresAPI.delete(id),
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
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
