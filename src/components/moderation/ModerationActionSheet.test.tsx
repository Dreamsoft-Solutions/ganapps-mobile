import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { CreateReportInput, ModerationReportReceipt } from '@/types/moderation.types';
import { type MessageModerationTarget, ModerationActionSheet } from './ModerationActionSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('lucide-react-native', () => ({ X: (): null => null }));

const otherUsersMessage: MessageModerationTarget = {
  type: 'MESSAGE',
  id: 'message-1',
  senderId: 'user-2',
  senderLabel: 'ana',
  canBlock: true,
};

const reportStub = jest.fn<(input: CreateReportInput) => Promise<ModerationReportReceipt>>();

describe('ModerationActionSheet message actions', (): void => {
  it("blocks the sender of another user's message after confirmation", async (): Promise<void> => {
    const onBlock = jest.fn<(userId: string) => Promise<void>>().mockResolvedValue(undefined);
    const screen = await render(
      <ModerationActionSheet
        visible
        target={otherUsersMessage}
        onClose={jest.fn()}
        onReport={reportStub}
        onBlock={onBlock}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Block user'));
    expect(screen.getByText('Block this user?')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Block user'));

    expect(onBlock).toHaveBeenCalledWith('user-2');
    expect(await screen.findByText('User blocked')).toBeTruthy();
  });

  it("does not offer Block user on the current user's own message", async (): Promise<void> => {
    const screen = await render(
      <ModerationActionSheet
        visible
        target={{ ...otherUsersMessage, canBlock: false }}
        onClose={jest.fn()}
        onReport={reportStub}
        onBlock={jest.fn<(userId: string) => Promise<void>>()}
      />,
    );

    expect(screen.getByLabelText('Report message')).toBeTruthy();
    expect(screen.queryByLabelText('Block user')).toBeNull();
  });
});
