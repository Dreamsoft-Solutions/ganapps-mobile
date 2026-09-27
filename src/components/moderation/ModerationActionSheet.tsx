import { X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Text } from '@/components/common/Text';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { showToast } from '@/store/toast.store';
import type { CreateReportInput, ModerationReportReason, ModerationReportReceipt } from '@/types/moderation.types';
import { getModerationErrorMessage, MODERATION_REASONS } from '@/utils/moderation';

/** Message target presented by the moderation action sheet. */
export interface MessageModerationTarget {
  type: 'MESSAGE';
  id: string;
  senderId: string;
  senderLabel: string;
  /** True when the message is the authenticated User's currently eligible text/image. */
  canUnsend?: boolean;
}

/** User target presented by the moderation action sheet. */
export interface UserModerationTarget {
  type: 'USER';
  id: string;
  senderLabel: string;
  /** Present only when the profile came from an authorized Event or Direct conversation. */
  contextConversationId?: string;
  /** False when the target is the authenticated User; self-block is not offered. */
  canBlock?: boolean;
}

/** Target union accepted by the moderation action sheet. */
export type ModerationActionTarget = MessageModerationTarget | UserModerationTarget;

/** Props for the reusable report/block action sheet. */
export interface ModerationActionSheetProps {
  visible: boolean;
  target: ModerationActionTarget | null;
  onClose: () => void;
  onReport: (input: CreateReportInput) => Promise<ModerationReportReceipt>;
  onBlock?: (userId: string) => Promise<void>;
  /** Performs the sender-owned unsend after the in-app confirmation. */
  onUnsend?: () => void | Promise<void>;
}

type SheetStep = 'actions' | 'reasons' | 'report-confirm' | 'block-confirm' | 'block-success' | 'unsend-confirm';

/** Maximum Unicode characters accepted for an `OTHER` report detail. */
export const MAX_REPORT_DETAILS_LENGTH = 1_000;

function isUserReportTarget(target: ModerationActionTarget | null): target is UserModerationTarget {
  return target?.type === 'USER';
}

function getReportHeading(target: ModerationActionTarget): string {
  return target.type === 'MESSAGE' ? 'Report this message?' : 'Report this user?';
}

function getReportActionLabel(target: ModerationActionTarget): string {
  return target.type === 'MESSAGE' ? 'Report message' : 'Report user';
}

function getTargetDescription(target: ModerationActionTarget): string {
  return target.type === 'MESSAGE' ? `Message from ${target.senderLabel}` : target.senderLabel;
}

function canBlockTarget(target: ModerationActionTarget): boolean {
  return target.type === 'USER' && Boolean(target.id) && target.canBlock !== false;
}

function limitReportDetails(value: string): string {
  return Array.from(value).slice(0, MAX_REPORT_DETAILS_LENGTH).join('');
}

function buildReportInput(
  target: ModerationActionTarget,
  reason: ModerationReportReason,
  details: string,
): CreateReportInput | null {
  const boundedDetails: string = limitReportDetails(details);
  const reportDetails: Pick<CreateReportInput, 'details'> =
    reason === 'OTHER' && boundedDetails ? { details: boundedDetails } : {};
  if (target.type === 'MESSAGE') {
    return {
      target: { type: 'MESSAGE', id: target.id },
      reason,
      ...reportDetails,
    };
  }
  if (!target.contextConversationId) return null;
  return {
    target: { type: 'USER', id: target.id },
    contextConversationId: target.contextConversationId,
    reason,
    ...reportDetails,
  };
}

/**
 * Renders report and unsend actions for a message, or report and block actions for an authorized profile.
 *
 * The sheet keeps report details local until submit, sends only the typed
 * server payload, and leaves visibility decisions to the server response.
 *
 * @param props - Target and mutation callbacks
 * @returns A safe-area-aware, keyboard-safe moderation sheet
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The action sheet intentionally renders its explicit moderation state machine in one place.
export function ModerationActionSheet({
  visible,
  target,
  onClose,
  onReport,
  onBlock,
  onUnsend,
}: ModerationActionSheetProps): ReactElement | null {
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const [step, setStep] = useState<SheetStep>('actions');
  const [reason, setReason] = useState<ModerationReportReason | null>(null);
  const [details, setDetails] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect((): void => {
    if (!visible) return;
    setStep('actions');
    setReason(null);
    setDetails('');
    setError(null);
    setIsSubmitting(false);
  }, [visible]);

  if (!visible || !target) return null;

  const close = (): void => {
    if (isSubmitting) return;
    onClose();
  };

  const submitReport = async (): Promise<void> => {
    if (!reason || isSubmitting) return;
    const reportInput: CreateReportInput | null = buildReportInput(target, reason, details.trim());
    if (!reportInput) {
      setError(new Error('Report unavailable.'));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onReport(reportInput);
      showToast('success', "Report received. We'll review it.");
      onClose();
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError : new Error('Unable to submit report.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitBlock = async (): Promise<void> => {
    if (!onBlock || isSubmitting || !canBlockTarget(target)) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onBlock(target.id);
      setStep('block-success');
      AccessibilityInfo.announceForAccessibility('User blocked.');
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError : new Error('Unable to block this user.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitUnsend = async (): Promise<void> => {
    if (!onUnsend || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onUnsend();
      showToast('success', 'Message unsent.');
      onClose();
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError : new Error('This message could not be unsent.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderHeader = (title: string): ReactElement => (
    <View className="mb-md flex-row items-center justify-between">
      <Text className="flex-1 font-inter-bold text-headline-sm" accessibilityRole="header">
        {title}
      </Text>
      <IconButton accessibilityLabel="Close moderation actions" onPress={close} disabled={isSubmitting}>
        <X size={20} color={Colors[theme].foreground} />
      </IconButton>
    </View>
  );

  const renderError = (fallback: string): ReactElement | null => {
    if (!error) return null;
    return (
      <View className="mb-md rounded-lg border border-destructive bg-background p-sm">
        <Text accessibilityLiveRegion="polite" className="text-body-md text-destructive">
          {getModerationErrorMessage(error, fallback)}
        </Text>
        <Text className="mt-xs text-body-md text-muted-foreground">You can try again.</Text>
      </View>
    );
  };

  const renderAction = (label: string, onPress: () => void, destructive = false): ReactElement => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`mb-sm rounded-lg border px-md py-md ${destructive ? 'border-destructive' : 'border-border'} bg-background active:opacity-70`}
    >
      <Text className={destructive ? 'text-body-lg text-destructive' : 'text-body-lg'}>{label}</Text>
    </Pressable>
  );

  let content: ReactElement;
  if (step === 'actions') {
    content = (
      <>
        {renderHeader('Moderation actions')}
        <Text className="mb-md text-body-md text-muted-foreground">{getTargetDescription(target)}</Text>
        {target.type === 'MESSAGE' &&
          renderAction(getReportActionLabel(target), (): void => {
            setError(null);
            setStep('reasons');
          })}
        {target.type === 'MESSAGE' &&
          target.canUnsend &&
          onUnsend &&
          renderAction(
            'Unsend message',
            (): void => {
              setError(null);
              setStep('unsend-confirm');
            },
            true,
          )}
        {isUserReportTarget(target) &&
          target.contextConversationId &&
          renderAction(getReportActionLabel(target), (): void => {
            setError(null);
            setStep('reasons');
          })}
        {onBlock &&
          canBlockTarget(target) &&
          renderAction(
            'Block user',
            (): void => {
              setError(null);
              setStep('block-confirm');
            },
            true,
          )}
      </>
    );
  } else if (step === 'reasons') {
    content = (
      <>
        {renderHeader('Why are you reporting this?')}
        <Text className="mb-md text-body-md text-muted-foreground">Choose one reason to continue.</Text>
        <View accessibilityRole="radiogroup">
          {MODERATION_REASONS.map(
            ({ value, label }): ReactElement => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ selected: reason === value }}
                onPress={(): void => setReason(value)}
                className={`mb-sm rounded-lg border px-md py-md ${reason === value ? 'border-primary bg-muted' : 'border-border bg-background'}`}
              >
                <Text className="text-body-lg">{label}</Text>
              </Pressable>
            ),
          )}
        </View>
        {reason === 'OTHER' && (
          <View className="mb-md">
            <Text nativeID="moderation-details-label" className="mb-xs font-inter-semibold text-label-md">
              Details (optional)
            </Text>
            <TextInput
              accessibilityLabel="Details (optional)"
              aria-labelledby="moderation-details-label"
              multiline
              maxLength={MAX_REPORT_DETAILS_LENGTH}
              value={details}
              onChangeText={(value: string): void => setDetails(limitReportDetails(value))}
              placeholder="Tell us more"
              placeholderTextColor={Colors[theme]['muted-foreground']}
              textAlignVertical="top"
              className="min-h-24 rounded-lg border border-input bg-background px-md py-sm text-body-md text-foreground"
            />
            <Text className="mt-xs text-right text-label-sm text-muted-foreground">
              {Array.from(details).length}/{MAX_REPORT_DETAILS_LENGTH.toLocaleString()}
            </Text>
          </View>
        )}
        {renderError('Unable to submit report.')}
        <Button
          variant="default"
          disabled={!reason || isSubmitting}
          loading={isSubmitting}
          accessibilityHint="Moves to report confirmation"
          onPress={(): void => {
            setError(null);
            setStep('report-confirm');
          }}
        >
          Continue
        </Button>
      </>
    );
  } else if (step === 'report-confirm') {
    content = (
      <>
        {renderHeader(getReportHeading(target))}
        <Text className="mb-lg text-body-md text-muted-foreground">
          Your report will be sent to the appropriate moderation team for review.
        </Text>
        {renderError('Unable to submit report.')}
        <Button
          disabled={isSubmitting}
          loading={isSubmitting}
          accessibilityHint="Sends this report for human review"
          onPress={(): void => void submitReport()}
        >
          Submit report
        </Button>
        <View className="mt-sm">
          <Button variant="outline" disabled={isSubmitting} onPress={(): void => setStep('reasons')}>
            Back
          </Button>
        </View>
      </>
    );
  } else if (step === 'unsend-confirm') {
    content = (
      <>
        {renderHeader('Unsend this message?')}
        <Text className="mb-lg text-body-md text-muted-foreground">
          This message will be replaced with “Message unsent” for everyone in the conversation.
        </Text>
        {renderError('This message could not be unsent.')}
        <Button
          variant="destructive"
          disabled={isSubmitting}
          loading={isSubmitting}
          accessibilityHint="Replaces your message with a Message unsent notice for everyone"
          onPress={(): void => void submitUnsend()}
        >
          Unsend for everyone
        </Button>
        <View className="mt-sm">
          <Button variant="outline" disabled={isSubmitting} onPress={(): void => setStep('actions')}>
            Cancel
          </Button>
        </View>
      </>
    );
  } else if (step === 'block-confirm') {
    content = (
      <>
        {renderHeader('Block this user?')}
        <Text className="mb-lg text-body-md text-muted-foreground">
          Their messages will disappear from your visible Event and Direct Chat history, and new direct requests will be
          prevented. You can undo this in Settings.
        </Text>
        <Text className="mb-lg text-body-md text-muted-foreground">
          Blocking removes Friendship for both Users. Unblocking will not restore the Friendship or a pending request.
        </Text>
        {renderError('Unable to block this user.')}
        <Button
          variant="destructive"
          disabled={isSubmitting}
          loading={isSubmitting}
          accessibilityHint="Removes this user's messages and prevents new direct requests"
          onPress={(): void => void submitBlock()}
        >
          Block user
        </Button>
        <View className="mt-sm">
          <Button variant="outline" disabled={isSubmitting} onPress={(): void => setStep('actions')}>
            Cancel
          </Button>
        </View>
      </>
    );
  } else {
    content = (
      <>
        {renderHeader('User blocked')}
        <Text accessibilityLiveRegion="polite" className="mb-lg text-body-lg">
          User blocked. Their messages will no longer appear in your visible chat history.
        </Text>
        <Button onPress={close}>Done</Button>
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} accessibilityViewIsModal>
      <View className="flex-1 justify-end bg-black/40">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? Spacing.md : 0}
          className="max-h-[92%] rounded-t-xl bg-popover"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + Spacing.md }}
          >
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
