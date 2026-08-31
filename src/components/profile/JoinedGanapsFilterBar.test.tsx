import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { JoinedGanapTimeFilter } from '@/types/profile.types';
import { JoinedGanapsFilterBar } from './JoinedGanapsFilterBar';

jest.mock('lucide-react-native', () => ({
  Search: (): null => null,
  X: (): null => null,
}));

describe('JoinedGanapsFilterBar', (): void => {
  it('renders a labeled native search field and three selectable chips', async (): Promise<void> => {
    const onSearchChange = jest.fn<(value: string) => void>();
    const onTimeChange = jest.fn<(value: JoinedGanapTimeFilter) => void>();
    const screen = await render(
      <JoinedGanapsFilterBar
        search="art"
        time="UPCOMING"
        onSearchChange={onSearchChange}
        onTimeChange={onTimeChange}
      />,
    );

    expect(screen.getByLabelText('Search joined events')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upcoming' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('button', { name: 'Past' }).props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByRole('button', { name: 'All' }).props.accessibilityState).toEqual({ selected: false });
    await fireEvent.changeText(screen.getByLabelText('Search joined events'), '  art  ');
    expect(onSearchChange).toHaveBeenCalledWith('  art  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Past' }));
    expect(onTimeChange).toHaveBeenCalledWith('PAST');
  });

  it('clears a nonblank search', async (): Promise<void> => {
    const onSearchChange = jest.fn<(value: string) => void>();
    const screen = await render(
      <JoinedGanapsFilterBar
        search="art"
        time="UPCOMING"
        onSearchChange={onSearchChange}
        onTimeChange={jest.fn<(value: JoinedGanapTimeFilter) => void>()}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Clear joined-event search'));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
