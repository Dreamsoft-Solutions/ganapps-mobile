import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { Lobe } from '@/components/common/Lobe';
import { BrandLockup } from '@/components/onboarding/BrandLockup';
import { ONBOARDING_LOBES } from '@/constants/onboarding';

/**
 * The JS splash composition: the two background lobes and the brand lockup held at progress 0
 * (logo at the window centre, title and tagline under it). It is the first JS frame under the
 * native splash, so it matches it, and it is what a development reload shows while the root
 * loading gate is up. Static: the progress value is created once and never changed.
 *
 * @returns The full-screen splash composition on the theme background.
 * @example
 * if (!isHydrated || !migrationsReady) {
 *   return <SplashView />;
 * }
 */
export function SplashView(): ReactElement {
  const progress = useSharedValue(0);
  const [topRightLobe, bottomLeftLobe] = ONBOARDING_LOBES;

  return (
    <View className="flex-1 overflow-hidden bg-background">
      <Lobe {...topRightLobe} />
      <Lobe {...bottomLeftLobe} />
      <BrandLockup progress={progress} />
    </View>
  );
}
