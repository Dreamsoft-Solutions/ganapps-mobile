import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import type { GanapListItem } from '@/types/ganap.types';
import { MapSearchBar } from './MapSearchBar';

jest.mock('lucide-react-native', () => ({
  Search: (): null => null,
  X: (): null => null,
}));

function ganap(id: string): GanapListItem {
  return {
    id,
    businessId: 'business-1',
    businessName: 'Ganapps',
    slug: id,
    title: `Ganap ${id}`,
    description: '',
    address: 'Iloilo City',
    locationLat: 10.72,
    locationLong: 122.56,
    startDate: '2026-09-26T10:00:00.000Z',
    endDate: null,
    attendanceOpenMinutesBefore: 30,
    tags: [],
    coverImage: null,
    mapPinImage: null,
    registrationCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('MapSearchBar suggestions', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('calls the selection callback, dismisses the keyboard, and keeps the search text', async (): Promise<void> => {
    const suggestion: GanapListItem = ganap('cpu-dev-meetup');
    const onSelectSuggestion = jest.fn<(item: GanapListItem) => void>();
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation((): void => undefined);
    const screen = await render(
      <MapSearchBar
        value="developer meetup"
        onChangeText={jest.fn<(value: string) => void>()}
        suggestions={[suggestion]}
        isLoadingSuggestions={false}
        isErrorSuggestions={false}
        onSelectSuggestion={onSelectSuggestion}
      />,
    );

    await fireEvent(screen.getByLabelText('Search events'), 'focus');
    await fireEvent.press(screen.getByRole('button', { name: suggestion.title }));

    expect(onSelectSuggestion).toHaveBeenCalledWith(suggestion);
    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Search events').props.value).toBe('developer meetup');
    expect(screen.queryByTestId('map-search-suggestions')).toBeNull();
  });

  it('announces loading and empty states for a non-empty focused search', async (): Promise<void> => {
    const screen = await render(
      <MapSearchBar
        value="volleyball"
        onChangeText={jest.fn<(value: string) => void>()}
        suggestions={[]}
        isLoadingSuggestions={true}
        isErrorSuggestions={false}
        onSelectSuggestion={jest.fn<(item: GanapListItem) => void>()}
      />,
    );

    await fireEvent(screen.getByLabelText('Search events'), 'focus');
    expect(screen.getByText('Searching events...')).toBeTruthy();

    await screen.rerender(
      <MapSearchBar
        value="volleyball"
        onChangeText={jest.fn<(value: string) => void>()}
        suggestions={[]}
        isLoadingSuggestions={false}
        isErrorSuggestions={false}
        onSelectSuggestion={jest.fn<(item: GanapListItem) => void>()}
      />,
    );

    expect(screen.getByText('No events found')).toBeTruthy();
  });

  it('bounds the visible suggestions to five accessible choices', async (): Promise<void> => {
    const suggestions: GanapListItem[] = Array.from(
      { length: 6 },
      (_, index: number): GanapListItem => ganap(`suggestion-${index + 1}`),
    );
    const screen = await render(
      <MapSearchBar
        value="ganap"
        onChangeText={jest.fn<(value: string) => void>()}
        suggestions={suggestions}
        isLoadingSuggestions={false}
        isErrorSuggestions={false}
        onSelectSuggestion={jest.fn<(item: GanapListItem) => void>()}
      />,
    );

    await fireEvent(screen.getByLabelText('Search events'), 'focus');

    expect(screen.getByTestId('map-search-suggestions')).toBeTruthy();
    for (let index = 1; index <= 5; index += 1) {
      expect(screen.getByTestId(`map-search-suggestion-suggestion-${index}`)).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Ganap suggestion-6' })).toBeNull();
  });

  it('shows an error instead of stale suggestions when the search query fails', async (): Promise<void> => {
    const staleSuggestion: GanapListItem = ganap('stale-result');
    const screen = await render(
      <MapSearchBar
        value="new search"
        onChangeText={jest.fn<(value: string) => void>()}
        suggestions={[staleSuggestion]}
        isLoadingSuggestions={false}
        isErrorSuggestions={true}
        onSelectSuggestion={jest.fn<(item: GanapListItem) => void>()}
      />,
    );

    await fireEvent(screen.getByLabelText('Search events'), 'focus');

    expect(screen.getByText("Couldn't load event suggestions.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: staleSuggestion.title })).toBeNull();
  });
});
