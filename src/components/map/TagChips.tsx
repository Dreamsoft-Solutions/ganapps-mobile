import { MapPin } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { chipTextVariants, chipVariants } from '@/components/common/Chip';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

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
  const theme = useResolvedTheme();
  const iconColor: string = isNearbyActive ? Colors[theme]['primary-foreground'] : Colors[theme]['muted-foreground'];

  return (
    <View className="flex-row items-center py-2">
      <View className="pl-4 pr-3 border-r border-border">
        <Pressable
          onPress={onToggleNearby}
          disabled={isNearbyDisabled}
          className={`flex-row items-center gap-1 ${chipVariants({ selected: isNearbyActive })} ${
            isNearbyDisabled ? 'opacity-50' : ''
          }`}
          accessibilityRole="switch"
          accessibilityLabel="Show events near me"
          accessibilityState={{ checked: isNearbyActive, disabled: isNearbyDisabled }}
        >
          <MapPin size={14} color={iconColor} />
          <Text className={chipTextVariants({ selected: isNearbyActive })}>Nearby</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
      >
        {allTags.map((tag): ReactElement => {
          const isActive = tag === 'All' ? selectedTag === null : selectedTag === tag;
          return (
            <Pressable
              key={tag}
              onPress={(): void => onSelectTag(tag === 'All' ? null : tag)}
              className={chipVariants({ selected: isActive })}
              accessibilityLabel={`Filter by ${tag}`}
              accessibilityState={{ selected: isActive }}
            >
              <Text className={chipTextVariants({ selected: isActive })}>{tag}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
