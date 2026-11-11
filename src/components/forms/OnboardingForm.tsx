import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { INTEREST_OPTIONS } from '@/constants/interests';
import { Routes } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { recordPromptDismissal } from '@/hooks/useProfilePrompt';
import { showToast } from '@/store/toast.store';
import { prepareProfileUploadPhoto, profilePhotoFile } from '@/utils/photo-upload';
import {
  type OnboardingFormData,
  onboardingNamesSchema,
  onboardingSchema,
  PROFILE_FIELD_LIMITS,
} from '@/utils/validation';

type Step = 'names' | 'extras';

/**
 * Two-step profile setup shown after email verification.
 *
 * Step one collects first and last name, is required, and has no skip control: it saves to
 * the server before advancing, so a user who quits on step two keeps their names and is not
 * sent back here on the next launch. Step two collects an avatar and interests, is skippable,
 * and never blocks entry to the app. Leaving step two by any route records a profile-prompt
 * dismissal, so the card inviting the user back to these fields does not appear on their next
 * visit to the Profile tab.
 *
 * @returns The onboarding form for whichever step is active.
 */
export function OnboardingForm(): ReactElement {
  const router = useRouter();
  const { user, updateProfile, updateProfileMutation } = useAuth();
  const [step, setStep] = useState<Step>('names');
  const [localAvatar, setLocalAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState<boolean>(false);

  const methods = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      // Google sign-up puts the full display name in `firstName` and leaves `lastName`
      // null, so prefill and let the user split it.
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      displayPicture: '',
      interests: [],
    },
  });

  const selectedInterests = methods.watch('interests') ?? [];
  const submitError = updateProfileMutation.error;

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
        const photo: ImagePicker.ImagePickerAsset = await prepareProfileUploadPhoto(result.assets[0]);
        setLocalAvatar(photo);
        methods.setValue('displayPicture', photo.uri);
      }
    } catch {
      showToast('error', 'Could not use this photo. Choose another photo or try again.');
    } finally {
      setIsPreparingAvatar(false);
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

  const submitNames = useCallback(async (): Promise<void> => {
    // Parse (rather than just `trigger`) so the trimmed, validated data is what actually gets
    // sent — `trigger` only populates field errors and doesn't write transforms back into
    // form state, so `getValues()` alone would still return untrimmed input.
    const parsed = onboardingNamesSchema.safeParse(methods.getValues());
    if (!parsed.success) {
      // Still show inline field errors for a blank/invalid submission.
      await methods.trigger(['firstName', 'lastName']);
      return;
    }

    try {
      await updateProfile(parsed.data);
      setStep('extras');
    } catch (_error) {
      // Rendered from `updateProfileMutation.error` below. The user stays on this step and
      // can retry; nothing is lost and nothing traps them, because the redirect that brought
      // them here reads server state, which is unchanged by a failed save.
    }
  }, [methods, updateProfile]);

  const seedPromptCooldown = useCallback((): void => {
    // Starts the profile-card cooldown as the user leaves step two, whichever button they
    // pressed. Without it the card would greet them on their next visit to Profile, seconds
    // after they chose to skip. Seeding after a successful save is harmless: interests are
    // set, so the card is suppressed permanently anyway.
    if (user) void recordPromptDismissal(user.id);
  }, [user]);

  const submitExtras = useCallback(async (): Promise<void> => {
    if (isPreparingAvatar) return;
    const { interests } = methods.getValues();
    const hasInterests = !!interests && interests.length > 0;

    if (!hasInterests && !localAvatar) {
      seedPromptCooldown();
      router.replace(Routes.app.home);
      return;
    }

    const formData = new FormData();

    if (hasInterests) {
      formData.append('interests', JSON.stringify(interests));
    }

    if (localAvatar) {
      formData.append('file', profilePhotoFile(localAvatar) as unknown as Blob);
    }

    try {
      await updateProfile(formData);
      seedPromptCooldown();
      router.replace(Routes.app.home);
    } catch (_error) {
      // Rendered below. Step two is optional, so the user can still skip past a failure.
    }
  }, [isPreparingAvatar, methods, localAvatar, seedPromptCooldown, updateProfile, router]);

  const skipExtras = useCallback((): void => {
    if (isPreparingAvatar) return;
    // Names were already saved in step one, so skipping needs no request and cannot fail.
    seedPromptCooldown();
    router.replace(Routes.app.home);
  }, [isPreparingAvatar, seedPromptCooldown, router]);

  const fullName = `${methods.watch('firstName') ?? ''} ${methods.watch('lastName') ?? ''}`.trim();

  return (
    <FormProvider {...methods}>
      <View className="gap-4">
        {step === 'names' ? (
          <>
            <View className="mb-6">
              <Text
                className="mb-2 text-center font-inter-bold text-headline-md text-foreground"
                accessibilityRole="header"
              >
                What should we call you?
              </Text>
              <Text className="text-center text-body-md text-muted-foreground">
                Your name is shown to organizers and to other people at events you join.
              </Text>
            </View>

            <Input
              name="firstName"
              label="First name"
              placeholder="Maria"
              autoCapitalize="words"
              maxLength={PROFILE_FIELD_LIMITS.nameMaxLength}
              helperText={`Enter 1–${PROFILE_FIELD_LIMITS.nameMaxLength} characters.`}
            />
            <Input
              name="lastName"
              label="Last name"
              placeholder="Santos"
              autoCapitalize="words"
              maxLength={PROFILE_FIELD_LIMITS.nameMaxLength}
              helperText={`Enter 1–${PROFILE_FIELD_LIMITS.nameMaxLength} characters.`}
            />

            {submitError && <Text className="text-destructive text-body-md mb-2">{submitError.message}</Text>}

            <Button onPress={submitNames} loading={updateProfileMutation.isPending} size="auth">
              Continue
            </Button>
          </>
        ) : (
          <>
            <View className="mb-6">
              <Text
                className="mb-2 text-center font-inter-bold text-headline-md text-foreground"
                accessibilityRole="header"
              >
                Add a photo and interests
              </Text>
              <Text className="text-center text-body-md text-muted-foreground">
                Optional. You can do this later from your profile.
              </Text>
            </View>

            <View className="items-center mb-8">
              <Pressable onPress={pickAvatar} className="relative" disabled={isPreparingAvatar}>
                <Avatar src={localAvatar?.uri ?? null} name={fullName} size="lg" />
                <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary">
                  <Camera size={14} className="text-primary-foreground" />
                </View>
              </Pressable>
              <Text className="text-muted-foreground text-body-md mt-3">Tap to add a photo</Text>
            </View>

            <View className="mb-4">
              <Text className="text-label-md text-foreground mb-3">Your interests</Text>
              <View className="flex-row flex-wrap gap-2">
                {INTEREST_OPTIONS.map(
                  (item): ReactElement => (
                    <Chip
                      key={item.id}
                      label={item.label}
                      selected={selectedInterests.includes(item.id)}
                      onPress={(): void => toggleInterest(item.id)}
                    />
                  ),
                )}
              </View>
            </View>

            {submitError && <Text className="text-destructive text-body-md mb-2">{submitError.message}</Text>}

            <Button onPress={submitExtras} loading={isPreparingAvatar || updateProfileMutation.isPending} size="auth">
              Finish
            </Button>

            <View className="items-center mt-2">
              <Button variant="ghost" onPress={skipExtras} disabled={isPreparingAvatar}>
                Skip for now
              </Button>
            </View>
          </>
        )}
      </View>
    </FormProvider>
  );
}
