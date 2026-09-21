import type { ReactElement } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SegmentControl, type SegmentControlOption } from '@/components/common/SegmentControl';
import { Text } from '@/components/common/Text';
import { BAR_HEIGHT } from '@/components/navigation/AppTabBar';
import { JoinedGanapsFilterBar } from '@/components/profile/JoinedGanapsFilterBar';
import { JoinedGanapsList } from '@/components/profile/JoinedGanapsList';
import { SavedGanapsList } from '@/components/profile/SavedGanapsList';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { JoinedGanapFilters, JoinedGanapTimeFilter } from '@/types/profile.types';

/** Which collection the My Events tab is showing. */
type MyEventsSegment = 'joined' | 'saved';

const SEGMENTS: ReadonlyArray<SegmentControlOption<MyEventsSegment>> = [
  { value: 'joined', label: 'Joined' },
  { value: 'saved', label: 'Saved' },
];

export default function GanapsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<MyEventsSegment>('joined');
  const [search, setSearch] = useState<string>('');
  const [time, setTime] = useState<JoinedGanapTimeFilter>('UPCOMING');
  const debouncedSearch: string = useDebouncedValue(search, 300);
  const normalizedSearch: string = debouncedSearch.trim();
  const filters: JoinedGanapFilters = normalizedSearch.length > 0 ? { search: normalizedSearch, time } : { time };
  const contentBottomPadding: number = insets.bottom + BAR_HEIGHT + Spacing.xs;

  return (
    <View className="flex-1 bg-background">
      <View testID="my-events-heading-container" className="px-md" style={{ paddingTop: insets.top + Spacing.md }}>
        <Text accessibilityRole="header" className="font-inter-bold text-headline-md">
          My Events
        </Text>
      </View>
      <View className="px-md pt-sm">
        <SegmentControl<MyEventsSegment>
          value={segment}
          options={SEGMENTS}
          onChange={(value: MyEventsSegment): void => setSegment(value)}
          label="My events view"
        />
      </View>
      {segment === 'joined' ? (
        <>
          <JoinedGanapsFilterBar
            search={search}
            time={time}
            onSearchChange={(value: string): void => setSearch(value)}
            onTimeChange={(value: JoinedGanapTimeFilter): void => setTime(value)}
          />
          <JoinedGanapsList
            contentTopPadding={Spacing.md}
            contentBottomPadding={contentBottomPadding}
            filters={filters}
          />
        </>
      ) : (
        <SavedGanapsList contentTopPadding={Spacing.md} contentBottomPadding={contentBottomPadding} />
      )}
    </View>
  );
}
