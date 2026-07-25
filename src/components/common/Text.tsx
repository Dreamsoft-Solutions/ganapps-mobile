import type { ReactElement } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

export function Text({ className, ...props }: TextProps): ReactElement {
  return <RNText className={`font-sans text-lynx-on-background ${className ?? ''}`} {...props} />;
}
