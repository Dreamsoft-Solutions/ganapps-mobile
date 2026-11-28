import { type ReactElement, type ReactNode, useState } from 'react';
import { Controller, type ControllerRenderProps, useFormContext } from 'react-hook-form';
import { type ReturnKeyTypeOptions, TextInput, type TextInputProps, View } from 'react-native';
import { Colors, Shadows } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { FieldHint } from './FieldHint';
import { Text } from './Text';

interface InputHint {
  message: string;
  title: string;
}

interface InputProps {
  name: string;
  label?: string;
  labelHint?: InputHint;
  helperText?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  iconRight?: ReactNode;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  /** Autofill hint, so password managers and one-time-code suggestions can fill the field. */
  autoComplete?: TextInputProps['autoComplete'];
  /** iOS autofill hint; pair it with `autoComplete`. */
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: ReturnKeyTypeOptions;
  /** Called by the keyboard's return key, for example to focus the next field with `setFocus`. */
  onSubmitEditing?: () => void;
  /** `code` draws a one-time code: large, centred, widely spaced digits. */
  variant?: 'default' | 'code';
}

/**
 * Form input primitive integrated with react-hook-form.
 *
 * A single-line field is at least 48dp tall (`min-h-touch`), so a field with a trailing icon
 * such as the password toggle matches one without, and it grows with the system text size
 * instead of clipping. The text input fills that height, so a tap anywhere in the field focuses
 * it. The field registers its ref with react-hook-form, so `setFocus(name)` moves the cursor to
 * it (chain fields with `returnKeyType="next"` and `onSubmitEditing`). The field is recessed (`Shadows.well`); focus or an error adds
 * a 1dp inset ring in `ring` or `destructive` on top of the matching border.
 *
 * @param props - Input configuration, editability, autofill and return-key behavior, and optional helper text,
 *   right icon, and label hint slots.
 * @returns A labeled input field with inline validation errors.
 * @example
 * <Input name="email" label="Email" autoComplete="email" returnKeyType="next" onSubmitEditing={(): void => setFocus('password')} />
 */
export function Input({
  name,
  label,
  labelHint,
  helperText,
  placeholder,
  secureTextEntry,
  keyboardType,
  iconRight,
  autoCapitalize,
  autoCorrect,
  editable,
  multiline,
  numberOfLines,
  maxLength,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  variant = 'default',
}: InputProps): ReactElement {
  const { control, formState } = useFormContext();
  const theme = useResolvedTheme();
  const error = formState.errors[name]?.message as string | undefined;
  const [focused, setFocused] = useState<boolean>(false);
  const placeholderTextColor: string = Colors[theme]['muted-foreground'];
  const ringColor: string = error ? Colors[theme].destructive : Colors[theme].ring;
  const fieldShadow: string =
    focused || error ? `${Shadows[theme].well}, inset 0 0 0 1px ${ringColor}` : Shadows[theme].well;
  const borderClass: string = error ? 'border-destructive' : focused ? 'border-ring' : 'border-input';
  const isCode: boolean = variant === 'code';
  const heightClass: string = multiline ? 'py-3' : isCode ? 'min-h-16' : 'min-h-touch';
  const textClass: string = multiline
    ? 'min-h-24 text-body-md'
    : isCode
      ? 'self-stretch text-center font-allo-semibold text-headline-md tracking-[8px]'
      : 'self-stretch text-input-md';

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, ref } }: { field: ControllerRenderProps }): ReactElement => (
        <View className="mb-4">
          {label && (
            <View className="relative mb-2 flex-row items-center">
              <Text className="text-label-md text-foreground">{label}</Text>
              {labelHint && (
                <View className="absolute right-0 top-0">
                  <FieldHint
                    accessibilityLabel={`${label} requirements`}
                    message={labelHint.message}
                    title={labelHint.title}
                  />
                </View>
              )}
            </View>
          )}
          <View
            className={`flex-row items-center rounded-lg border bg-card px-md ${heightClass} ${borderClass}`}
            style={{ boxShadow: fieldShadow }}
          >
            <TextInput
              ref={ref}
              value={value}
              onChangeText={onChange}
              onFocus={(): void => setFocused(true)}
              onBlur={(): void => setFocused(false)}
              placeholder={placeholder}
              secureTextEntry={secureTextEntry}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              autoCorrect={autoCorrect}
              editable={editable}
              accessibilityLabel={label}
              accessibilityHint={helperText}
              multiline={multiline}
              numberOfLines={numberOfLines}
              maxLength={maxLength}
              autoComplete={autoComplete}
              textContentType={textContentType}
              returnKeyType={returnKeyType}
              onSubmitEditing={onSubmitEditing}
              submitBehavior={returnKeyType === 'next' ? 'submit' : undefined}
              textAlignVertical={multiline ? 'top' : 'center'}
              className={`flex-1 text-foreground ${textClass}`}
              placeholderTextColor={placeholderTextColor}
            />
            {iconRight && <View className="ml-2">{iconRight}</View>}
          </View>
          {error && <Text className="text-destructive text-body-md mt-1">{error}</Text>}
          {!error && helperText && <Text className="mt-1 text-label-sm text-muted-foreground">{helperText}</Text>}
        </View>
      )}
    />
  );
}
