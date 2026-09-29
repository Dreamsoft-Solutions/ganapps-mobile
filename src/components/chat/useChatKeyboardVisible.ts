import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Tracks whether the native keyboard is currently visible.
 *
 * @returns Whether the soft keyboard is shown.
 */
export function useChatKeyboardVisible(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(() => Keyboard.isVisible());

  useEffect((): (() => void) => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (): void => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', (): void => setIsKeyboardVisible(false));

    return (): void => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return isKeyboardVisible;
}
