import { Slider } from '@expo/ui/community/slider';
import { type ReactElement, useState } from 'react';
import { type AccessibilityActionEvent, Pressable, Switch, View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

export const MAX_MAP_PITCH: number = 80;

interface MapViewControlsProps {
  readonly pitch: number;
  readonly buildingsVisible: boolean;
  readonly onPitchChange: (pitch: number) => void;
  readonly onOverhead: () => void;
  readonly onBuildingsChange: (visible: boolean) => void;
}

/**
 * Native pitch adjustment, overhead reset, and building visibility controls.
 * @param props - Camera pitch and view-control handlers.
 * @returns The themed controls above the map's selection sheet.
 */
export function MapViewControls({
  pitch,
  buildingsVisible,
  onPitchChange,
  onOverhead,
  onBuildingsChange,
}: MapViewControlsProps): ReactElement {
  const theme = useResolvedTheme();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  return (
    <View className="gap-xs">
      <Pressable
        className="min-h-touch justify-center rounded-lg border border-border bg-card px-sm"
        accessibilityRole="button"
        accessibilityLabel="Map view controls"
        accessibilityState={{ expanded: isExpanded }}
        onPress={(): void => setIsExpanded((expanded: boolean): boolean => !expanded)}
      >
        <Text className="text-label-md text-card-foreground">{isExpanded ? 'Close map view' : 'Map view'}</Text>
      </Pressable>
      {isExpanded && (
        <View className="w-56 gap-xs rounded-xl border border-border bg-card p-sm">
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Map pitch"
            accessibilityValue={{ min: 0, max: MAX_MAP_PITCH, now: pitch, text: `${pitch} degrees` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event: AccessibilityActionEvent): void => {
              const change: number = event.nativeEvent.actionName === 'increment' ? 5 : -5;
              onPitchChange(Math.max(0, Math.min(MAX_MAP_PITCH, pitch + change)));
            }}
          >
            <Text className="text-label-md text-card-foreground">Map pitch: {pitch}°</Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Slider
                value={pitch}
                minimumValue={0}
                maximumValue={MAX_MAP_PITCH}
                minimumTrackTintColor={Colors[theme].primary}
                maximumTrackTintColor={Colors[theme].muted}
                thumbTintColor={Colors[theme].primary}
                onValueChange={onPitchChange}
                style={{ height: 48 }}
              />
            </View>
          </View>
          <Button
            variant="outline"
            size="sm"
            accessibilityHint="Resets pitch and direction while keeping this map area"
            onPress={onOverhead}
          >
            Return to overhead view
          </Button>
          <View className="min-h-touch flex-row items-center justify-between gap-xs">
            <Text className="text-label-md text-card-foreground">3D buildings</Text>
            <Switch
              accessibilityLabel="Show 3D buildings"
              value={buildingsVisible}
              onValueChange={onBuildingsChange}
              trackColor={{ false: Colors[theme].muted, true: Colors[theme].primary }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
