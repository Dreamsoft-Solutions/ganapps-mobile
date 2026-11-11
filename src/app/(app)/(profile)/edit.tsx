import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { EditProfileForm } from '@/components/forms/EditProfileForm';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAuthQuery } from '@/hooks/queries/useAuthQuery';
import { getQueryFailure } from '@/utils/query-failure';

/**
 * Edit profile screen.
 *
 * @returns The current User profile form or its loading/error state.
 */
export default function EditProfileScreen(): ReactElement {
  const profileQuery = useAuthQuery();
  const router = useRouter();
  const failure: Error | null = getQueryFailure(profileQuery);

  let content: ReactElement;
  if (profileQuery.isLoading) content = <Loading message="Loading your profile" />;
  else if (failure) content = <ErrorView error={failure} onRetry={(): void => void profileQuery.refetch()} />;
  else if (!profileQuery.data) content = <ErrorView error={new Error('Profile not found')} />;
  else {
    content = (
      <ScrollView
        className="flex-1 px-md"
        contentContainerStyle={{ paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <EditProfileForm user={profileQuery.data} />
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Edit profile" onBack={(): void => router.back()} backHint="Returns to your profile" />
      {content}
    </View>
  );
}
