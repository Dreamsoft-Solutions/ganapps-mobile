import type { ReactElement } from 'react';
import { ScrollView } from 'react-native';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { EditProfileForm } from '@/components/forms/EditProfileForm';
import { useAuthQuery } from '@/hooks/queries/useAuthQuery';

/**
 * Edit profile screen.
 *
 * @returns The current User profile form or its loading/error state.
 */
export default function EditProfileScreen(): ReactElement {
  const profileQuery = useAuthQuery();

  if (profileQuery.isLoading) return <Loading message="Loading your profile..." />;
  if (profileQuery.error) {
    return <ErrorView error={profileQuery.error} onRetry={(): void => void profileQuery.refetch()} />;
  }
  if (!profileQuery.data) return <ErrorView error={new Error('Profile not found')} />;

  return (
    <ScrollView
      className="flex-1 bg-background px-md"
      contentContainerStyle={{ paddingBottom: 96 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <EditProfileForm user={profileQuery.data} />
    </ScrollView>
  );
}
