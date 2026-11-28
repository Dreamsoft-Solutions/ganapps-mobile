import { Search, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Glass } from '@/components/common/Glass';
import { Text } from '@/components/common/Text';
import { BorderRadius } from '@/constants/theme';
import type { GanapListItem } from '@/types/ganap.types';

const MAX_VISIBLE_SUGGESTIONS = 5;
const SEARCH_BAR_HEIGHT: number = 56;

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
 * Floating search bar for the map screen, on strong glass so the placeholder stays readable over any
 * street: a 56dp pill, with its suggestions on a strong-glass panel below it.
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
      <Glass
        variant="strong"
        className="flex-row items-center gap-sm pl-md pr-xs"
        style={{ height: SEARCH_BAR_HEIGHT }}
      >
        <Search size={22} className="text-muted-foreground" />
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="h-full flex-1 text-input-md text-foreground placeholder:text-muted-foreground"
          accessibilityLabel="Search events"
          accessibilityHint="Shows matching events on the map"
        />
        {value.length > 0 && (
          <Pressable
            onPress={(): void => handleChangeText('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            className="h-touch w-touch items-center justify-center"
          >
            <X size={18} className="text-muted-foreground" />
          </Pressable>
        )}
      </Glass>
      {isSuggestionsVisible && value.trim().length > 0 && (
        <Glass
          variant="strong"
          radius={BorderRadius.xl}
          className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-hidden"
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
                    className="min-h-touch flex-row items-center border-b border-border px-md py-sm"
                    accessibilityRole="button"
                    accessibilityLabel={suggestion.title}
                    accessibilityHint="Centers the map on this event"
                  >
                    <View className="flex-1">
                      <Text className="text-body-md font-allo-semibold" numberOfLines={1}>
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
        </Glass>
      )}
    </View>
  );
}
