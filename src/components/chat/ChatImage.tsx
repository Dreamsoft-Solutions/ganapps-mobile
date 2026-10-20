import type { ImageErrorEventData } from 'expo-image';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { type ReactElement, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { ChatImageDraft, ChatMessageMedia } from '@/types/chat.types';

/** Maximum width and height of a rendered chat image bubble in points. */
export const CHAT_IMAGE_BUBBLE_MAX_SIZE: number = 260;

/** Fixed edge length for the selected-image composer thumbnail. */
export const CHAT_IMAGE_THUMBNAIL_SIZE: number = 64;

/** Dimensions used to preserve an image's aspect ratio inside a bounded bubble. */
export interface ChatImageDimensions {
  width: number;
  height: number;
}

/** Props for the local image preview in the composer. */
export interface ChatImagePreviewProps {
  draft: ChatImageDraft;
  onRemove: () => void;
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

/** Props for a private photo viewer that stays inside the current chat. */
export interface ChatImageViewerProps extends ChatImageBubbleProps {
  visible: boolean;
  onClose: () => void;
}

function ViewerContent({
  media,
  senderUsername,
  reloadToken,
  loadFailed,
  onLoadError,
  onRetry,
  onClose,
}: ChatImageViewerProps): ReactElement {
  const theme = useResolvedTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<boolean>(true);
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-md py-sm">
        <Text className="min-w-0 flex-1 text-headline-sm">Photo from {senderUsername}</Text>
        <IconButton accessibilityLabel="Close photo" onPress={onClose}>
          <X size={24} color={Colors[theme].foreground} />
        </IconButton>
      </View>
      <View className="flex-1 items-center justify-center">
        {loadFailed ? (
          <View className="items-center p-md">
            <Text className="mb-sm text-body-md">Image unavailable.</Text>
            <Button onPress={onRetry}>Retry image</Button>
          </View>
        ) : (
          <>
            <Image
              key={`${media.id}-${reloadToken}`}
              source={{ uri: media.url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              cachePolicy="memory"
              accessibilityLabel={`Full photo sent by ${senderUsername}`}
              onLoad={(): void => setLoading(false)}
              onError={(event: ImageErrorEventData): void => {
                setLoading(false);
                onLoadError(event.error);
              }}
            />
            {loading && (
              <ActivityIndicator
                accessibilityLabel="Loading photo"
                style={{ position: 'absolute' }}
                color={Colors[theme].primary}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Renders a dismissible native photo modal using the current signed media URL.
 * @param props - Current canonical media, visibility, and shared load/retry callbacks.
 * @returns Full-screen photo modal, or null when closed.
 */
export function ChatImageViewer(props: ChatImageViewerProps): ReactElement | null {
  const reducedMotion: boolean = useReducedMotion();
  if (!props.visible) return null;
  return (
    <Modal
      testID="chat-photo-viewer"
      visible
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={props.onClose}
      presentationStyle="fullScreen"
    >
      <ViewerContent key={`${props.media.id}-${props.media.url}-${props.reloadToken}`} {...props} />
    </Modal>
  );
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

/**
 * Renders a compact, removable local image draft.
 *
 * @param props - Draft and remove action
 * @returns Fixed-size composer thumbnail
 */
export function ChatImagePreview({ draft, onRemove }: ChatImagePreviewProps): ReactElement {
  const theme = useResolvedTheme();
  const isChecking: boolean = draft.status === 'checking';
  return (
    <View className="mb-sm self-start" style={{ position: 'relative' }}>
      <Image
        source={{ uri: draft.asset.uri }}
        style={{ width: CHAT_IMAGE_THUMBNAIL_SIZE, height: CHAT_IMAGE_THUMBNAIL_SIZE }}
        contentFit="contain"
        cachePolicy="memory"
        accessibilityLabel="Selected image preview"
        className="rounded-lg border border-border bg-muted"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove image"
        accessibilityHint="Removes the selected image"
        accessibilityState={{ disabled: isChecking }}
        disabled={isChecking}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        onPress={onRemove}
        style={{
          position: 'absolute',
          top: -8,
          right: -8,
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors[theme].muted,
        }}
      >
        <X size={16} color={Colors[theme].foreground} />
      </Pressable>
    </View>
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
