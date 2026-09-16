import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { ModerationActionSheet, type ModerationActionTarget } from '@/components/moderation/ModerationActionSheet';
import { useBlockUserMutation, useCreateReportMutation } from '@/hooks/mutations/useModerationMutation';
import { useAuthStore } from '@/store/auth.store';
import type { CreateReportInput, ModerationReportReceipt } from '@/types/moderation.types';

/** Safe profile fields and optional authorized conversation context for moderation actions. */
export interface UserModerationActionsProps {
  userId: string;
  username: string;
  displayName: string;
  /** Set only when this profile was opened from an authorized Event or Direct conversation. */
  contextConversationId?: string;
}

/**
 * Renders profile moderation actions with server-scope gating for User reports.
 *
 * Standalone profiles always retain Block user, while Report user is rendered
 * only when the route provides an authorized conversation locator.
 *
 * @param props - Safe profile identity and optional report context
 * @returns Profile block/report actions and their confirmation sheet
 */
export function UserModerationActions({
  userId,
  username,
  displayName,
  contextConversationId,
}: UserModerationActionsProps): ReactElement {
  const currentUserId: string | null = useAuthStore((state) => state.user?.id ?? null);
  const reportMutation = useCreateReportMutation();
  const blockMutation = useBlockUserMutation();
  const [visible, setVisible] = useState<boolean>(false);
  const target: ModerationActionTarget = {
    type: 'USER',
    id: userId,
    senderLabel: `${displayName} (@${username})`,
    contextConversationId,
    canBlock: currentUserId !== null && currentUserId !== userId,
  };
  const open = useCallback((): void => setVisible(true), []);
  const close = useCallback((): void => setVisible(false), []);
  const onReport = useCallback(
    (input: CreateReportInput): Promise<ModerationReportReceipt> => reportMutation.mutateAsync(input),
    [reportMutation],
  );
  const onBlock = useCallback(
    (blockedUserId: string): Promise<void> => blockMutation.mutateAsync({ userId: blockedUserId }),
    [blockMutation],
  );

  return (
    <>
      <View className="gap-sm">
        <Button variant="destructive" onPress={open} accessibilityHint="Opens actions to block this user">
          Block user
        </Button>
        {contextConversationId && (
          <Button variant="outline" onPress={open} accessibilityHint="Opens the report flow for this user">
            Report user
          </Button>
        )}
      </View>
      <ModerationActionSheet visible={visible} target={target} onClose={close} onReport={onReport} onBlock={onBlock} />
    </>
  );
}
