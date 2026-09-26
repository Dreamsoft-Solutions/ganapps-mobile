import { describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { DeviceEventEmitter, type KeyboardEvent } from 'react-native';
import { useChatKeyboardVisible } from './useChatKeyboardVisible';

const keyboardEvent: KeyboardEvent = {
  duration: 0,
  easing: 'keyboard',
  endCoordinates: { screenX: 0, screenY: 0, width: 0, height: 0 },
};

describe('useChatKeyboardVisible', (): void => {
  beforeEach((): void => {
    DeviceEventEmitter.emit('keyboardDidHide', keyboardEvent);
  });

  it('tracks keyboard show and hide events and removes listeners on unmount', async (): Promise<void> => {
    const { result, unmount } = await renderHook((): boolean => useChatKeyboardVisible());

    expect(result.current).toBe(false);

    await act(async (): Promise<void> => {
      DeviceEventEmitter.emit('keyboardDidShow', keyboardEvent);
    });
    expect(result.current).toBe(true);

    await act(async (): Promise<void> => {
      DeviceEventEmitter.emit('keyboardDidHide', keyboardEvent);
    });
    expect(result.current).toBe(false);

    unmount();
  });
});
