import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Loading } from '@/components/common/Loading';
import { Routes } from '@/constants/routes';
import { useAuthStore } from '@/store/auth.store';
import { isValidGanapShareId } from '@/utils/share-links';

/**
 * Opens a Ganap detail screen from a shared Ganap URL.
 *
 * @returns A loading screen while the route forwards to Ganap detail or sign-in.
 */
export default function GanapShareRoute(): ReactElement {
  const router = useRouter();
  const { id: ganapId } = useLocalSearchParams<{ id?: string | string[] }>();
  const token = useAuthStore((state) => state.token);

  useEffect((): void => {
    if (typeof ganapId !== 'string' || !isValidGanapShareId(ganapId)) {
      router.replace(Routes.public.welcome);
      return;
    }

    router.replace(token === null ? Routes.auth.loginForGanapShare(ganapId) : Routes.ganapDetail(ganapId));
  }, [ganapId, router, token]);

  return <Loading message="Opening Ganap..." />;
}
