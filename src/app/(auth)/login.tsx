import { View, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginForm } from '@/components/forms/LoginForm';
import { Text } from '@/components/common/Text';

export default function LoginScreen() {
  return (
    <SafeAreaView className="flex-1 bg-lynx-background">
      <ScrollView className="flex-1 px-6">
        <View className="justify-center pt-12">
          <Text className="text-3xl font-bold mb-2 text-center">
            Welcome Back
          </Text>
          <Text className="text-lynx-on-surface-variant text-center mb-8">
            Sign in to your account
          </Text>

          <LoginForm />

          <View className="mt-6 flex-row justify-center gap-2">
            <Text className="text-lynx-on-surface-variant">
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/register" className="text-lynx-primary-container font-semibold">
              Register
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
