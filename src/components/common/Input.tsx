import type { ReactElement, ReactNode } from 'react';
import { Controller, type ControllerRenderProps, useFormContext } from 'react-hook-form';
import { TextInput, View } from 'react-native';
import { Text } from './Text';

interface InputProps {
  name: string;
  label?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  iconRight?: ReactNode;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
}

/**
 * Form input primitive integrated with react-hook-form.
 *
 * @param props - Input configuration, including an optional right icon slot.
 * @returns A labeled input field with inline validation errors.
 */
export function Input({
  name,
  label,
  placeholder,
  secureTextEntry,
  keyboardType,
  iconRight,
  autoCapitalize,
  autoCorrect,
}: InputProps): ReactElement {
  const { control, formState } = useFormContext();
  const error = formState.errors[name]?.message as string | undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }: { field: ControllerRenderProps }): ReactElement => (
        <View className="mb-4">
          {label && <Text className="text-label-md text-foreground mb-2">{label}</Text>}
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
              className="flex-1 text-body-md text-foreground"
              placeholderTextColor="#9ca3af"
            />
            {iconRight && <View className="ml-2">{iconRight}</View>}
          </View>
          {error && <Text className="text-destructive text-body-md mt-1">{error}</Text>}
        </View>
      )}
    />
  );
}
