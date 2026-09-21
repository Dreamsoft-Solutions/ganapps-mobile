import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { MIN_TOUCH_TARGET } from '@/constants/touch-target';
import { classSizeDp } from '@/utils/tailwind-metrics';
import { SEGMENT_OPTION_CLASSES, SegmentControl } from './SegmentControl';

type Segment = 'joined' | 'saved';

const options: ReadonlyArray<{ value: Segment; label: string }> = [
  { value: 'joined', label: 'Joined' },
  { value: 'saved', label: 'Saved' },
];

describe('SegmentControl', () => {
  it('marks only the active option as selected', async (): Promise<void> => {
    const screen = await render(
      <SegmentControl<Segment> value="joined" options={options} onChange={jest.fn()} label="My events view" />,
    );

    expect(screen.getByRole('tab', { name: 'Joined' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('tab', { name: 'Saved' }).props.accessibilityState.selected).toBe(false);
  });

  it('exposes the group as a labelled tablist', async (): Promise<void> => {
    const screen = await render(
      <SegmentControl<Segment> value="joined" options={options} onChange={jest.fn()} label="My events view" />,
    );

    expect(screen.getByLabelText('My events view')).toBeTruthy();
  });

  it('reports the chosen option', async (): Promise<void> => {
    const onChange = jest.fn<(value: Segment) => void>();
    const screen = await render(
      <SegmentControl<Segment> value="joined" options={options} onChange={onChange} label="My events view" />,
    );

    fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));

    expect(onChange).toHaveBeenCalledWith('saved');
  });

  it('renders options at the platform touch minimum', (): void => {
    expect(classSizeDp(SEGMENT_OPTION_CLASSES, 'min-h')).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});
