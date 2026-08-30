import { Search, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Chip } from '@/components/common/Chip';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { JoinedGanapTimeFilter } from '@/types/profile.types';

const TIME_FILTERS: ReadonlyArray<{ value: JoinedGanapTimeFilter; label: string }> = [
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'PAST', label: 'Past' },
  { value: 'ALL', label: 'All' },
] as const satisfies ReadonlyArray<{ value: JoinedGanapTimeFilter; label: string }>;

export interface JoinedGanapsFilterBarProps {
  search: string;
  time: JoinedGanapTimeFilter;
  onSearchChange: (value: string) => void;
  onTimeChange: (value: JoinedGanapTimeFilter) => void;
}

/**
 * Native search and time controls for the current User's joined Ganap list.
 *
 * @param props - Raw search text, selected time range, and change handlers.
 * @returns Accessible search and filter controls.
 */
export function JoinedGanapsFilterBar({
  search,
  time,
  onSearchChange,
  onTimeChange,
}: JoinedGanapsFilterBarProps): ReactElement {
  const theme = useResolvedTheme();
  const mutedForeground: string = Colors[theme]['muted-foreground'];

  return (
    <View className="gap-sm px-md pb-sm">
      <View className="flex-row items-center rounded-xl border border-input bg-background px-md py-sm">
        <Search size={20} color={mutedForeground} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search joined events"
          placeholderTextColor={mutedForeground}
          accessibilityLabel="Search joined events"
          autoCapitalize="sentences"
          className="ml-sm flex-1 text-body-md text-foreground"
        />
        {search.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear joined-event search"
            onPress={(): void => onSearchChange('')}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <X size={18} color={mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row gap-xs">
        {TIME_FILTERS.map(
          ({ value, label }): ReactElement => (
            <Chip key={value} label={label} selected={time === value} onPress={(): void => onTimeChange(value)} />
          ),
        )}
      </View>
    </View>
  );
}
