import type { ReactElement, ReactNode } from 'react';
import { Controller, type ControllerRenderProps, useFormContext } from 'react-hook-form';
import { TextInput, View } from 'react-native';
import { Colors } from '@/constants/theme';
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
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  iconRight?: ReactNode;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
}

/**
 * Form input primitive integrated with react-hook-form.
 *
 * @param props - Input configuration, including optional right icon and label hint slots.
 * @returns A labeled input field with inline validation errors.
 */
export function Input({
  name,
  label,
  labelHint,
  placeholder,
  secureTextEntry,
  keyboardType,
  iconRight,
  autoCapitalize,
  autoCorrect,
  multiline,
  numberOfLines,
  maxLength,
}: InputProps): ReactElement {
  const { control, formState } = useFormContext();
  const theme = useResolvedTheme();
  const error = formState.errors[name]?.message as string | undefined;
  const placeholderTextColor: string = Colors[theme]['muted-foreground'];

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
            className={`flex-row items-center rounded-lg border bg-background px-4 py-3 ${
              error ? 'border-destructive' : 'border-input'
            }`}
          >
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder={placeholder}
              secureTextEntry={secureTextEntry}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              autoCorrect={autoCorrect}
              multiline={multiline}
              numberOfLines={numberOfLines}
              maxLength={maxLength}
              textAlignVertical={multiline ? 'top' : 'center'}
              className={`flex-1 text-body-md text-foreground ${multiline ? 'min-h-24' : ''}`}
              placeholderTextColor={placeholderTextColor}
            />
            {iconRight && <View className="ml-2">{iconRight}</View>}
          </View>
          {error && <Text className="text-destructive text-body-md mt-1">{error}</Text>}
        </View>
      )}
    />
  );
}
