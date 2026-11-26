import { MapPin } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { Chip } from '@/components/common/Chip';

interface TagChipsProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  isNearbyActive: boolean;
  isNearbyDisabled: boolean;
  onToggleNearby: () => void;
}

/**
 * Nearby filter chip alongside the horizontal list of category tag chips.
 *
 * Nearby is a filter rather than a category, so it sits in its own divided
 * section and stacks on a selected tag instead of replacing it.
 *
 * @param props - Available tags, current selection, and the tag and Nearby handlers
 * @returns The chip row
 */
export function TagChips({
  tags,
  selectedTag,
  onSelectTag,
  isNearbyActive,
  isNearbyDisabled,
  onToggleNearby,
}: TagChipsProps): ReactElement {
  const allTags: string[] = ['All', ...tags];

  return (
    <View className="flex-row items-center py-2">
      <View className="pl-4 pr-3 border-r border-border">
        <Chip
          label="Nearby"
          icon={<MapPin />}
          role="switch"
          selected={isNearbyActive}
          disabled={isNearbyDisabled}
          onPress={onToggleNearby}
          accessibilityLabel="Show events near me"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
      >
        {allTags.map((tag): ReactElement => {
          const isActive = tag === 'All' ? selectedTag === null : selectedTag === tag;
          return (
            <Chip
              key={tag}
              label={tag}
              selected={isActive}
              onPress={(): void => onSelectTag(tag === 'All' ? null : tag)}
              accessibilityLabel={`Filter by ${tag}`}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
