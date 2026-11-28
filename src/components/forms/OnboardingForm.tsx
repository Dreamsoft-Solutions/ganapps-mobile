import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { INTEREST_OPTIONS } from '@/constants/interests';
import { Routes } from '@/constants/routes';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
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
 * Each step is drawn on the shared `AuthScreen` frame, with "1 of 2" or "2 of 2" in the header and
 * its actions pinned at the bottom, above the keyboard.
 *
 * @returns The onboarding screen for whichever step is active.
 * @example
 * <OnboardingForm />
 */
export function OnboardingForm(): ReactElement {
  const router = useRouter();
  const { user, updateProfile, updateProfileMutation } = useAuth();
  const [step, setStep] = useState<Step>('names');
  const [localAvatar, setLocalAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState<boolean>(false);
  const theme = useResolvedTheme();

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
  const isNames: boolean = step === 'names';
  const stepMarker: ReactElement = (
    <Text className="text-label-md text-muted-foreground" accessibilityLabel={`Step ${isNames ? 1 : 2} of 2`}>
      {isNames ? '1 of 2' : '2 of 2'}
    </Text>
  );

  return (
    <FormProvider {...methods}>
      {isNames ? (
        <AuthScreen
          title="What should we call you?"
          subtitle="Your name is shown to organizers and to other people at events you join."
          headerRight={stepMarker}
          footer={
            <Button onPress={submitNames} loading={updateProfileMutation.isPending} size="auth">
              Continue
            </Button>
          }
        >
          <Input
            name="firstName"
            label="First name"
            placeholder="Maria"
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
            onSubmitEditing={(): void => methods.setFocus('lastName')}
            maxLength={PROFILE_FIELD_LIMITS.nameMaxLength}
            helperText={`Enter 1–${PROFILE_FIELD_LIMITS.nameMaxLength} characters.`}
          />
          <Input
            name="lastName"
            label="Last name"
            placeholder="Santos"
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            returnKeyType="go"
            onSubmitEditing={submitNames}
            maxLength={PROFILE_FIELD_LIMITS.nameMaxLength}
            helperText={`Enter 1–${PROFILE_FIELD_LIMITS.nameMaxLength} characters.`}
          />

          {submitError && (
            <Text className="text-body-md text-destructive" accessibilityRole="alert">
              {submitError.message}
            </Text>
          )}
        </AuthScreen>
      ) : (
        <AuthScreen
          title="Add a photo and interests"
          subtitle="Optional. You can do this later from your profile."
          headerRight={stepMarker}
          footer={
            <>
              {submitError && (
                <Text className="text-center text-body-md text-destructive" accessibilityRole="alert">
                  {submitError.message}
                </Text>
              )}
              <Button onPress={submitExtras} loading={isPreparingAvatar || updateProfileMutation.isPending} size="auth">
                Finish
              </Button>
              <View className="flex-row justify-center">
                <Button variant="link" onPress={skipExtras} disabled={isPreparingAvatar}>
                  Skip for now
                </Button>
              </View>
            </>
          }
        >
          <View className="mb-xl items-center">
            <Pressable
              onPress={pickAvatar}
              disabled={isPreparingAvatar}
              accessibilityRole="button"
              accessibilityLabel={localAvatar ? 'Change your photo' : 'Add a photo'}
              className="relative active:opacity-80"
            >
              <Avatar src={localAvatar?.uri ?? null} name={fullName} size="lg" />
              <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary">
                <Camera size={16} color={Colors[theme]['primary-foreground']} />
              </View>
            </Pressable>
            <Text className="mt-sm text-body-md text-muted-foreground">
              {localAvatar ? 'Tap to change your photo' : 'Tap to add a photo'}
            </Text>
          </View>

          <Text className="mb-sm font-allo-semibold text-headline-sm text-foreground" accessibilityRole="header">
            Your interests
          </Text>
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
        </AuthScreen>
      )}
    </FormProvider>
  );
}
