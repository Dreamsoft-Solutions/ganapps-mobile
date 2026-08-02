import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, Save } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { getInterestOptions } from '@/constants/interests';
import { Routes } from '@/constants/routes';
import { useUpdateProfileMutation } from '@/hooks/mutations/useAuthMutation';
import type { User } from '@/types/user.types';
import { type ProfileFormData, profileSchema } from '@/utils/validation';

interface EditProfileFormProps {
  user: User;
}

/**
 * Form for editing the fields supported by the current User profile API.
 *
 * @param props - Current User values used to initialize the form.
 * @returns A profile editing form with avatar, identity, bio, and interests.
 */
export function EditProfileForm({ user }: EditProfileFormProps): ReactElement {
  const router = useRouter();
  const updateProfileMutation = useUpdateProfileMutation();
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const methods = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: getProfileDefaults(user),
  });
  const selectedInterests: string[] = methods.watch('interests');
  const interestOptions = getInterestOptions(selectedInterests);

  useEffect((): void => {
    methods.reset(getProfileDefaults(user));
    setLocalAvatarUri(null);
  }, [methods, user]);

  const pickAvatar = useCallback(async (): Promise<void> => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLocalAvatarUri(result.assets[0].uri);
    }
  }, []);

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
    [methods, selectedInterests],
  );

  const onSubmit = useCallback(
    async (data: ProfileFormData): Promise<void> => {
      const profileData = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        bio: data.bio.trim(),
        interests: data.interests,
      };

      if (!localAvatarUri) {
        await updateProfileMutation.mutateAsync(profileData);
      } else {
        const formData = new FormData();
        formData.append('firstName', profileData.firstName);
        formData.append('lastName', profileData.lastName);
        formData.append('bio', profileData.bio);
        formData.append('interests', JSON.stringify(profileData.interests));

        const filename: string = localAvatarUri.split('/').pop() ?? 'avatar.jpg';
        const match: RegExpExecArray | null = /\.(\w+)$/.exec(filename);
        const extension: string = match?.[1]?.toLowerCase() ?? 'jpeg';
        const type: string = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
        formData.append('file', {
          uri: localAvatarUri,
          name: filename,
          type,
        } as unknown as Blob);

        await updateProfileMutation.mutateAsync(formData);
      }

      router.replace(Routes.app.profile);
    },
    [localAvatarUri, router, updateProfileMutation],
  );

  const displayName: string = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username;

  return (
    <FormProvider {...methods}>
      <View className="gap-lg pb-xl">
        <View className="items-center">
          <Pressable onPress={pickAvatar} className="relative">
            <Avatar src={localAvatarUri ?? user.displayPicture} name={displayName} size="lg" />
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary">
              <Camera size={14} className="text-primary-foreground" />
            </View>
          </Pressable>
          <Text className="mt-3 text-body-md text-muted-foreground">Tap to change your photo</Text>
        </View>

        <Input name="firstName" label="First Name" placeholder="Maria" autoCapitalize="words" />
        <Input name="lastName" label="Last Name" placeholder="Santos" autoCapitalize="words" />
        <Input
          name="bio"
          label="Bio"
          placeholder="Tell people a little about yourself"
          multiline
          numberOfLines={4}
          maxLength={280}
        />

        <View>
          <Text className="mb-3 text-label-md text-foreground">Your Interests</Text>
          <View className="flex-row flex-wrap gap-2">
            {interestOptions.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={selectedInterests.includes(item.id)}
                onPress={(): void => toggleInterest(item.id)}
              />
            ))}
          </View>
        </View>

        {updateProfileMutation.error && (
          <Text className="text-body-md text-destructive">{updateProfileMutation.error.message}</Text>
        )}

        <Button
          onPress={methods.handleSubmit(onSubmit)}
          loading={updateProfileMutation.isPending}
          size="lg"
          leftIcon={<Save size={18} />}
        >
          Save Changes
        </Button>
      </View>
    </FormProvider>
  );
}

/**
 * Creates form defaults from the current User response.
 *
 * @param user - Current User profile.
 * @returns Values accepted by the profile form schema.
 */
function getProfileDefaults(user: User): ProfileFormData {
  return {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    bio: user.bio ?? '',
    interests: user.interests ?? [],
  };
}
