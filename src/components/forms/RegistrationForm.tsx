import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { Spacing } from '@/constants/theme';
import type { FormBlock, RegistrationFormData, SubmitFormAnswersInput } from '@/types/ganap.types';
import { buildRegistrationFormDefaults, buildSubmitFormAnswersInput } from '@/utils/registration-form';
import { createRegistrationFormSchema } from '@/utils/validation';
import { RegistrationQuestion } from './RegistrationQuestion';

/** Props for the dynamic registration form composition. */
export interface RegistrationFormProps {
  ganapTitle: string;
  blocks: FormBlock[];
  isSubmitting: boolean;
  submissionError: Error | null;
  onBack: () => void;
  onDirtyChange: (isDirty: boolean) => void;
  onSubmit: (input: SubmitFormAnswersInput) => Promise<void>;
}

/**
 * Renders the attendee-facing dynamic registration form.
 *
 * @param props - Ganap context, server blocks, submission state, and route callbacks
 * @returns A keyboard-safe, accessible registration form
 */
export function RegistrationForm({
  ganapTitle,
  blocks,
  isSubmitting,
  submissionError,
  onBack,
  onDirtyChange,
  onSubmit,
}: RegistrationFormProps): ReactElement {
  const insets = useSafeAreaInsets();
  const orderedBlocks: FormBlock[] = useMemo(
    (): FormBlock[] => [...blocks].sort((left: FormBlock, right: FormBlock): number => left.order - right.order),
    [blocks],
  );
  const schema = useMemo(
    (): ReturnType<typeof createRegistrationFormSchema> => createRegistrationFormSchema(orderedBlocks),
    [orderedBlocks],
  );
  const methods = useForm<RegistrationFormData>({
    resolver: zodResolver(schema),
    defaultValues: buildRegistrationFormDefaults(orderedBlocks),
    mode: 'onBlur',
  });
  const isDirty: boolean = methods.formState.isDirty;

  useEffect((): void => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSubmit = useCallback(
    async (data: RegistrationFormData): Promise<void> => {
      const input: SubmitFormAnswersInput = buildSubmitFormAnswersInput(orderedBlocks, data);
      await onSubmit(input);
    },
    [onSubmit, orderedBlocks],
  );

  return (
    <FormProvider {...methods}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-background"
        keyboardVerticalOffset={insets.top}
      >
        <View className="flex-1" style={{ paddingTop: insets.top + Spacing.sm }}>
          <View className="flex-row items-center gap-sm border-b border-border px-md py-sm">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Returns to event details"
              className="min-h-11 min-w-11 items-center justify-center rounded-full active:opacity-70"
              onPress={onBack}
            >
              <ArrowLeft size={24} className="text-foreground" />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text className="text-headline-md" accessibilityRole="header">
                Complete registration
              </Text>
              <Text className="text-body-md text-muted-foreground" numberOfLines={2}>
                {ganapTitle}
              </Text>
            </View>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: Spacing.xl, paddingHorizontal: Spacing.md, paddingTop: Spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="mb-lg text-body-lg text-muted-foreground">
              Answer a few questions from the organization before you join this event.
            </Text>
            <View className="gap-xl">
              {orderedBlocks.map(
                (block: FormBlock): ReactElement => (
                  <RegistrationQuestion key={block.id} block={block} />
                ),
              )}
            </View>
          </ScrollView>

          <View
            className="border-t border-border bg-background px-md pt-sm"
            style={{ paddingBottom: insets.bottom + Spacing.sm }}
          >
            {submissionError && (
              <Text accessibilityRole="alert" className="mb-sm text-body-md text-destructive">
                {submissionError.message}
              </Text>
            )}
            <Button
              loading={isSubmitting}
              disabled={isSubmitting}
              onPress={methods.handleSubmit(handleSubmit)}
              size="lg"
            >
              Submit registration
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </FormProvider>
  );
}
