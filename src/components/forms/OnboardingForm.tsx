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
import { Routes } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
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

type Step = 'names' | 'extras';

/**
 * Two-step profile setup shown after email verification.
 *
 * Step one collects first and last name, is required, and has no skip control: it saves to
 * the server before advancing, so a user who quits on step two keeps their names and is not
 * sent back here on the next launch. Step two collects an avatar and interests, is skippable,
 * and never blocks entry to the app.
 *
 * @returns The onboarding form for whichever step is active.
 */
export function OnboardingForm(): ReactElement {
  const router = useRouter();
  const { user, updateProfile, updateProfileMutation } = useAuth();
  const [step, setStep] = useState<Step>('names');
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

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

  const submitNames = useCallback(async (): Promise<void> => {
    // Validate only this step's fields. `handleSubmit` would run the whole schema, coupling
    // step one to fields that are not on screen yet.
    const valid = await methods.trigger(['firstName', 'lastName']);
    if (!valid) return;

    const { firstName, lastName } = methods.getValues();

    try {
      await updateProfile({ firstName, lastName });
      setStep('extras');
    } catch (_error) {
      // Rendered from `updateProfileMutation.error` below. The user stays on this step and
      // can retry; nothing is lost and nothing traps them, because the redirect that brought
      // them here reads server state, which is unchanged by a failed save.
    }
  }, [methods, updateProfile]);

  const submitExtras = useCallback(async (): Promise<void> => {
    const { interests } = methods.getValues();
    const hasInterests = !!interests && interests.length > 0;

    if (!hasInterests && !localAvatarUri) {
      router.replace(Routes.app.home);
      return;
    }

    const formData = new FormData();

    if (hasInterests) {
      formData.append('interests', JSON.stringify(interests));
    }

    if (localAvatarUri) {
      const filename = localAvatarUri.split('/').pop() ?? 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri: localAvatarUri,
        name: filename,
        type,
      } as unknown as Blob);
    }

    try {
      await updateProfile(formData);
      router.replace(Routes.app.home);
    } catch (_error) {
      // Rendered below. Step two is optional, so the user can still skip past a failure.
    }
  }, [methods, localAvatarUri, updateProfile, router]);

  const skipExtras = useCallback((): void => {
    // Names were already saved in step one, so skipping needs no request and cannot fail.
    router.replace(Routes.app.home);
  }, [router]);

  const fullName = `${methods.watch('firstName') ?? ''} ${methods.watch('lastName') ?? ''}`.trim();

  return (
    <FormProvider {...methods}>
      <View className="gap-4">
        {step === 'names' ? (
          <>
            <View className="mb-6">
              <Text className="text-headline-lg text-foreground mb-2">What should we call you?</Text>
              <Text className="text-muted-foreground text-body-md">
                Your name is shown to organizers and to other students at events you join.
              </Text>
            </View>

            <Input name="firstName" label="First Name" placeholder="Maria" autoCapitalize="words" />
            <Input name="lastName" label="Last Name" placeholder="Santos" autoCapitalize="words" />

            {submitError && <Text className="text-destructive text-body-md mb-2">{submitError.message}</Text>}

            <Button onPress={submitNames} loading={updateProfileMutation.isPending} size="lg">
              Continue
            </Button>
          </>
        ) : (
          <>
            <View className="mb-6">
              <Text className="text-headline-lg text-foreground mb-2">Add a photo and interests</Text>
              <Text className="text-muted-foreground text-body-md">
                Optional. You can do this later from your profile.
              </Text>
            </View>

            <View className="items-center mb-8">
              <Pressable onPress={pickAvatar} className="relative">
                <Avatar src={localAvatarUri} name={fullName} size="lg" />
                <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary items-center justify-center border-2 border-background shadow">
                  <Camera size={14} color="#FFFFFF" />
                </View>
              </Pressable>
              <Text className="text-muted-foreground text-body-md mt-3">Tap to add a photo</Text>
            </View>

            <View className="mb-4">
              <Text className="text-label-md text-foreground mb-3">Your Interests</Text>
              <View className="flex-row flex-wrap gap-2">
                {INTERESTS.map(
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

            <Button onPress={submitExtras} loading={updateProfileMutation.isPending} size="lg">
              Finish
            </Button>

            <View className="items-center mt-2">
              <Button variant="ghost" size="sm" onPress={skipExtras}>
                Skip for Now
              </Button>
            </View>
          </>
        )}
      </View>
    </FormProvider>
  );
}
