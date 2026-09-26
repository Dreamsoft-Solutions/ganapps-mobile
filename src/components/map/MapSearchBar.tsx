import { Search, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Text } from '@/components/common/Text';
import type { GanapListItem } from '@/types/ganap.types';

const MAX_VISIBLE_SUGGESTIONS = 5;

interface MapSearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  suggestions: GanapListItem[];
  isLoadingSuggestions: boolean;
  isErrorSuggestions: boolean;
  onSelectSuggestion: (ganap: GanapListItem) => void;
  placeholder?: string;
}

/**
 * Floating search bar for the map screen.
 *
 * @param props - Search value, filtered suggestions, and their event handlers.
 * @returns The search bar element.
 */
export function MapSearchBar({
  value,
  onChangeText,
  suggestions,
  isLoadingSuggestions,
  isErrorSuggestions,
  onSelectSuggestion,
  placeholder = 'Search events...',
}: MapSearchBarProps): ReactElement {
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState<boolean>(false);

  const handleChangeText = (nextValue: string): void => {
    onChangeText(nextValue);
    setIsSuggestionsVisible(nextValue.trim().length > 0);
  };

  const handleFocus = (): void => {
    setIsSuggestionsVisible(value.trim().length > 0);
  };

  const handleSelectSuggestion = (ganap: GanapListItem): void => {
    setIsSuggestionsVisible(false);
    Keyboard.dismiss();
    onSelectSuggestion(ganap);
  };

  return (
    <View className="relative z-20">
      <View className="flex-row items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-md">
        <Search size={20} className="text-muted-foreground" />
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="flex-1 text-body-md text-foreground placeholder:text-muted-foreground"
          accessibilityLabel="Search events"
          accessibilityHint="Shows matching Ganaps on the map"
        />
        {value.length > 0 && (
          <Pressable
            onPress={(): void => handleChangeText('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={15}
          >
            <X size={18} className="text-muted-foreground" />
          </Pressable>
        )}
      </View>
      {isSuggestionsVisible && value.trim().length > 0 && (
        <View
          className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-hidden rounded-xl border border-border bg-card shadow-md"
          testID="map-search-suggestions"
        >
          <ScrollView className="max-h-72" keyboardShouldPersistTaps="always">
            {isLoadingSuggestions ? (
              <View className="min-h-touch flex-row items-center gap-3 px-4 py-sm">
                <ActivityIndicator accessibilityLabel="Searching events" />
                <Text className="text-body-md text-muted-foreground" accessibilityLiveRegion="polite">
                  Searching events...
                </Text>
              </View>
            ) : isErrorSuggestions ? (
              <Text className="px-4 py-md text-body-md text-muted-foreground" accessibilityLiveRegion="polite">
                Couldn't load event suggestions.
              </Text>
            ) : suggestions.length === 0 ? (
              <Text className="px-4 py-md text-body-md text-muted-foreground" accessibilityLiveRegion="polite">
                No events found
              </Text>
            ) : (
              suggestions.slice(0, MAX_VISIBLE_SUGGESTIONS).map(
                (suggestion: GanapListItem): ReactElement => (
                  <Pressable
                    key={suggestion.id}
                    testID={`map-search-suggestion-${suggestion.id}`}
                    onPress={(): void => handleSelectSuggestion(suggestion)}
                    className="min-h-touch flex-row items-center border-b border-border px-4 py-sm"
                    accessibilityRole="button"
                    accessibilityLabel={suggestion.title}
                    accessibilityHint="Centers the map on this Ganap"
                  >
                    <View className="flex-1">
                      <Text className="text-body-md font-inter-semibold" numberOfLines={1}>
                        {suggestion.title}
                      </Text>
                      {suggestion.address ? (
                        <Text className="text-body-md text-muted-foreground" numberOfLines={1}>
                          {suggestion.address}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ),
              )
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
