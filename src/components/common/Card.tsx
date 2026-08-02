import type { ReactElement } from 'react';
import { View, type ViewProps } from 'react-native';

/**
 * Raised surface for grouped content.
 *
 * @param props - View properties and optional utility-class overrides.
 * @returns A themed card surface.
 */
export function Card({ className, ...props }: ViewProps): ReactElement {
  return <View className={`rounded-xl border border-border bg-card p-md ${className ?? ''}`} {...props} />;
}
