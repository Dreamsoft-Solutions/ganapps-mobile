import type { ReactElement } from 'react';
import { View, type ViewProps } from 'react-native';
import { Colors, Shadows } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/**
 * Raised surface for grouped content, with a lit top edge and a soft drop shadow.
 *
 * @param props - View properties; `className` and `style` are applied on top of the card surface.
 * @returns A themed card surface.
 */
export function Card({ className, style, ...props }: ViewProps): ReactElement {
  const theme = useResolvedTheme();
  return (
    <View
      className={`rounded-xl border border-border bg-card p-md ${className ?? ''}`}
      style={[{ boxShadow: `inset 0 1px 0 ${Colors[theme]['bezel-sheen']}, ${Shadows[theme].sm}` }, style]}
      {...props}
    />
  );
}
