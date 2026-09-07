import type { ImageErrorEventData } from 'expo-image';
import { Image } from 'expo-image';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Text } from '@/components/common/Text';
import type { ChatImageDraft, ChatMessageMedia } from '@/types/chat.types';
import { getChatImageErrorCode, getChatImageErrorMessage } from '@/utils/chat-image';

/** Maximum width and height of a rendered chat image bubble in points. */
export const CHAT_IMAGE_BUBBLE_MAX_SIZE: number = 260;

/** Dimensions used to preserve an image's aspect ratio inside a bounded bubble. */
export interface ChatImageDimensions {
  width: number;
  height: number;
}

/** Props for the local image preview in the composer. */
export interface ChatImagePreviewProps {
  draft: ChatImageDraft;
  retryAfterSeconds: number | null;
  onRemove: () => void;
  onSend: () => void | Promise<void>;
  onRetry: () => void | Promise<void>;
}

/** Props for one canonical private image message bubble. */
export interface ChatImageBubbleProps {
  media: ChatMessageMedia;
  senderUsername: string;
  reloadToken: number;
  loadFailed: boolean;
  onLoadError: (error: string) => void;
  onRetry: () => void;
}

/**
 * Fits dimensions into the chat bubble bound without changing their aspect ratio.
 *
 * @param width - Source width in pixels
 * @param height - Source height in pixels
 * @param maxSize - Maximum bubble edge in points
 * @returns Bounded display dimensions
 */
export function getBoundedChatImageDimensions(
  width: number,
  height: number,
  maxSize: number = CHAT_IMAGE_BUBBLE_MAX_SIZE,
): ChatImageDimensions {
  const safeWidth: number = width > 0 ? width : 1;
  const safeHeight: number = height > 0 ? height : 1;
  const scale: number = Math.min(1, maxSize / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function getPreviewMessage(draft: ChatImageDraft, retryAfterSeconds: number | null): string {
  if (draft.status === 'ready') return 'Ready to send';
  if (draft.status === 'checking') return 'Checking image…';
  if (draft.status === 'permanent-failure') return "This image can't be sent. Choose a different image.";
  if (getChatImageErrorCode(draft.error ?? new Error()) === 'MEDIA_CAPACITY_EXCEEDED' && retryAfterSeconds !== null) {
    return retryAfterSeconds > 0
      ? `Images are busy. Try again in ${retryAfterSeconds} seconds.`
      : 'Images are busy. Try again now.';
  }
  return getChatImageErrorMessage(draft.error ?? new Error('Image could not be sent.'));
}

/**
 * Renders a removable local image draft and its explicit send/retry state.
 *
 * @param props - Draft state and composer actions
 * @returns Composer preview card
 */
export function ChatImagePreview({
  draft,
  retryAfterSeconds,
  onRemove,
  onSend,
  onRetry,
}: ChatImagePreviewProps): ReactElement {
  const dimensions: ChatImageDimensions = getBoundedChatImageDimensions(draft.asset.width, draft.asset.height);
  const isChecking: boolean = draft.status === 'checking';
  const isRetryable: boolean = draft.status === 'retryable-failure';
  const isRetryBlocked: boolean = (retryAfterSeconds ?? 0) > 0;
  return (
    <Card className="mb-sm flex-row items-center gap-sm">
      <Image
        source={{ uri: draft.asset.uri }}
        style={{ width: dimensions.width, height: dimensions.height }}
        contentFit="cover"
        cachePolicy="memory"
        accessibilityLabel="Image preview"
      />
      <View className="min-w-0 flex-1">
        <Text accessibilityLiveRegion="polite" className="font-inter-semibold text-body-md">
          {getPreviewMessage(draft, retryAfterSeconds)}
        </Text>
        <View className="mt-sm flex-row flex-wrap gap-sm">
          {draft.status === 'ready' && (
            <Button size="sm" onPress={onSend} accessibilityHint="Sends this image as a separate chat message">
              Send image
            </Button>
          )}
          {isRetryable && (
            <Button
              size="sm"
              variant="outline"
              onPress={onRetry}
              disabled={isRetryBlocked}
              accessibilityHint="Retries this image without creating a duplicate message"
            >
              Retry image
            </Button>
          )}
          {!isChecking && (
            <Button size="sm" variant="ghost" onPress={onRemove}>
              Remove image
            </Button>
          )}
        </View>
      </View>
    </Card>
  );
}

/**
 * Renders canonical server dimensions and handles one signed-URL refresh attempt.
 *
 * @param props - Canonical media, sender, and load/retry callbacks
 * @returns Bounded image message surface
 */
export function ChatImageBubble({
  media,
  senderUsername,
  reloadToken,
  loadFailed,
  onLoadError,
  onRetry,
}: ChatImageBubbleProps): ReactElement {
  const dimensions: ChatImageDimensions = getBoundedChatImageDimensions(media.width, media.height);
  const dimensionsLabel: string = `${media.width} by ${media.height} pixels`;
  const imageLabel: string = `Photo sent by ${senderUsername}, ${dimensionsLabel}`;
  return (
    <View className="overflow-hidden rounded-lg border border-border bg-muted">
      {loadFailed ? (
        <View
          className="items-center justify-center p-md"
          style={{ width: dimensions.width, minHeight: dimensions.height }}
        >
          <Text className="mb-sm text-center text-body-md text-muted-foreground">Image unavailable.</Text>
          <Button size="sm" variant="outline" onPress={onRetry}>
            Retry image
          </Button>
        </View>
      ) : (
        <Image
          key={`${media.id}-${reloadToken}`}
          source={{ uri: media.url }}
          style={{ width: dimensions.width, height: dimensions.height }}
          contentFit="cover"
          cachePolicy="memory"
          accessibilityLabel={imageLabel}
          onError={(event: ImageErrorEventData): void => onLoadError(event.error)}
        />
      )}
    </View>
  );
}
