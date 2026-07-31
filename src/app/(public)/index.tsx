import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { Routes } from '@/constants/routes';

const logo = require('../../../assets/brand/ganap-logo-1.png');

/**
 * Public welcome screen shown to unauthenticated users.
 *
 * @returns The splash/welcome screen.
 */
export default function WelcomeScreen(): ReactElement {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-8">
        <View className="items-center">
          <View style={{ width: 96, height: 96, marginBottom: 24 }}>
            <Image
              source={logo}
              style={{ width: 96, height: 96, borderRadius: 9999 }}
              contentFit="contain"
              accessibilityLabel="Ganapps logo"
            />
          </View>
          <Text className="text-headline-lg text-foreground text-center mb-3">Ganapps</Text>
          <Text className="text-body-lg text-muted-foreground text-center max-w-[280px]">
            Find what is happening across Iloilo, make the plan with your people, and keep every event detail close.
          </Text>
        </View>
      </View>

      <View className="px-8 pb-12 pt-6 gap-3">
        <Button
          size="lg"
          onPress={(): void => {
            router.push(Routes.auth.login);
          }}
        >
          Get Started
        </Button>
        <Button
          variant="outline"
          size="lg"
          onPress={(): void => {
            router.push(Routes.auth.login);
          }}
        >
          Log In
        </Button>
        <Text className="text-muted-foreground text-label-sm text-center mt-4">
          Made for Iloilo. Built for everyone.
        </Text>
      </View>
    </SafeAreaView>
  );
}
