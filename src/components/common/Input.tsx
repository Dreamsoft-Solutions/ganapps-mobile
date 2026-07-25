import type { ReactElement } from 'react';
import { Controller, type ControllerRenderProps, useFormContext } from 'react-hook-form';
import { TextInput, View } from 'react-native';
import { Text } from './Text';

interface InputProps {
  name: string;
  label?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
}

export function Input({ name, label, placeholder, secureTextEntry, keyboardType }: InputProps): ReactElement {
  const { control, formState } = useFormContext();
  const error = formState.errors[name]?.message as string | undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }: { field: ControllerRenderProps }): ReactElement => (
        <View className="mb-4">
          {label && <Text className="text-sm font-semibold text-lynx-on-surface mb-2">{label}</Text>}
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            className={`border rounded-lg px-4 py-3 text-base bg-lynx-surface-container-low ${
              error ? 'border-lynx-error' : 'border-lynx-outline-variant'
            }`}
            placeholderTextColor="#9ca3af"
          />
          {error && <Text className="text-lynx-error text-sm mt-1">{error}</Text>}
        </View>
      )}
    />
  );
}
