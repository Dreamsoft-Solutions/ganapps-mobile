import type { ReactElement } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

/**
 * Text primitive that uses the design system foreground color and sans font.
 *
 * @param props - React Native Text props plus an optional className override.
 * @returns A themed text element.
 */
export function Text({ className, ...props }: TextProps): ReactElement {
  return <RNText className={`font-sans text-foreground ${className ?? ''}`} {...props} />;
}
