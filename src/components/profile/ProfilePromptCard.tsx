import { useRouter } from 'expo-router';
import { Sparkles, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { IconButton } from '@/components/common/IconButton';
import { Text } from '@/components/common/Text';
import { Routes } from '@/constants/routes';

interface ProfilePromptCardProps {
  /** Called when the user taps the close control. */
  onDismiss: () => void;
}

/**
 * Dismissible card inviting a user who skipped optional onboarding to finish it.
 *
 * Purely presentational — whether it should appear at all is decided by `useProfilePrompt`.
 * The primary action opens the profile edit screen, which already handles the avatar, bio and
 * interests, and already returns here once saved.
 *
 * @param props - The component props.
 * @param props.onDismiss - Called when the user taps the close control.
 * @returns The prompt card.
 */
export function ProfilePromptCard({ onDismiss }: ProfilePromptCardProps): ReactElement {
  const router = useRouter();

  return (
    <Card className="mb-lg">
      <View className="mb-xs flex-row items-start justify-between">
        <View className="mr-xs min-w-0 flex-1 flex-row items-center">
          <View className="mr-xs">
            <Sparkles size={18} className="text-primary" />
          </View>
          <Text className="text-headline-sm">Finish your profile</Text>
        </View>
        <IconButton accessibilityLabel="Dismiss" onPress={onDismiss}>
          <X size={18} className="text-muted-foreground" />
        </IconButton>
      </View>

      <Text className="mb-sm text-body-md text-muted-foreground">
        Add a photo and pick a few interests so we can suggest events you would actually go to.
      </Text>

      <Button
        size="sm"
        onPress={(): void => {
          router.push(Routes.profileEdit);
        }}
      >
        Add details
      </Button>
    </Card>
  );
}
