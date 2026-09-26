import { ArrowLeft, ImagePlus, MoreVertical, Send } from 'lucide-react-native';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatImageBubble, ChatImagePreview } from '@/components/chat/ChatImage';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { IconButton } from '@/components/common/IconButton';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { Colors, Spacing } from '@/constants/theme';
import type { DirectFailedDraft } from '@/hooks/useDirectChat';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { ChatConnectionState } from '@/services/chat-socket.service';
import { showToast } from '@/store/toast.store';
import type { ChatImageDraft as BaseChatImageDraft, ChatMessage } from '@/types/chat.types';
import type { DirectChatFriendSummary, DirectChatSession } from '@/types/direct-chat.types';
import { compareChatMessages } from '@/utils/chat';
import { getChatImageErrorMessage, isChatImageAuthorizationError } from '@/utils/chat-image';

/** Maximum text size accepted by the Direct Chat server contract. */
export const DIRECT_CHAT_MAX_MESSAGE_LENGTH = 2_000;

/** Props for the focused Direct Chat thread. */
export interface DirectChatThreadViewProps {
  session: DirectChatSession | null;
  friend: DirectChatFriendSummary | null;
  currentUserId: string | null;
  messages: ChatMessage[];
  failedDrafts: DirectFailedDraft[];
  latestOutgoingSeenAt: string | null;
  isLoading: boolean;
  error: Error | null;
  isSending: boolean;
  isMarkingRead: boolean;
  connectionState: ChatConnectionState;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onBack: () => void;
  onRetry: () => void | Promise<void>;
  onLoadMore: () => void | Promise<void>;
  onSend: (content: string) => void | Promise<void>;
  onRetryDraft: (clientMessageId: string) => void | Promise<void>;
  onDiscardDraft: (clientMessageId: string) => void;
  imageDraft?: BaseChatImageDraft | null;
  imagePickerError?: Error | null;
  imageRetryAfterSeconds?: number | null;
  onPickImage?: () => void | Promise<void>;
  onRemoveImage?: () => void;
  onSendImage?: () => void | Promise<void>;
  onRetryImage?: () => void | Promise<void>;
  onRefreshImage?: (messageId: string) => void | Promise<void>;
  onMessageActions?: (message: ChatMessage) => void;
  accessLost: boolean;
}

interface ImageLoadState {
  refreshRequested: boolean;
  loadFailed: boolean;
  reloadToken: number;
}

const INITIAL_IMAGE_LOAD_STATE: ImageLoadState = {
  refreshRequested: false,
  loadFailed: false,
  reloadToken: 0,
};

function formatMessageTime(sentAt: string): string {
  const date: Date = new Date(sentAt);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getMessageCopy(message: ChatMessage): string {
  if (message.type === 'IMAGE') return 'Photo';
  if (message.type === 'UNSENT') return 'Message unsent';
  return message.content ?? '';
}

function getLatestOutgoing(messages: ChatMessage[], currentUserId: string | null): ChatMessage | null {
  if (!currentUserId) return null;
  return messages.reduce<ChatMessage | null>((latest, message): ChatMessage | null => {
    if (message.senderId !== currentUserId) return latest;
    return latest === null || compareChatMessages(message, latest) > 0 ? message : latest;
  }, null);
}

function isSeenMessage(message: ChatMessage, latestOutgoing: ChatMessage | null, seenAt: string | null): boolean {
  if (!latestOutgoing || latestOutgoing.id !== message.id || !seenAt) return false;
  const messageTime: number = new Date(message.sentAt).getTime();
  const seenTime: number = new Date(seenAt).getTime();
  return !Number.isNaN(messageTime) && !Number.isNaN(seenTime) && seenTime >= messageTime;
}

interface MessageRowProps {
  message: ChatMessage;
  currentUserId: string | null;
  latestOutgoing: ChatMessage | null;
  latestOutgoingSeenAt: string | null;
  onMessageActions: (message: ChatMessage) => void;
  imageLoadState: ImageLoadState;
  onImageLoadError: (messageId: string, error: string) => void;
  onRetryImageLoad: (messageId: string) => void;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  messageCopy: string;
  media: NonNullable<ChatMessage['media']> | null;
  seen: boolean;
  messageLabel: string;
  imageLoadState: ImageLoadState;
  onMessageActions: (message: ChatMessage) => void;
  onImageLoadError: (messageId: string, error: string) => void;
  onRetryImageLoad: (messageId: string) => void;
}

interface MessageTimestampProps {
  isMine: boolean;
  sentAt: string;
  seen: boolean;
}

function MessageTimestamp({ isMine, sentAt, seen }: MessageTimestampProps): ReactElement {
  const textClassName: string = isMine ? 'text-primary-foreground' : 'text-muted-foreground';

  return (
    <View className="mt-xs flex-row items-center justify-end gap-xs">
      <Text className={`text-label-sm ${textClassName}`}>{formatMessageTime(sentAt)}</Text>
      {seen && (
        <Text accessibilityLabel="Seen" className={`text-label-sm font-inter-semibold ${textClassName}`}>
          Seen
        </Text>
      )}
    </View>
  );
}

function MessageBubble({
  message,
  isMine,
  messageCopy,
  media,
  seen,
  messageLabel,
  imageLoadState,
  onMessageActions,
  onImageLoadError,
  onRetryImageLoad,
}: MessageBubbleProps): ReactElement {
  const bubbleClassName: string = isMine ? 'bg-primary' : 'border border-border bg-card';

  return (
    <Pressable
      onLongPress={(): void => onMessageActions(message)}
      onPress={
        media
          ? (): void => {
              void Linking.openURL(media.url).catch((): void => {});
            }
          : undefined
      }
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={messageLabel}
      accessibilityHint="Long press to open message reactions and actions"
      className={`min-w-0 rounded-xl px-md py-sm ${bubbleClassName}`}
    >
      {!isMine && <Text className="font-inter-semibold text-label-md">{message.senderUsername}</Text>}
      {media ? (
        <ChatImageBubble
          media={media}
          senderUsername={isMine ? 'you' : message.senderUsername}
          reloadToken={imageLoadState.reloadToken}
          loadFailed={imageLoadState.loadFailed}
          onLoadError={(error: string): void => onImageLoadError(message.id, error)}
          onRetry={(): void => onRetryImageLoad(message.id)}
        />
      ) : (
        <Text className={`text-body-md ${isMine ? 'text-primary-foreground' : 'text-foreground'}`}>{messageCopy}</Text>
      )}
      <MessageTimestamp isMine={isMine} sentAt={message.sentAt} seen={seen} />
    </Pressable>
  );
}

function MessageRow({
  message,
  currentUserId,
  latestOutgoing,
  latestOutgoingSeenAt,
  onMessageActions,
  imageLoadState,
  onImageLoadError,
  onRetryImageLoad,
}: MessageRowProps): ReactElement {
  const theme = useResolvedTheme();
  const isMine: boolean = currentUserId !== null && message.senderId === currentUserId;
  const messageCopy: string = getMessageCopy(message);
  const media: NonNullable<ChatMessage['media']> | null = message.type === 'IMAGE' ? (message.media ?? null) : null;
  const messageLabel: string = media
    ? `Photo sent by ${isMine ? 'you' : message.senderUsername}`
    : `${messageCopy} from ${isMine ? 'you' : message.senderUsername}`;
  const seen: boolean = isSeenMessage(message, latestOutgoing, latestOutgoingSeenAt);
  const actionLabel: string = `Message actions for ${isMine ? 'your message' : message.senderUsername}`;
  return (
    <View className={`mb-md flex-row items-end px-md ${isMine ? 'justify-end' : 'justify-start'}`}>
      {!isMine && <Avatar src={message.senderDisplayPicture} name={message.senderUsername} size="xs" />}
      <View className={`min-w-0 max-w-[82%] flex-1 flex-row items-end ${isMine ? '' : 'ml-sm'}`}>
        <View className="min-w-0 flex-1">
          <MessageBubble
            message={message}
            isMine={isMine}
            messageCopy={messageCopy}
            media={media}
            seen={seen}
            messageLabel={messageLabel}
            imageLoadState={imageLoadState}
            onMessageActions={onMessageActions}
            onImageLoadError={onImageLoadError}
            onRetryImageLoad={onRetryImageLoad}
          />
        </View>
        <IconButton
          accessibilityLabel={actionLabel}
          accessibilityHint="Opens message reactions and actions"
          onPress={(): void => onMessageActions(message)}
          size="md"
        >
          <MoreVertical size={18} color={Colors[theme]['muted-foreground']} />
        </IconButton>
      </View>
    </View>
  );
}

function FailedDraftRow({
  draft,
  onRetry,
  onDiscard,
}: {
  draft: DirectFailedDraft;
  onRetry: () => void | Promise<void>;
  onDiscard: () => void;
}): ReactElement {
  return (
    <View className="mb-sm rounded-lg border border-destructive bg-background p-sm">
      <Text className="text-body-md text-destructive">Message could not be sent.</Text>
      <Text className="mt-xs text-body-md" numberOfLines={3}>
        {draft.content}
      </Text>
      <View className="mt-sm flex-row gap-sm">
        <Button
          size="sm"
          variant="outline"
          onPress={(): void => {
            void onRetry();
          }}
        >
          Retry message
        </Button>
        <Button size="sm" variant="ghost" onPress={onDiscard}>
          Discard message
        </Button>
      </View>
    </View>
  );
}

/**
 * Presents a Direct thread with directional bubbles and latest-outgoing-only Seen.
 *
 * Direct history and read authority remain aggregate/server state. This component only
 * renders the state and exposes explicit retry, image, navigation, and moderation actions.
 *
 * @param props - Server session, messages, composer, and route callbacks
 * @returns Keyboard-safe Direct Chat thread
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The thread explicitly handles access, loading, image, read-only, and composer states.
export function DirectChatThreadView({
  session,
  friend,
  currentUserId,
  messages,
  failedDrafts,
  latestOutgoingSeenAt,
  isLoading,
  error,
  isSending,
  isMarkingRead,
  connectionState,
  hasNextPage,
  isFetchingNextPage,
  onBack,
  onRetry,
  onLoadMore,
  onSend,
  onRetryDraft,
  onDiscardDraft,
  onMessageActions = (): void => {},
  imageDraft = null,
  imagePickerError = null,
  imageRetryAfterSeconds = null,
  onPickImage = async (): Promise<void> => {},
  onRemoveImage = (): void => {},
  onSendImage = async (): Promise<void> => {},
  onRetryImage = async (): Promise<void> => {},
  onRefreshImage = async (): Promise<void> => {},
  accessLost,
}: DirectChatThreadViewProps): ReactElement {
  const theme = useResolvedTheme();
  const insets = useSafeAreaInsets();
  const [draftText, setDraftText] = useState<string>('');
  const [imageLoadStates, setImageLoadStates] = useState<Record<string, ImageLoadState>>({});
  const imageRefreshIds = useRef<Set<string>>(new Set<string>());
  const latestOutgoing: ChatMessage | null = getLatestOutgoing(messages, currentUserId);
  const isReadOnly: boolean = Boolean(session?.canRead && !session.canSend);
  const canSendImage: boolean =
    imageDraft?.status === 'ready' ||
    (imageDraft?.status === 'retryable-failure' && (imageRetryAfterSeconds ?? 0) <= 0);
  const sendDisabled: boolean = isSending || (imageDraft ? !canSendImage : draftText.trim().length === 0);

  useEffect((): void => {
    if (imagePickerError) showToast('error', imagePickerError.message);
  }, [imagePickerError]);

  useEffect((): void => {
    if (imageDraft?.error) showToast('error', getChatImageErrorMessage(imageDraft.error));
  }, [imageDraft?.error]);

  const handleImageLoadError = useCallback(
    (messageId: string, imageError: string): void => {
      const current: ImageLoadState = imageLoadStates[messageId] ?? INITIAL_IMAGE_LOAD_STATE;
      if (
        !current.refreshRequested &&
        !imageRefreshIds.current.has(messageId) &&
        isChatImageAuthorizationError(imageError)
      ) {
        imageRefreshIds.current.add(messageId);
        setImageLoadStates(
          (states: Record<string, ImageLoadState>): Record<string, ImageLoadState> => ({
            ...states,
            [messageId]: { ...current, refreshRequested: true },
          }),
        );
        void Promise.resolve()
          .then((): void | Promise<void> => onRefreshImage(messageId))
          .then((): void => {
            setImageLoadStates((states: Record<string, ImageLoadState>): Record<string, ImageLoadState> => {
              const latest: ImageLoadState = states[messageId] ?? current;
              return {
                ...states,
                [messageId]: { ...latest, loadFailed: false, reloadToken: latest.reloadToken + 1 },
              };
            });
          })
          .catch((): void => {
            setImageLoadStates((states: Record<string, ImageLoadState>): Record<string, ImageLoadState> => {
              const latest: ImageLoadState = states[messageId] ?? current;
              return { ...states, [messageId]: { ...latest, refreshRequested: true, loadFailed: true } };
            });
          });
        return;
      }
      setImageLoadStates(
        (states: Record<string, ImageLoadState>): Record<string, ImageLoadState> => ({
          ...states,
          [messageId]: { ...current, loadFailed: true },
        }),
      );
    },
    [imageLoadStates, onRefreshImage],
  );

  const handleRetryImageLoad = useCallback((messageId: string): void => {
    setImageLoadStates((states: Record<string, ImageLoadState>): Record<string, ImageLoadState> => {
      const current: ImageLoadState = states[messageId] ?? INITIAL_IMAGE_LOAD_STATE;
      return {
        ...states,
        [messageId]: { ...current, loadFailed: false, reloadToken: current.reloadToken + 1 },
      };
    });
  }, []);

  if (accessLost) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-xl">
        <Text className="mb-sm text-center font-inter-semibold text-headline-sm" accessibilityRole="header">
          Direct Chat access is no longer available
        </Text>
        <Text className="mb-lg text-center text-body-md text-muted-foreground">
          This conversation is no longer available to read.
        </Text>
        <Button variant="outline" onPress={onBack}>
          Back to Friends
        </Button>
      </View>
    );
  }

  if (isLoading && messages.length === 0) return <Loading message="Loading direct chat" />;
  if (error && messages.length === 0) return <ErrorView error={error} onRetry={(): void => void onRetry()} />;

  const friendName: string = friend?.displayName || friend?.username || 'Direct Chat';
  const friendSubline: string = friend?.username ? `@${friend.username}` : '';
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? Spacing.lg : 0}
    >
      <View
        className="flex-row items-center border-b border-border px-md pb-sm"
        style={{ paddingTop: insets.top + Spacing.sm }}
      >
        <IconButton accessibilityLabel="Go back" accessibilityHint="Returns to Friends" onPress={onBack}>
          <ArrowLeft size={20} color={Colors[theme].foreground} />
        </IconButton>
        <Avatar src={friend?.displayPicture} name={friendName} size="sm" />
        <View className="ml-sm min-w-0 flex-1">
          <Text className="font-inter-bold text-headline-sm" numberOfLines={1} accessibilityRole="header">
            {friendName}
          </Text>
          {friendSubline && (
            <Text className="text-label-sm text-muted-foreground" numberOfLines={1}>
              {friendSubline}
            </Text>
          )}
        </View>
        {isMarkingRead && (
          <ActivityIndicator
            color={Colors[theme].primary}
            accessibilityLabel="Updating seen status"
            accessibilityHint="Your read position is being saved"
          />
        )}
      </View>

      {connectionState !== 'connected' && messages.length > 0 && (
        <View className="border-b border-border bg-muted px-md py-xs">
          <Text className="text-center text-label-md text-muted-foreground">Reconnecting to Direct Chat…</Text>
        </View>
      )}

      <FlatList
        data={messages}
        inverted
        keyExtractor={(message: ChatMessage): string => message.id}
        renderItem={({ item }: { item: ChatMessage }): ReactElement => (
          <MessageRow
            message={item}
            currentUserId={currentUserId}
            latestOutgoing={latestOutgoing}
            latestOutgoingSeenAt={latestOutgoingSeenAt}
            onMessageActions={onMessageActions}
            imageLoadState={imageLoadStates[item.id] ?? INITIAL_IMAGE_LOAD_STATE}
            onImageLoadError={handleImageLoadError}
            onRetryImageLoad={handleRetryImageLoad}
          />
        )}
        ListEmptyComponent={<Empty message="No messages yet. Start the conversation." inverted />}
        ListHeaderComponent={
          hasNextPage ? (
            <View className="items-center py-sm">
              <Button
                size="sm"
                variant="outline"
                loading={isFetchingNextPage}
                onPress={(): void => {
                  void onLoadMore();
                }}
              >
                Load older messages
              </Button>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: Spacing.md, flexGrow: 1 }}
        onEndReached={(): void => {
          if (hasNextPage && !isFetchingNextPage) void onLoadMore();
        }}
        onEndReachedThreshold={0.2}
      />

      {failedDrafts.length > 0 && (
        <View className="border-t border-border px-md pt-sm">
          {failedDrafts.map(
            (draft: DirectFailedDraft): ReactElement => (
              <FailedDraftRow
                key={draft.clientMessageId}
                draft={draft}
                onRetry={(): void => {
                  void onRetryDraft(draft.clientMessageId);
                }}
                onDiscard={(): void => onDiscardDraft(draft.clientMessageId)}
              />
            ),
          )}
        </View>
      )}

      {isReadOnly ? (
        <View className="border-t border-border px-md py-md" style={{ paddingBottom: insets.bottom + Spacing.sm }}>
          <Text className="text-center text-body-md text-muted-foreground">
            You can read this chat, but you cannot send messages.
          </Text>
        </View>
      ) : session?.canSend ? (
        <View className="border-t border-border px-md pt-sm" style={{ paddingBottom: insets.bottom + Spacing.sm }}>
          {imageDraft && <ChatImagePreview draft={imageDraft} onRemove={onRemoveImage} />}
          <Text nativeID="direct-chat-composer-label" className="mb-xs font-inter-semibold text-label-md">
            Message
          </Text>
          <View className="flex-row items-end gap-sm">
            <IconButton
              accessibilityLabel="Add image"
              accessibilityHint="Opens the existing photo library to select one image"
              disabled={isSending || imageDraft !== null}
              onPress={(): void => {
                void onPickImage();
              }}
              size="md"
              variant="default"
            >
              {ImagePlus ? (
                <ImagePlus size={20} color={Colors[theme].foreground} />
              ) : (
                <Text accessible={false} className="text-lg text-foreground">
                  ＋
                </Text>
              )}
            </IconButton>
            <TextInput
              accessibilityLabel="Message"
              accessibilityHint="Enter a direct message"
              aria-labelledby="direct-chat-composer-label"
              multiline
              maxLength={DIRECT_CHAT_MAX_MESSAGE_LENGTH}
              value={draftText}
              onChangeText={setDraftText}
              editable={!isSending}
              placeholder="Write a message"
              placeholderTextColor={Colors[theme]['muted-foreground']}
              className="max-h-32 min-h-touch flex-1 rounded-lg border border-input bg-background px-md py-sm text-body-md text-foreground"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={imageDraft ? 'Send image' : 'Send message'}
              accessibilityHint={imageDraft ? 'Sends the selected image as a separate chat message' : undefined}
              accessibilityState={{ disabled: sendDisabled, busy: isSending }}
              disabled={sendDisabled}
              onPress={(): void => {
                if (imageDraft) {
                  if (imageDraft.status === 'retryable-failure') {
                    void onRetryImage();
                  } else if (imageDraft.status === 'ready') {
                    void onSendImage();
                  }
                  return;
                }
                const content: string = draftText;
                setDraftText('');
                void onSend(content);
              }}
              className="h-touch w-touch items-center justify-center rounded-full bg-primary disabled:opacity-50"
            >
              {isSending ? (
                <ActivityIndicator color={Colors[theme]['primary-foreground']} />
              ) : (
                <Send size={18} color={Colors[theme]['primary-foreground']} />
              )}
            </Pressable>
          </View>
          <Text className="mt-xs text-right text-label-sm text-muted-foreground">
            {draftText.length}/{DIRECT_CHAT_MAX_MESSAGE_LENGTH}
          </Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
