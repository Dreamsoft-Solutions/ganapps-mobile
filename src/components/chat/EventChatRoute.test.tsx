import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { useEffect as mockUseEffect, type ReactElement } from 'react';
import { BackHandler, Pressable as MockPressable, Text as MockText } from 'react-native';
import EventChatThreadScreen from '@/app/(app)/(chat)/event-chat/[ganap-id]';
import { Routes } from '@/constants/routes';
import type { EventChatThreadViewProps } from './EventChatThreadView';

const mockRouter = { dismissTo: jest.fn<(href: unknown) => void>(), navigate: jest.fn<(href: unknown) => void>() };
let mockParams: { 'ganap-id': string; returnTo?: string } = { 'ganap-id': 'g1' };
let mockRevoked: boolean = false;

jest.mock('expo-router', (): object => ({
  Stack: { Screen: (): null => null },
  useRouter: (): typeof mockRouter => mockRouter,
  useLocalSearchParams: (): typeof mockParams => mockParams,
  useFocusEffect: (callback: () => () => void): void => mockUseEffect(callback, [callback]),
}));
jest.mock('@/components/chat/EventChatThreadView', (): object => ({
  EventChatThreadView: ({ onBack }: EventChatThreadViewProps): ReactElement => (
    <MockPressable onPress={onBack}>
      <MockText>Back</MockText>
    </MockPressable>
  ),
}));
jest.mock('@/components/moderation/ModerationActionSheet', (): object => ({ ModerationActionSheet: (): null => null }));
jest.mock('@/hooks/queries/useGanapsQuery', (): object => ({
  useGanapDetailQuery: (): object => ({ data: { title: 'Ganap' } }),
}));
jest.mock('@/hooks/useChat', (): object => ({ useChat: (): object => ({ accessRevoked: mockRevoked }) }));
jest.mock('@/store/auth.store', (): object => ({
  useAuthStore: (selector: (state: { user: null }) => unknown): unknown => selector({ user: null }),
}));
jest.mock('@/store/toast.store', (): object => ({ showToast: jest.fn() }));
jest.mock('@/hooks/mutations/useChatEngagementMutation', (): object => ({
  useMessageReactionMutation: (): object => ({ isPending: false }),
  useUnsendMessageMutation: (): object => ({ isPending: false }),
}));
jest.mock('@/hooks/mutations/useModerationMutation', (): object => ({
  useCreateReportMutation: (): object => ({ mutateAsync: jest.fn() }),
}));

describe('Event Chat navigation', (): void => {
  beforeEach((): void => {
    jest.clearAllMocks();
    mockParams = { 'ganap-id': 'g1' };
    mockRevoked = false;
  });

  it('closes the chat stack back to Friends so revisiting the tab shows conversations', async (): Promise<void> => {
    mockParams.returnTo = 'friends';
    const screen = await render(<EventChatThreadScreen />);
    await fireEvent.press(screen.getByText('Back'));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith(Routes.app.chat);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it('clears the chat stack before returning to Event Hub for the default origin', async (): Promise<void> => {
    const screen = await render(<EventChatThreadScreen />);
    await fireEvent.press(screen.getByText('Back'));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith(Routes.app.chat);
    expect(mockRouter.navigate).toHaveBeenCalledWith(Routes.eventHub('g1'));
    expect(mockRouter.dismissTo.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouter.navigate.mock.invocationCallOrder[0] ?? 0,
    );
    await screen.unmount();
  });

  it('handles Android Back through the same origin-aware close action', async (): Promise<void> => {
    mockParams.returnTo = 'friends';
    let onBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    const remove = jest.fn<() => void>();
    const listener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler): { remove: () => void } => {
        onBack = handler;
        return { remove };
      });
    const screen = await render(<EventChatThreadScreen />);
    await act((): void => {
      expect(onBack?.({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);
    });
    expect(mockRouter.dismissTo).toHaveBeenCalledWith(Routes.app.chat);
    await screen.unmount();
    expect(remove).toHaveBeenCalled();
    listener.mockRestore();
  });

  it('uses the same close behavior when server access is revoked', async (): Promise<void> => {
    mockParams.returnTo = 'friends';
    mockRevoked = true;
    const screen = await render(<EventChatThreadScreen />);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith(Routes.app.chat);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await screen.unmount();
  });
});
