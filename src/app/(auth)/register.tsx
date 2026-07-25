import { Link } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { RegisterForm } from '@/components/forms/RegisterForm';

export default function RegisterScreen() {
  return (
    <SafeAreaView className="flex-1 bg-lynx-background">
      <ScrollView className="flex-1 px-6">
        <View className="justify-center pt-12">
          <Text className="text-3xl font-bold mb-2 text-center">Create Account</Text>
          <Text className="text-lynx-on-surface-variant text-center mb-8">Sign up to get started</Text>

          <RegisterForm />

          <View className="mt-6 flex-row justify-center gap-2">
            <Text className="text-lynx-on-surface-variant">Already have an account? </Text>
            <Link href="/(auth)/login" className="text-lynx-primary-container font-semibold">
              Sign In
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
