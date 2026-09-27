import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Loading } from '@/components/common/Loading';
import { Routes } from '@/constants/routes';
import { useAuthStore } from '@/store/auth.store';
import { isValidFriendCode, normalizeFriendCode } from '@/utils/friends';

/**
 * Opens the existing Add Friend flow from a shared Friend Code URL.
 *
 * @returns A loading screen while the route forwards to Add Friend or sign-in.
 */
export default function FriendShareRoute(): ReactElement {
  const router = useRouter();
  const { code: rawCode } = useLocalSearchParams<{ code?: string | string[] }>();
  const token = useAuthStore((state) => state.token);
  const code: string | null = typeof rawCode === 'string' ? normalizeFriendCode(rawCode) : null;

  useEffect((): void => {
    if (code === null || !isValidFriendCode(code)) {
      router.replace(Routes.public.welcome);
      return;
    }

    router.replace(token === null ? Routes.auth.loginForFriendShare(code) : Routes.friendAddWithCode(code));
  }, [code, router, token]);

  return <Loading message="Opening Friend Code..." />;
}
