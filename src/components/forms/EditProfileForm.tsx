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
import { showToast } from '@/store/toast.store';
import type { User } from '@/types/user.types';
import { prepareProfileUploadPhoto, profilePhotoFile } from '@/utils/photo-upload';
import { PROFILE_FIELD_LIMITS, type ProfileFormData, profileSchema } from '@/utils/validation';

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
  const [localAvatar, setLocalAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState<boolean>(false);
  const methods = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: getProfileDefaults(user),
  });
  const selectedInterests: string[] = methods.watch('interests');
  const interestOptions = getInterestOptions(selectedInterests);

  useEffect((): void => {
    methods.reset(getProfileDefaults(user));
    setLocalAvatar(null);
  }, [methods, user]);

  const pickAvatar = useCallback(async (): Promise<void> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setIsPreparingAvatar(true);
        setLocalAvatar(await prepareProfileUploadPhoto(result.assets[0]));
      }
    } catch {
      showToast('error', 'Could not use this photo. Choose another photo or try again.');
    } finally {
      setIsPreparingAvatar(false);
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
      if (isPreparingAvatar) return;
      const profileData = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        bio: data.bio.trim(),
        interests: data.interests,
      };

      if (!localAvatar) {
        await updateProfileMutation.mutateAsync(profileData);
      } else {
        const formData = new FormData();
        formData.append('firstName', profileData.firstName);
        formData.append('lastName', profileData.lastName);
        formData.append('bio', profileData.bio);
        formData.append('interests', JSON.stringify(profileData.interests));

        formData.append('file', profilePhotoFile(localAvatar) as unknown as Blob);

        await updateProfileMutation.mutateAsync(formData);
      }

      router.replace(Routes.app.profile);
    },
    [isPreparingAvatar, localAvatar, router, updateProfileMutation],
  );

  const displayName: string = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username;

  return (
    <FormProvider {...methods}>
      <View className="gap-lg pb-xl">
        <View className="items-center">
          <Pressable onPress={pickAvatar} className="relative" disabled={isPreparingAvatar}>
            <Avatar src={localAvatar?.uri ?? user.displayPicture} name={displayName} size="lg" />
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary">
              <Camera size={14} className="text-primary-foreground" />
            </View>
          </Pressable>
          <Text className="mt-3 text-body-md text-muted-foreground">Tap to change your photo</Text>
        </View>

        <Input
          name="firstName"
          label="First Name"
          placeholder="Maria"
          autoCapitalize="words"
          maxLength={PROFILE_FIELD_LIMITS.nameMaxLength}
          helperText={`Up to ${PROFILE_FIELD_LIMITS.nameMaxLength} characters.`}
        />
        <Input
          name="lastName"
          label="Last Name"
          placeholder="Santos"
          autoCapitalize="words"
          maxLength={PROFILE_FIELD_LIMITS.nameMaxLength}
          helperText={`Up to ${PROFILE_FIELD_LIMITS.nameMaxLength} characters.`}
        />
        <Input
          name="bio"
          label="Bio"
          placeholder="Tell people a little about yourself"
          multiline
          numberOfLines={4}
          maxLength={PROFILE_FIELD_LIMITS.bioMaxLength}
          helperText={`Up to ${PROFILE_FIELD_LIMITS.bioMaxLength} characters.`}
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
          loading={isPreparingAvatar || updateProfileMutation.isPending}
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
