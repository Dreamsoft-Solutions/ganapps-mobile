import type { LucideIcon } from 'lucide-react-native';
import { Circle, CircleCheck, Square, SquareCheck } from 'lucide-react-native';
import type { ReactElement } from 'react';
import type { ControllerFieldState, ControllerRenderProps, FieldPath } from 'react-hook-form';
import { Controller, useFormContext } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { FormBlock, FormOption, RegistrationFormAnswerValue, RegistrationFormData } from '@/types/ganap.types';
import type { ScaleConfiguration } from '@/utils/registration-form';
import { getScaleConfiguration, getScaleOptions, getTextConfiguration } from '@/utils/registration-form';
import { Text } from '../common/Text';

/** Props for one dynamic form question. */
export interface DynamicFormQuestionProps {
  block: FormBlock;
}

interface QuestionLabelProps {
  block: FormBlock;
}

interface RegistrationControllerRenderProps {
  field: ControllerRenderProps<RegistrationFormData, FieldPath<RegistrationFormData>>;
  fieldState: ControllerFieldState;
}

function isConfigRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMultilineText(block: FormBlock): boolean {
  return isConfigRecord(block.config) && block.config.multiline === true;
}

function getErrorMessage(error: { message?: unknown } | undefined): string | null {
  return typeof error?.message === 'string' ? error.message : null;
}

function QuestionLabel({ block }: QuestionLabelProps): ReactElement {
  return (
    <View className="mb-sm flex-row flex-wrap items-baseline gap-xs">
      <Text className="text-lg leading-7" style={{ fontFamily: 'Inter-Bold' }}>
        {block.label}
      </Text>
      {block.isRequired && <Text className="text-label-md text-muted-foreground">Required</Text>}
    </View>
  );
}

function fieldValue(
  field: ControllerRenderProps<RegistrationFormData, FieldPath<RegistrationFormData>>,
): RegistrationFormAnswerValue | undefined {
  return field.value as RegistrationFormAnswerValue | undefined;
}

function optionPressHandler(
  field: ControllerRenderProps<RegistrationFormData, FieldPath<RegistrationFormData>>,
  block: FormBlock,
  option: FormOption,
): () => void {
  return (): void => {
    const value: RegistrationFormAnswerValue | undefined = fieldValue(field);

    if (!block.allowMultiple) {
      field.onChange(option.id);
      return;
    }

    const selected: string[] = Array.isArray(value) ? value : [];
    const next: string[] = selected.includes(option.id)
      ? selected.filter((selectedId: string): boolean => selectedId !== option.id)
      : [...selected, option.id];
    field.onChange(next);
  };
}

/**
 * Picks the control glyph for a choice option.
 *
 * Multi-answer blocks read as checkboxes and single-answer blocks as radios, so
 * the glyph depends on the block's arity as well as the option's state.
 *
 * @param allowMultiple - Whether the block accepts more than one answer.
 * @param checked - Whether this option is currently selected.
 * @returns The icon component for that combination.
 */
function choiceIcon(allowMultiple: boolean, checked: boolean): LucideIcon {
  if (allowMultiple) {
    return checked ? SquareCheck : Square;
  }

  return checked ? CircleCheck : Circle;
}

function renderChoiceOptions(
  field: ControllerRenderProps<RegistrationFormData, FieldPath<RegistrationFormData>>,
  block: FormBlock,
): ReactElement {
  const value: RegistrationFormAnswerValue | undefined = fieldValue(field);
  const options: FormOption[] = [...block.options].sort(
    (left: FormOption, right: FormOption): number => left.order - right.order,
  );
  const selectedIds: string[] = Array.isArray(value) ? value : [];

  return (
    <View className="gap-xs">
      {options.map((option: FormOption): ReactElement => {
        const checked: boolean = block.allowMultiple ? selectedIds.includes(option.id) : value === option.id;
        const Icon: LucideIcon = choiceIcon(Boolean(block.allowMultiple), checked);

        return (
          <Pressable
            key={option.id}
            accessibilityRole={block.allowMultiple ? 'checkbox' : 'radio'}
            accessibilityLabel={option.label}
            accessibilityState={{ checked }}
            className={`min-h-touch min-w-touch flex-row items-center gap-xs rounded-lg border px-md py-sm active:opacity-70 ${
              checked ? 'border-primary bg-primary/10' : 'border-input bg-background'
            }`}
            onPress={optionPressHandler(field, block, option)}
          >
            <View accessible={false}>
              <Icon size={24} className={checked ? 'text-primary' : 'text-muted-foreground'} />
            </View>
            <Text className="flex-1 text-body-lg">{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function renderScaleOptions(
  field: ControllerRenderProps<RegistrationFormData, FieldPath<RegistrationFormData>>,
  block: FormBlock,
): ReactElement {
  const value: RegistrationFormAnswerValue | undefined = fieldValue(field);
  const options: number[] = getScaleOptions(block);
  const configuration: ScaleConfiguration = getScaleConfiguration(block);
  const minLabel: string | null = configuration.minLabel ?? null;
  const maxLabel: string | null = configuration.maxLabel ?? null;

  return (
    <View className="gap-sm">
      {(minLabel || maxLabel) && (
        <View className="flex-row justify-between gap-sm">
          {minLabel && <Text className="flex-1 text-body-md text-muted-foreground">{minLabel}</Text>}
          {maxLabel && <Text className="flex-1 text-right text-body-md text-muted-foreground">{maxLabel}</Text>}
        </View>
      )}
      <View className="flex-row flex-wrap justify-center gap-xs">
        {options.map((option: number): ReactElement => {
          const checked: boolean = value === option;

          return (
            <Pressable
              key={String(option)}
              accessibilityRole="radio"
              accessibilityLabel={String(option)}
              accessibilityState={{ checked }}
              className={`min-h-touch min-w-touch items-center justify-center rounded-lg border px-sm py-sm active:opacity-70 ${
                checked ? 'border-primary bg-primary/10' : 'border-input bg-background'
              }`}
              onPress={(): void => field.onChange(option)}
            >
              <Text className={checked ? 'text-primary' : 'text-foreground'}>{String(option)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function renderQuestionControl(
  field: ControllerRenderProps<RegistrationFormData, FieldPath<RegistrationFormData>>,
  block: FormBlock,
  theme: 'light' | 'dark',
): ReactElement {
  if (block.type === 'TEXT') {
    const value: RegistrationFormAnswerValue | undefined = fieldValue(field);
    const textConfiguration = getTextConfiguration(block);

    return (
      <TextInput
        accessibilityLabel={block.isRequired ? `${block.label}, required` : block.label}
        accessibilityHint="Enter your answer"
        autoCapitalize="sentences"
        autoCorrect
        className={`min-h-touch rounded-lg border border-input bg-background px-md py-sm text-body-lg text-foreground ${
          isMultilineText(block) ? 'min-h-24' : ''
        }`}
        maxLength={textConfiguration.maxLength}
        multiline={isMultilineText(block)}
        onBlur={field.onBlur}
        onChangeText={(text: string): void => field.onChange(text)}
        placeholder={textConfiguration.placeholder}
        placeholderTextColor={Colors[theme]['muted-foreground']}
        textAlignVertical={isMultilineText(block) ? 'top' : 'center'}
        value={typeof value === 'string' ? value : ''}
      />
    );
  }

  if (block.type === 'MULTIPLE_CHOICE') {
    return renderChoiceOptions(field, block);
  }

  return renderScaleOptions(field, block);
}

/**
 * Renders one server-defined form question with native accessibility semantics.
 *
 * @param props - Form block to render
 * @returns A controlled question field with inline validation
 */
export function DynamicFormQuestion({ block }: DynamicFormQuestionProps): ReactElement {
  const { control } = useFormContext<RegistrationFormData>();
  const theme: 'light' | 'dark' = useResolvedTheme();
  const name: FieldPath<RegistrationFormData> = `answers.${block.id}` as FieldPath<RegistrationFormData>;

  return (
    <View testID={`registration-question-${block.id}`} className="gap-xs">
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }: RegistrationControllerRenderProps): ReactElement => {
          const errorMessage: string | null = getErrorMessage(fieldState.error);

          return (
            <>
              <QuestionLabel block={block} />
              {renderQuestionControl(field, block, theme)}
              {errorMessage && (
                <Text accessibilityRole="alert" className="text-body-md text-destructive">
                  {errorMessage}
                </Text>
              )}
            </>
          );
        }}
      />
    </View>
  );
}
