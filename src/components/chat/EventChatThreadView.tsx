import { ArrowLeft, ImagePlus, MoreVertical, Send } from 'lucide-react-native';
import { type ReactElement, useCallback, useRef, useState } from 'react';
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
import type { FailedDraft } from '@/hooks/useChat';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { ChatConnectionState } from '@/services/chat-socket.service';
import type { ChatImageDraft, ChatMessage, EventChatSession } from '@/types/chat.types';
import { isChatImageAuthorizationError } from '@/utils/chat-image';

/** Maximum text size accepted by the Event Chat server contract. */
export const CHAT_MAX_MESSAGE_LENGTH = 2_000;

/** Props for the focused Event Chat thread. */
export interface EventChatThreadViewProps {
  session: EventChatSession | null;
  messages: ChatMessage[];
  failedDrafts: FailedDraft[];
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
  /** Current local image draft, if one is selected. */
  imageDraft?: ChatImageDraft | null;
  /** Safe picker/precheck error copy. */
  imagePickerError?: Error | null;
  /** Capacity gate countdown in seconds, when applicable. */
  imageRetryAfterSeconds?: number | null;
  /** Opens the existing-library image picker. */
  onPickImage?: () => void | Promise<void>;
  /** Removes the local image draft without a network request. */
  onRemoveImage?: () => void;
  /** Sends the selected local image. */
  onSendImage?: () => void | Promise<void>;
  /** Retries a retryable image send with the same client message id. */
  onRetryImage?: () => void | Promise<void>;
  /** Refetches canonical history after one signed-URL authorization failure. */
  onRefreshImage?: (messageId: string) => void | Promise<void>;
  /** Opens report/block actions for a message, including the labelled alternative to long press. */
  onMessageActions?: (message: ChatMessage) => void;
  accessLost: boolean;
}

function formatMessageTime(sentAt: string): string {
  const date: Date = new Date(sentAt);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getMessageCopy(message: ChatMessage): string {
  if (message.type === 'IMAGE') return 'Photo';
  if (message.type === 'UNSENT') return 'Message unsent';
  return message.content ?? '';
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

function MessageRow({
  message,
  onMessageActions,
  imageLoadState,
  onImageLoadError,
  onRetryImageLoad,
}: {
  message: ChatMessage;
  onMessageActions: (message: ChatMessage) => void;
  imageLoadState: ImageLoadState;
  onImageLoadError: (messageId: string, error: string) => void;
  onRetryImageLoad: (messageId: string) => void;
}): ReactElement {
  const messageCopy: string = getMessageCopy(message);
  const actionLabel: string = `Message actions for ${message.senderUsername}`;
  const hasImage: boolean = message.type === 'IMAGE' && message.media !== null && message.media !== undefined;
  const media = hasImage ? message.media : null;
  const messageLabel: string = media
    ? `Photo sent by ${message.senderUsername}, ${media.width} by ${media.height} pixels`
    : `${messageCopy} from ${message.senderUsername}`;
  return (
    <View className="mb-md flex-row items-end px-md">
      <Avatar src={message.senderDisplayPicture} name={message.senderUsername} size="xs" />
      <View className="ml-sm min-w-0 max-w-[82%] flex-1 flex-row items-end">
        <View className="min-w-0 flex-1">
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
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-md py-sm active:opacity-70"
          >
            <Text className="font-inter-semibold text-label-md">{message.senderUsername}</Text>
            {media ? (
              <ChatImageBubble
                media={media}
                senderUsername={message.senderUsername}
                reloadToken={imageLoadState.reloadToken}
                loadFailed={imageLoadState.loadFailed}
                onLoadError={(error: string): void => onImageLoadError(message.id, error)}
                onRetry={(): void => onRetryImageLoad(message.id)}
              />
            ) : (
              <Text className="mt-xs text-body-md">{messageCopy}</Text>
            )}
            <Text className="mt-xs text-label-sm text-muted-foreground">{formatMessageTime(message.sentAt)}</Text>
          </Pressable>
        </View>
        <IconButton
          accessibilityLabel={actionLabel}
          accessibilityHint="Opens message reactions and actions"
          onPress={(): void => onMessageActions(message)}
          size="md"
        >
          <MoreVertical size={18} className="text-muted-foreground" />
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
  draft: FailedDraft;
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
 * Presents newest messages at the bottom and keeps failed sends explicit.
 * There is intentionally no Seen label or per-message read indicator.
 *
 * @param props - Session, history, composer, and navigation callbacks
 * @returns Keyboard-safe Event Chat thread
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The thread intentionally branches across guarded, loading, read-only, and composer states.
export function EventChatThreadView({
  session,
  messages,
  failedDrafts,
  isLoading,
  error,
  isSending,
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
}: EventChatThreadViewProps): ReactElement {
  const theme = useResolvedTheme();
  const insets = useSafeAreaInsets();
  const [draftText, setDraftText] = useState('');
  const [imageLoadStates, setImageLoadStates] = useState<Record<string, ImageLoadState>>({});
  const imageRefreshIds = useRef<Set<string>>(new Set<string>());
  const isReadOnly: boolean = Boolean(session?.canRead && !session.canSend);

  const handleImageLoadError = useCallback(
    (messageId: string, error: string): void => {
      const current: ImageLoadState = imageLoadStates[messageId] ?? INITIAL_IMAGE_LOAD_STATE;
      if (
        !current.refreshRequested &&
        !imageRefreshIds.current.has(messageId) &&
        isChatImageAuthorizationError(error)
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
              return {
                ...states,
                [messageId]: { ...latest, refreshRequested: true, loadFailed: true },
              };
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
          Event Chat access is no longer available
        </Text>
        <Text className="mb-lg text-center text-body-md text-muted-foreground">
          Event Details shows the current registration status for this event.
        </Text>
        <Button variant="outline" onPress={onBack}>
          Back to Event Details
        </Button>
      </View>
    );
  }

  if (isLoading && messages.length === 0) return <Loading message="Loading event chat" />;
  if (error && messages.length === 0) return <ErrorView error={error} onRetry={(): void => void onRetry()} />;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? Spacing.lg : 0}
    >
      <View
        className="flex-row items-center border-b border-border px-md pb-sm"
        style={{ paddingTop: insets.top + Spacing.sm }}
      >
        <IconButton accessibilityLabel="Go back" accessibilityHint="Returns to Event Details" onPress={onBack}>
          <ArrowLeft size={20} color={Colors[theme].foreground} />
        </IconButton>
        <Text className="ml-sm flex-1 font-inter-bold text-headline-sm" numberOfLines={1} accessibilityRole="header">
          {session?.ganapId ? 'Event Chat' : 'Event Chat'}
        </Text>
      </View>

      {connectionState !== 'connected' && messages.length > 0 && (
        <View className="border-b border-border bg-muted px-md py-xs">
          <Text className="text-center text-label-md text-muted-foreground">Reconnecting to Event Chat…</Text>
        </View>
      )}

      <FlatList
        data={messages}
        inverted
        keyExtractor={(message: ChatMessage): string => message.id}
        renderItem={({ item }: { item: ChatMessage }): ReactElement => (
          <MessageRow
            message={item}
            onMessageActions={onMessageActions}
            imageLoadState={imageLoadStates[item.id] ?? INITIAL_IMAGE_LOAD_STATE}
            onImageLoadError={handleImageLoadError}
            onRetryImageLoad={handleRetryImageLoad}
          />
        )}
        ListEmptyComponent={<Empty message="No messages yet. Start the conversation." />}
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
            (draft: FailedDraft): ReactElement => (
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
        <View className="border-t border-border px-md py-md">
          <Text className="text-center text-body-md text-muted-foreground">
            You can read this chat, but you cannot send messages.
          </Text>
        </View>
      ) : session?.canSend ? (
        <View className="border-t border-border px-md pt-sm" style={{ paddingBottom: insets.bottom + Spacing.sm }}>
          {imagePickerError && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="mb-sm text-body-md text-destructive">
              {imagePickerError.message}
            </Text>
          )}
          {imageDraft && (
            <ChatImagePreview
              draft={imageDraft}
              retryAfterSeconds={imageRetryAfterSeconds}
              onRemove={onRemoveImage}
              onSend={onSendImage}
              onRetry={onRetryImage}
            />
          )}
          <Text nativeID="event-chat-composer-label" className="mb-xs font-inter-semibold text-label-md">
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
              accessibilityHint="Enter a text message"
              aria-labelledby="event-chat-composer-label"
              multiline
              maxLength={CHAT_MAX_MESSAGE_LENGTH}
              value={draftText}
              onChangeText={setDraftText}
              editable={!isSending}
              placeholder="Write a message"
              placeholderTextColor={Colors[theme]['muted-foreground']}
              className="max-h-32 min-h-12 flex-1 rounded-lg border border-input bg-background px-md py-sm text-body-md text-foreground"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: isSending || draftText.trim().length === 0, busy: isSending }}
              disabled={isSending || draftText.trim().length === 0}
              onPress={(): void => {
                const content: string = draftText;
                setDraftText('');
                void onSend(content);
              }}
              className="h-12 w-12 items-center justify-center rounded-full bg-primary disabled:opacity-50"
            >
              {isSending ? (
                <ActivityIndicator color={Colors[theme]['primary-foreground']} />
              ) : (
                <Send size={18} color={Colors[theme]['primary-foreground']} />
              )}
            </Pressable>
          </View>
          <Text className="mt-xs text-right text-label-sm text-muted-foreground">
            {draftText.length}/{CHAT_MAX_MESSAGE_LENGTH}
          </Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
