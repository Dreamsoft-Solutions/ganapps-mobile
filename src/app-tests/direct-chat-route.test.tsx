import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import DirectChatThreadScreen from '@/app/(app)/(chat)/direct-chat/[conversation-id]';
import type { DirectChatThreadViewProps } from '@/components/chat/DirectChatThreadView';
import type { ModerationActionSheetProps } from '@/components/moderation/ModerationActionSheet';
import type { BlockUserVariables } from '@/hooks/mutations/useModerationMutation';
import type { ChatMessage } from '@/types/chat.types';

let mockCurrentUser: { id: string } | null = null;
let mockSheetProps: ModerationActionSheetProps | null = null;
let mockOnMessageActions: ((message: ChatMessage) => void) | null = null;
const mockBlockUser = jest.fn<(variables: BlockUserVariables) => Promise<void>>();

jest.mock('expo-router', (): object => ({
  useFocusEffect: (): void => {},
  useLocalSearchParams: (): { 'conversation-id': string } => ({ 'conversation-id': 'conversation-42' }),
  useRouter: (): object => ({ canDismiss: (): boolean => false, dismiss: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/components/chat/DirectChatThreadView', (): object => ({
  DirectChatThreadView: ({ onMessageActions }: DirectChatThreadViewProps): null => {
    mockOnMessageActions = onMessageActions ?? null;
    return null;
  },
}));
jest.mock('@/components/moderation/ModerationActionSheet', (): object => ({
  ModerationActionSheet: (props: ModerationActionSheetProps): null => {
    mockSheetProps = props;
    return null;
  },
}));
jest.mock('@/hooks/mutations/useChatEngagementMutation', (): object => ({
  useMessageReactionMutation: (): object => ({ isPending: false }),
  useUnsendMessageMutation: (): object => ({ isPending: false }),
}));
jest.mock('@/hooks/mutations/useModerationMutation', (): object => ({
  useBlockUserMutation: (): object => ({ mutateAsync: mockBlockUser }),
  useCreateReportMutation: (): object => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/hooks/queries/useChatQuery', (): object => ({
  useDirectChatListQuery: (): object => ({ summaries: [], isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock('@/hooks/useDirectChat', (): object => ({
  useDirectChat: (): object => ({ session: null, accessRevoked: false }),
}));
jest.mock('@/store/auth.store', (): object => ({
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown): unknown =>
    selector({ user: mockCurrentUser }),
}));
jest.mock('@/store/toast.store', (): object => ({ showToast: jest.fn() }));

afterEach((): void => {
  jest.clearAllMocks();
  mockCurrentUser = null;
  mockSheetProps = null;
  mockOnMessageActions = null;
});

function chatMessage(senderId: string): ChatMessage {
  return {
    id: `message-from-${senderId}`,
    conversationId: 'conversation-42',
    senderId,
    senderUsername: `${senderId}-name`,
    senderDisplayPicture: null,
    content: 'Hello',
    type: 'TEXT',
    sentAt: '2026-11-02T08:00:00.000Z',
  };
}

describe('Direct Chat message actions', (): void => {
  it("offers Block user on the other person's message and blocks its sender", async (): Promise<void> => {
    mockCurrentUser = { id: 'user-1' };
    mockBlockUser.mockResolvedValue(undefined);
    const screen = await render(<DirectChatThreadScreen />);

    await act((): void => mockOnMessageActions?.(chatMessage('user-2')));

    expect(mockSheetProps?.target).toMatchObject({ type: 'MESSAGE', senderId: 'user-2', canBlock: true });
    await mockSheetProps?.onBlock?.('user-2');
    expect(mockBlockUser).toHaveBeenCalledWith({ userId: 'user-2' });
    await screen.unmount();
  });

  it("does not offer Block user on the current user's own message", async (): Promise<void> => {
    mockCurrentUser = { id: 'user-1' };
    const screen = await render(<DirectChatThreadScreen />);

    await act((): void => mockOnMessageActions?.(chatMessage('user-1')));

    expect(mockSheetProps?.target).toMatchObject({ type: 'MESSAGE', senderId: 'user-1', canBlock: false });
    await screen.unmount();
  });
});
