import { Text as RNText, type TextProps } from 'react-native';

export function Text({ className, ...props }: TextProps) {
  return (
    <RNText
      className={`font-sans text-lynx-on-background ${className ?? ''}`}
      {...props}
    />
  );
}
