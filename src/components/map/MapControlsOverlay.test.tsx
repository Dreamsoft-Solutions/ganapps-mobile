import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { MapControlsOverlay } from './MapControlsOverlay';

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native') as typeof import('react-native');
  const React = require('react') as typeof import('react');
  return {
    __esModule: true,
    default: { View: ReactNative.View },
    useSharedValue: (value: number): { value: number } => React.useRef({ value }).current,
    useAnimatedStyle: (updater: () => unknown): unknown => updater(),
  };
});

function Harness({ selection, position }: { selection: boolean; position: number }): ReactElement {
  const height = useSharedValue<number>(800);
  const sheet = useSharedValue<number>(position);
  sheet.value = position;
  return (
    <MapControlsOverlay
      side="left"
      hasSelection={selection}
      mapHeight={height}
      sheetPosition={sheet}
      topOverlayHeight={140}
    >
      <Text>Map view</Text>
    </MapControlsOverlay>
  );
}

describe('map control sheet geometry', (): void => {
  it('uses the bottom without a sheet and follows peek, drag, and dismissal', async (): Promise<void> => {
    const screen = await render(<Harness selection={false} position={-1} />);
    expect(screen.getByTestId('map-controls-overlay-left')).toHaveStyle({ bottom: 40 });
    await screen.rerender(<Harness selection position={620} />);
    expect(screen.getByTestId('map-controls-overlay-left')).toHaveStyle({ bottom: 192 });
    await screen.rerender(<Harness selection position={400} />);
    expect(screen.getByTestId('map-controls-overlay-left')).toHaveStyle({ bottom: 412 });
    await screen.rerender(<Harness selection={false} position={400} />);
    expect(screen.getByTestId('map-controls-overlay-left')).toHaveStyle({ bottom: 40 });
  });

  it('retains positive measured height while hidden at the available-space boundary', async (): Promise<void> => {
    const screen = await render(<Harness selection position={620} />);
    await fireEvent(screen.getByTestId('map-controls-overlay-left'), 'layout', {
      nativeEvent: { layout: { height: 200 } },
    });
    await screen.rerender(<Harness selection position={351} />);
    expect(screen.getByTestId('map-controls-overlay-left', { includeHiddenElements: true })).toHaveStyle({
      display: 'none',
    });
    await fireEvent(screen.getByTestId('map-controls-overlay-left', { includeHiddenElements: true }), 'layout', {
      nativeEvent: { layout: { height: 0 } },
    });
    await screen.rerender(<Harness selection position={351} />);
    expect(screen.getByTestId('map-controls-overlay-left', { includeHiddenElements: true })).toHaveStyle({
      display: 'none',
    });
    await screen.rerender(<Harness selection position={352} />);
    expect(screen.getByTestId('map-controls-overlay-left')).toHaveStyle({ display: 'flex' });
  });
});
