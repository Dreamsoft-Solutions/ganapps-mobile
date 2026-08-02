import { Search, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, TextInput, View } from 'react-native';

interface MapSearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

/**
 * Floating search bar for the map screen.
 *
 * @param props - Current value, change handler, and optional placeholder.
 * @returns The search bar element.
 */
export function MapSearchBar({
  value,
  onChangeText,
  placeholder = 'Search events...',
}: MapSearchBarProps): ReactElement {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-md">
      <Search size={20} className="text-muted-foreground" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        className="flex-1 text-body-md text-foreground placeholder:text-muted-foreground"
        accessibilityLabel="Search events"
      />
      {value.length > 0 && (
        <Pressable onPress={(): void => onChangeText('')} accessibilityLabel="Clear search">
          <X size={18} className="text-muted-foreground" />
        </Pressable>
      )}
    </View>
  );
}
