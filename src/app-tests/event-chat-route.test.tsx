import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { TabRouter } from 'expo-router/build/react-navigation/routers/TabRouter';
import EventChatThreadScreen from '@/app/(app)/(chat)/event-chat/[ganap-id]';
import { Routes } from '@/constants/routes';
import type { UseChatResult } from '@/hooks/useChat';

const mockRouter = {
  dismiss: jest.fn<() => void>(),
  navigate: jest.fn<(href: unknown) => void>(),
  replace: jest.fn<(href: unknown) => void>(),
};

interface MockMutation {
  isPending: boolean;
  mutateAsync: () => Promise<null>;
}

const mockChat: UseChatResult = {
  session: null,
  messages: [],
  hasNextPage: false,
  isFetchingNextPage: false,
  loadMore: jest.fn<UseChatResult['loadMore']>(),
  fetchNextPage: jest.fn<UseChatResult['fetchNextPage']>(),
  isLoading: true,
  error: null,
  refetch: jest.fn<UseChatResult['refetch']>(),
  isSending: false,
  isMarkingRead: false,
  failedDrafts: [],
  sendMessage: jest.fn<UseChatResult['sendMessage']>(),
  send: jest.fn<UseChatResult['send']>(),
  retryDraft: jest.fn<UseChatResult['retryDraft']>(),
  discardDraft: jest.fn<UseChatResult['discardDraft']>(),
  imageDraft: null,
  imagePickerError: null,
  imageRetryAfterSeconds: null,
  pickImage: jest.fn<UseChatResult['pickImage']>(),
  removeImage: jest.fn<UseChatResult['removeImage']>(),
  sendImage: jest.fn<UseChatResult['sendImage']>(),
  retryImage: jest.fn<UseChatResult['retryImage']>(),
  refreshImage: jest.fn<UseChatResult['refreshImage']>(),
  connectionState: 'disconnected',
  accessLost: false,
  accessRevoked: false,
  isReadOnly: false,
};

jest.mock(
  'expo-router',
  (): {
    useLocalSearchParams: () => { 'ganap-id': string };
    useRouter: () => typeof mockRouter;
  } => ({
    useLocalSearchParams: (): { 'ganap-id': string } => ({ 'ganap-id': 'ganap-42' }),
    useRouter: (): typeof mockRouter => mockRouter,
  }),
);

jest.mock('@/components/chat/EventChatThreadView', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');

  return {
    EventChatThreadView: ({ ganapTitle, onBack }: { ganapTitle: string; onBack: () => void }): React.ReactElement =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ReactNative.Text, null, ganapTitle),
        React.createElement(ReactNative.Pressable, {
          accessibilityLabel: 'Back to Event Hub',
          accessibilityRole: 'button',
          onPress: onBack,
        }),
      ),
  };
});

jest.mock('@/components/moderation/ModerationActionSheet', (): { ModerationActionSheet: () => null } => ({
  ModerationActionSheet: (): null => null,
}));

jest.mock(
  '@/hooks/mutations/useChatEngagementMutation',
  (): {
    useMessageReactionMutation: () => MockMutation;
    useUnsendMessageMutation: () => MockMutation;
  } => ({
    useMessageReactionMutation: (): MockMutation => ({
      isPending: false,
      mutateAsync: (): Promise<null> => Promise.resolve(null),
    }),
    useUnsendMessageMutation: (): MockMutation => ({
      isPending: false,
      mutateAsync: (): Promise<null> => Promise.resolve(null),
    }),
  }),
);

jest.mock(
  '@/hooks/mutations/useModerationMutation',
  (): { useCreateReportMutation: () => { mutateAsync: () => Promise<null> } } => ({
    useCreateReportMutation: (): { mutateAsync: () => Promise<null> } => ({
      mutateAsync: (): Promise<null> => Promise.resolve(null),
    }),
  }),
);

jest.mock('@/hooks/queries/useGanapsQuery', (): { useGanapDetailQuery: () => { data: undefined } } => ({
  useGanapDetailQuery: (): { data: undefined } => ({ data: undefined }),
}));

jest.mock('@/hooks/useChat', (): { useChat: () => UseChatResult } => ({
  useChat: (): UseChatResult => mockChat,
}));

jest.mock('@/store/auth.store', (): { useAuthStore: (selector: (state: { user: null }) => unknown) => unknown } => ({
  useAuthStore: (selector: (state: { user: null }) => unknown): unknown => selector({ user: null }),
}));

jest.mock('@/store/toast.store', (): { showToast: () => void } => ({
  showToast: (): void => undefined,
}));

afterEach((): void => {
  jest.clearAllMocks();
});

describe('Event Chat route navigation', (): void => {
  it('uses a neutral title while loading and navigates to this Ganap’s Event Hub', async (): Promise<void> => {
    const screen = await render(<EventChatThreadScreen />);

    expect(screen.getByText('Ganap')).toBeTruthy();
    expect(screen.queryByText('Event Chat')).toBeNull();

    fireEvent.press(screen.getByLabelText('Back to Event Hub'));

    expect(mockRouter.navigate).toHaveBeenCalledWith(Routes.eventHub('ganap-42'));
    expect(mockRouter.dismiss).not.toHaveBeenCalled();
  });

  it('activates the Event Hub tab with its nested route params', (): void => {
    const routerOptions = {
      routeNames: ['(home)', '(ganaps)', '(chat)', '(profile)'],
      routeParamList: {},
      routeGetIdList: {},
    };
    const tabRouter = TabRouter({ initialRouteName: '(chat)' });
    const chatState = tabRouter.getInitialState(routerOptions);
    const eventHubParams = {
      screen: 'event-hub/[ganap-id]',
      params: { 'ganap-id': 'ganap-42' },
    };
    const eventHubAction: Parameters<typeof tabRouter.getStateForAction>[1] = {
      type: 'NAVIGATE',
      payload: { name: '(home)', params: eventHubParams },
    };

    const nextState = tabRouter.getStateForAction(chatState, eventHubAction, routerOptions);
    if (nextState === null || nextState.index === undefined) {
      throw new Error('Expected Event Hub navigation to select a tab.');
    }

    expect(nextState.routes[nextState.index]?.name).toBe('(home)');
    expect(nextState.routes[nextState.index]?.params).toEqual(eventHubParams);
    expect(
      tabRouter.getStateForAction(
        chatState,
        {
          type: 'POP_TO',
          payload: { name: '(home)', params: eventHubParams },
        } as unknown as Parameters<typeof tabRouter.getStateForAction>[1],
        routerOptions,
      ),
    ).toBeNull();
  });
});
