import { type ReactElement, type ReactNode, useState } from 'react';
import { Controller, type ControllerRenderProps, useFormContext } from 'react-hook-form';
import { TextInput, View } from 'react-native';
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
}

/**
 * Form input primitive integrated with react-hook-form.
 *
 * A single-line field is always 48dp tall (`h-touch`), so a field with a trailing icon
 * such as the password toggle matches one without. The text input fills that height, so a
 * tap anywhere in the field focuses it. The field is recessed (`Shadows.well`); focus or an error adds
 * a 1dp inset ring in `ring` or `destructive` on top of the matching border.
 *
 * @param props - Input configuration, editability, and optional helper text, right icon, and label hint slots.
 * @returns A labeled input field with inline validation errors.
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

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }: { field: ControllerRenderProps }): ReactElement => (
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
            className={`flex-row items-center rounded-lg border bg-card px-md ${multiline ? 'py-3' : 'h-touch'} ${borderClass}`}
            style={{ boxShadow: fieldShadow }}
          >
            <TextInput
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
              textAlignVertical={multiline ? 'top' : 'center'}
              className={`flex-1 text-foreground ${multiline ? 'min-h-24 text-body-md' : 'self-stretch text-input-md'}`}
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
