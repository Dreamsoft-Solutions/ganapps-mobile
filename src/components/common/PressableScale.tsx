import type { ReactElement, ReactNode } from 'react';
import { Pressable, type PressableProps, type PressableStateCallbackType } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

/** Press state handed to function children. */
export interface PressableScaleState {
  pressed: boolean;
}

/** Props for {@link PressableScale}. */
export interface PressableScaleProps extends Omit<PressableProps, 'children' | 'style'> {
  /** Content, or a function of the press state so a child can render its own pressed look. */
  children: ReactNode | ((state: PressableScaleState) => ReactNode);
  /** Scale while pressed. Icons pass 0.94; 1 turns the scale off. Defaults to 0.97. */
  scaleTo?: number;
  /** Classes for the `Pressable`: only what places the control in its parent. */
  className?: string;
}

const EASE_OUT: ReturnType<typeof cubicBezier> = cubicBezier(0.23, 1, 0.32, 1);

/**
 * Press feedback shared by every Glass and Capsule control: the `Pressable` owns placement and
 * hit testing, an animated view inside it scales down while pressed. The scale is a Reanimated CSS
 * transition, so it runs on the UI thread and reverses mid-flight. It is skipped when the system asks
 * for reduced motion.
 *
 * @param props - Pressable props, the pressed scale and the content.
 * @returns The pressable with its scaling content.
 */
export function PressableScale({ children, scaleTo = 0.97, className, ...rest }: PressableScaleProps): ReactElement {
  const reduced = useReducedMotion();

  return (
    <Pressable {...rest} className={className}>
      {({ pressed }: PressableStateCallbackType): ReactElement => (
        <Animated.View
          style={{
            flexGrow: 1,
            transform: [{ scale: pressed && !reduced ? scaleTo : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 160,
            transitionTimingFunction: EASE_OUT,
          }}
        >
          {typeof children === 'function' ? children({ pressed }) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
