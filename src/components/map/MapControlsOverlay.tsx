import type { ReactElement, ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { FEED_SHEET_PEEK_HEIGHT } from '@/utils/feed-sheet';

interface MapControlsOverlayProps {
  readonly side: 'left' | 'right';
  readonly hasSelection: boolean;
  readonly mapHeight: SharedValue<number>;
  readonly sheetPosition: SharedValue<number>;
  readonly topOverlayHeight: number;
  readonly children: ReactNode;
}

/**
 * Keeps map controls above the actual sheet and hides them when the sheet fills the map.
 * @param props - Map and sheet geometry with the floating control.
 * @returns The positioned control.
 */
export function MapControlsOverlay({
  side,
  hasSelection,
  mapHeight,
  sheetPosition,
  topOverlayHeight,
  children,
}: MapControlsOverlayProps): ReactElement {
  const controlHeight = useSharedValue<number>(48);
  const animatedStyle = useAnimatedStyle((): { bottom: number; display: 'flex' | 'none' } => {
    const position: number = sheetPosition.value < 0 ? mapHeight.value - FEED_SHEET_PEEK_HEIGHT : sheetPosition.value;
    const bottom: number = hasSelection ? Math.max(0, mapHeight.value - position) + 12 : 40;
    const hasRoom: boolean =
      !hasSelection || mapHeight.value === 0 || position >= topOverlayHeight + controlHeight.value + 12;
    return { bottom, display: hasRoom ? 'flex' : 'none' };
  });
  return (
    <Animated.View
      testID={`map-controls-overlay-${side}`}
      style={[{ position: 'absolute', [side]: 16 }, animatedStyle]}
      pointerEvents="box-none"
      onLayout={(event: LayoutChangeEvent): void => {
        const height: number = event.nativeEvent.layout.height;
        if (Number.isFinite(height) && height > 0) controlHeight.value = height;
      }}
    >
      {children}
    </Animated.View>
  );
}
