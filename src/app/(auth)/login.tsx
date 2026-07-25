import { Link } from 'expo-router';
import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { LoginForm } from '@/components/forms/LoginForm';

export default function LoginScreen(): ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-lynx-background">
      <ScrollView className="flex-1 px-6">
        <View className="justify-center pt-12">
          <Text className="text-3xl font-bold mb-2 text-center">Welcome Back</Text>
          <Text className="text-lynx-on-surface-variant text-center mb-8">Sign in to your account</Text>

          <LoginForm />

          <View className="mt-6 flex-row justify-center gap-2">
            <Text className="text-lynx-on-surface-variant">Don't have an account? </Text>
            <Link href="/(auth)/register" className="text-lynx-primary-container font-semibold">
              Register
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
