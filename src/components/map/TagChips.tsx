import type { ReactElement } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/common/Text';

interface TagChipsProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

/**
 * Horizontal scrollable list of category/tag filter chips.
 *
 * @param props - Available tags, current selection, and select handler.
 * @returns The scrollable chip list.
 */
export function TagChips({ tags, selectedTag, onSelectTag }: TagChipsProps): ReactElement {
  const allTags: string[] = ['All', ...tags];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      className="py-2"
    >
      {allTags.map((tag): ReactElement => {
        const isActive = tag === 'All' ? selectedTag === null : selectedTag === tag;
        return (
          <Pressable
            key={tag}
            onPress={(): void => onSelectTag(tag === 'All' ? null : tag)}
            className={`rounded-full px-4 py-2 ${
              isActive ? 'bg-lynx-primary' : 'bg-white border border-lynx-outline-variant'
            }`}
            accessibilityLabel={`Filter by ${tag}`}
            accessibilityState={{ selected: isActive }}
          >
            <Text className={`text-label-md ${isActive ? 'text-white' : 'text-lynx-on-surface'}`}>{tag}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
