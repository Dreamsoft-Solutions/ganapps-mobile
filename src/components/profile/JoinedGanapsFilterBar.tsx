import { Search, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { TextInput, View } from 'react-native';
import { Chip } from '@/components/common/Chip';
import { IconButton } from '@/components/common/IconButton';
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
      <View className="h-touch flex-row items-center rounded-lg border border-input bg-background px-md">
        <Search size={20} color={mutedForeground} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search joined events"
          placeholderTextColor={mutedForeground}
          accessibilityLabel="Search joined events"
          autoCapitalize="sentences"
          className="ml-sm flex-1 self-stretch text-input-md text-foreground"
        />
        {search.length > 0 ? (
          <IconButton size="sm" accessibilityLabel="Clear joined-event search" onPress={(): void => onSearchChange('')}>
            <X size={18} color={mutedForeground} />
          </IconButton>
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
