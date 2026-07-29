import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { useUploadAvatarMutation } from '@/hooks/mutations/useAuthMutation';
import { useAuth } from '@/hooks/useAuth';
import type { UpdateProfileRequest } from '@/types/auth.types';
import { type OnboardingFormData, onboardingSchema } from '@/utils/validation';

const INTERESTS = [
  { id: 'food', label: 'Food' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'study', label: 'Study' },
  { id: 'coworking', label: 'Coworking' },
  { id: 'sports', label: 'Sports' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'travel', label: 'Travel' },
  { id: 'casual', label: 'Casual Hangout' },
] as const;

/**
 * Profile setup form used after registration and email verification.
 *
 * @returns The onboarding form with avatar, name, and interests.
 */
export function OnboardingForm(): ReactElement {
  const { updateProfile, updateProfileMutation } = useAuth();
  const uploadAvatarMutation = useUploadAvatarMutation();
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  const methods = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      displayPicture: '',
      interests: [],
    },
  });

  const selectedInterests = methods.watch('interests') ?? [];

  const pickAvatar = useCallback(async (): Promise<void> => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLocalAvatarUri(result.assets[0].uri);
      methods.setValue('displayPicture', result.assets[0].uri);
    }
  }, [methods]);

  const toggleInterest = useCallback(
    (interestId: string): void => {
      const current = new Set(selectedInterests);
      if (current.has(interestId)) {
        current.delete(interestId);
      } else {
        current.add(interestId);
      }
      methods.setValue('interests', Array.from(current), { shouldValidate: true });
    },
    [selectedInterests, methods],
  );

  const onSubmit = useCallback(
    async (data: OnboardingFormData): Promise<void> => {
      let displayPicture: string | undefined;

      if (localAvatarUri) {
        const formData = new FormData();
        const filename = localAvatarUri.split('/').pop() ?? 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
          uri: localAvatarUri,
          name: filename,
          type,
        } as unknown as Blob);

        const uploadResult = await uploadAvatarMutation.mutateAsync(formData);
        displayPicture = uploadResult.url;
      }

      const dto: UpdateProfileRequest = {
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        displayPicture,
        interests: data.interests,
      };

      await updateProfile(dto);
    },
    [localAvatarUri, uploadAvatarMutation, updateProfile],
  );

  const fullName = `${methods.watch('firstName') ?? ''} ${methods.watch('lastName') ?? ''}`.trim();

  return (
    <FormProvider {...methods}>
      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        <View className="items-center mb-8">
          <Pressable onPress={pickAvatar} className="relative">
            <Avatar src={localAvatarUri} name={fullName} size="lg" />
            <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary items-center justify-center border-2 border-background shadow">
              <Camera size={14} color="#FFFFFF" />
            </View>
          </Pressable>
          <Text className="text-muted-foreground text-body-md mt-3">Tap to add a photo</Text>
        </View>

        <Input name="firstName" label="First Name" placeholder="Maria" />
        <Input name="lastName" label="Last Name" placeholder="Santos" />

        <View className="mb-4">
          <Text className="text-label-md text-foreground mb-3">Your Interests</Text>
          <View className="flex-row flex-wrap gap-2">
            {INTERESTS.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={selectedInterests.includes(item.id)}
                onPress={(): void => toggleInterest(item.id)}
              />
            ))}
          </View>
          {methods.formState.errors.interests?.message && (
            <Text className="text-destructive text-body-md mt-2">
              {methods.formState.errors.interests.message as string}
            </Text>
          )}
        </View>

        <Button
          onPress={methods.handleSubmit(onSubmit)}
          loading={updateProfileMutation.isPending || uploadAvatarMutation.isPending}
          size="lg"
        >
          Continue
        </Button>
      </ScrollView>
    </FormProvider>
  );
}
