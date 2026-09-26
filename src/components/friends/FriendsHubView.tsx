import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ChevronRight, MessageCircle, Settings, Share2, UserPlus, Users, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { IconButton } from '@/components/common/IconButton';
import { Loading } from '@/components/common/Loading';
import { SegmentControl } from '@/components/common/SegmentControl';
import { Text } from '@/components/common/Text';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { ChatConversationSummary } from '@/types/chat.types';
import type {
  FriendCode,
  FriendRequestDirection,
  FriendRequestItem,
  FriendRequestResult,
  FriendUserSummary,
} from '@/types/friends.types';
import { formatFriendCode, getFriendErrorMessage } from '@/utils/friends';

/** Top-level segment names rendered by the Friends hub. */
export type FriendsHubViewSegment = 'chats' | 'friends' | 'requests';

/** Props for the server-backed Friends hub surface. */
export interface FriendsHubViewProps {
  segment: FriendsHubViewSegment;
  requestDirection: FriendRequestDirection;
  summaries: ChatConversationSummary[];
  friends: FriendUserSummary[];
  presence: FriendUserSummary[];
  requests: FriendRequestItem[];
  outgoingRequests: FriendRequestItem[];
  isLoadingOutgoingRequests: boolean;
  isLoading: boolean;
  error: Error | null;
  isRefreshing: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isCodeOpen: boolean;
  codeQuery: UseQueryResult<FriendCode, Error>;
  isRegeneratingCode: boolean;
  isAddFriendOpen: boolean;
  lookupMutation: UseMutationResult<FriendUserSummary, Error, string>;
  createRequestMutation: UseMutationResult<FriendRequestResult, Error, string>;
  requestNotice: string | null;
  isRequestActionPending: boolean;
  onSegmentChange: (segment: FriendsHubViewSegment) => void;
  onRequestDirectionChange: (direction: FriendRequestDirection) => void;
  onOpenSummary: (summary: ChatConversationSummary) => void;
  onOpenProfile: (userId: string) => void;
  onOpenSettings: () => void;
  onOpenCode: () => void;
  onCloseCode: () => void;
  onRegenerateCode: () => void | Promise<void>;
  onShareCode: (code: string) => void | Promise<void>;
  onOpenAddFriend: () => void;
  onCloseAddFriend: () => void;
  onLookup: (code: string) => void | Promise<void>;
  onSendRequest: (code: string) => void | Promise<void>;
  onAcceptRequest: (attemptId: string) => void | Promise<void>;
  onRejectRequest: (attemptId: string) => void | Promise<void>;
  onRevokeRequest: (attemptId: string) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onRetry: () => void | Promise<void>;
  onLoadMore: () => void | Promise<void>;
}

function formatChatTime(value: string | null): string {
  if (!value) return 'No messages yet';
  const date: Date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function summaryPreview(summary: ChatConversationSummary): string {
  if (!summary.lastMessage) return 'No messages yet';
  if (summary.lastMessage.type === 'IMAGE') return 'Photo';
  if (summary.lastMessage.type === 'UNSENT') return 'Message unsent';
  return summary.lastMessage.preview;
}

function summaryTitle(summary: ChatConversationSummary): string {
  return summary.type === 'EVENT' ? summary.title : summary.friend.displayName;
}

function summaryKind(summary: ChatConversationSummary): string {
  return summary.type === 'EVENT' ? 'Event chat' : 'Direct chat';
}

function ChatSummaryRow({ summary, onOpen }: { summary: ChatConversationSummary; onOpen: () => void }): ReactElement {
  const theme = useResolvedTheme();
  const title: string = summaryTitle(summary);
  const kind: string = summaryKind(summary);
  const unreadLabel: string = summary.unreadCount > 0 ? `, ${summary.unreadCount} unread` : '';
  const preview: string = summaryPreview(summary);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${kind}: ${title}${unreadLabel}`}
      onPress={onOpen}
      className="active:opacity-70"
    >
      <Card className="mb-sm flex-row items-center">
        <Avatar src={summary.type === 'DIRECT' ? summary.friend.displayPicture : null} name={title} size="sm" />
        <View className="ml-sm min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-sm">
            <Text className="min-w-0 flex-1 font-inter-semibold text-body-lg" numberOfLines={1}>
              {title}
            </Text>
            {summary.lastMessage && (
              <Text className="text-label-sm text-muted-foreground">{formatChatTime(summary.lastMessage.sentAt)}</Text>
            )}
          </View>
          <Text className="mt-xs text-label-sm text-muted-foreground">{kind}</Text>
          <Text className="mt-xs min-w-0 flex-1 text-body-md text-muted-foreground" numberOfLines={2}>
            {preview}
          </Text>
        </View>
        {summary.unreadCount > 0 && (
          <View className="ml-sm min-w-7 items-center rounded-full bg-primary px-sm py-xs">
            <Text className="font-inter-semibold text-label-sm text-primary-foreground">
              {summary.unreadCount > 99 ? '99+' : String(summary.unreadCount)}
            </Text>
          </View>
        )}
        <MessageCircle className="ml-sm" size={16} color={Colors[theme].primary} />
      </Card>
    </Pressable>
  );
}

function FriendRow({ friend, onOpen }: { friend: FriendUserSummary; onOpen: () => void }): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open profile for ${friend.displayName}`}
      onPress={onOpen}
      className="active:opacity-70"
    >
      <Card className="mb-sm flex-row items-center">
        <Avatar src={friend.displayPicture} name={friend.displayName} size="sm" />
        <View className="ml-sm min-w-0 flex-1">
          <Text className="font-inter-semibold text-body-lg" numberOfLines={1}>
            {friend.displayName}
          </Text>
          <Text className="text-body-md text-muted-foreground" numberOfLines={1}>
            @{friend.username}
          </Text>
        </View>
        <ChevronRight
          size={20}
          color={useResolvedTheme() === 'dark' ? Colors.dark['muted-foreground'] : Colors.light['muted-foreground']}
        />
      </Card>
    </Pressable>
  );
}

function RequestRow({
  request,
  direction,
  isPending,
  onOpenProfile,
  onAccept,
  onReject,
  onRevoke,
}: {
  request: FriendRequestItem;
  direction: FriendRequestDirection;
  isPending: boolean;
  onOpenProfile: () => void;
  onAccept: () => void;
  onReject: () => void;
  onRevoke: () => void;
}): ReactElement {
  return (
    <Card className="mb-sm">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open profile for ${request.user.displayName}`}
        onPress={onOpenProfile}
        className="flex-row items-center active:opacity-70"
      >
        <Avatar src={request.user.displayPicture} name={request.user.displayName} size="sm" />
        <View className="ml-sm min-w-0 flex-1">
          <Text className="font-inter-semibold text-body-lg" numberOfLines={1}>
            {request.user.displayName}
          </Text>
          <Text className="text-body-md text-muted-foreground" numberOfLines={1}>
            @{request.user.username}
          </Text>
          <Text className="mt-xs text-label-sm text-muted-foreground">Status: {request.status}</Text>
        </View>
      </Pressable>
      {direction === 'incoming' ? (
        <View className="mt-sm flex-row gap-sm">
          <Button
            size="sm"
            disabled={isPending}
            loading={isPending}
            onPress={onAccept}
            accessibilityHint="Accepts this incoming friend request"
          >
            Accept friend request
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onPress={onReject}
            accessibilityHint="Rejects this incoming friend request"
          >
            Reject friend request
          </Button>
        </View>
      ) : (
        <View className="mt-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            loading={isPending}
            onPress={onRevoke}
            accessibilityHint="Revokes this outgoing friend request"
          >
            Revoke friend request
          </Button>
        </View>
      )}
    </Card>
  );
}

function ActiveFriends({
  friends,
  onOpenProfile,
}: {
  friends: FriendUserSummary[];
  onOpenProfile: (id: string) => void;
}): ReactElement {
  return (
    <View className="mb-md">
      <View className="mb-sm flex-row items-center">
        <Users size={18} className="text-primary" />
        <Text className="ml-sm font-inter-semibold text-headline-sm">Active friends</Text>
      </View>
      {friends.length === 0 ? (
        <Text className="text-body-md text-muted-foreground">No friends are active right now.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-md">
          {friends.map(
            (friend: FriendUserSummary): ReactElement => (
              <Pressable
                key={friend.userId}
                accessibilityRole="button"
                accessibilityLabel={`Open active friend ${friend.displayName}`}
                onPress={(): void => onOpenProfile(friend.userId)}
                className="w-20 items-center active:opacity-70"
              >
                <Avatar src={friend.displayPicture} name={friend.displayName} size="md" />
                <Text className="mt-xs text-center text-label-sm" numberOfLines={2}>
                  {friend.displayName}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}

function CodeModal({
  visible,
  query,
  isRegenerating,
  onClose,
  onRegenerate,
  onShare,
}: {
  visible: boolean;
  query: UseQueryResult<FriendCode, Error>;
  isRegenerating: boolean;
  onClose: () => void;
  onRegenerate: () => void | Promise<void>;
  onShare: (code: string) => void | Promise<void>;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const code: string | null = query.data?.code ?? null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background px-md" style={{ paddingTop: insets.top + Spacing.md }}>
        <View className="mb-lg flex-row items-center justify-between">
          <Text className="font-inter-bold text-headline-md" accessibilityRole="header">
            My Code
          </Text>
          <IconButton accessibilityLabel="Close My Code" onPress={onClose}>
            <X size={20} />
          </IconButton>
        </View>
        {query.isLoading ? (
          <Loading message="Loading your Friend Code" />
        ) : query.error ? (
          <ErrorView
            error={new Error(getFriendErrorMessage(query.error, 'Unable to load your Friend Code.'))}
            onRetry={(): void => void query.refetch()}
          />
        ) : code ? (
          <Card>
            <Text className="text-center text-label-md uppercase tracking-widest text-muted-foreground">
              Share this code
            </Text>
            <Text
              className="mt-md text-center font-inter-bold text-headline-lg"
              accessibilityLabel={`Friend Code ${formatFriendCode(code)}`}
            >
              {formatFriendCode(code)}
            </Text>
            <View className="mt-lg gap-sm">
              <Button variant="outline" onPress={(): void => void onShare(code)} leftIcon={<Share2 size={17} />}>
                Share code
              </Button>
              <Button variant="secondary" loading={isRegenerating} disabled={isRegenerating} onPress={onRegenerate}>
                Regenerate code
              </Button>
            </View>
          </Card>
        ) : (
          <Empty message="Your Friend Code is unavailable." />
        )}
      </View>
    </Modal>
  );
}

function AddFriendModal({
  visible,
  lookupMutation,
  createRequestMutation,
  outgoingRequests,
  isLoadingOutgoingRequests,
  requestNotice,
  onClose,
  onLookup,
  onSendRequest,
  onOpenProfile,
}: {
  visible: boolean;
  lookupMutation: UseMutationResult<FriendUserSummary, Error, string>;
  createRequestMutation: UseMutationResult<FriendRequestResult, Error, string>;
  outgoingRequests: FriendRequestItem[];
  isLoadingOutgoingRequests: boolean;
  requestNotice: string | null;
  onClose: () => void;
  onLookup: (code: string) => void | Promise<void>;
  onSendRequest: (code: string) => void | Promise<void>;
  onOpenProfile: (userId: string) => void;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const [code, setCode] = useState<string>('');
  const target: FriendUserSummary | undefined = lookupMutation.data;
  const error: Error | null = lookupMutation.error ?? createRequestMutation.error ?? null;
  const normalizedCode: string = code.trim().replace(/[\s-]/g, '').toUpperCase();
  const sentRequestForTarget: boolean = Boolean(
    target &&
      (outgoingRequests.some(
        (request: FriendRequestItem): boolean => request.targetUserId === target.userId && request.status === 'PENDING',
      ) ||
        (createRequestMutation.data?.targetUserId === target.userId &&
          createRequestMutation.data.status === 'PENDING')),
  );
  const acceptedRequestForTarget: boolean = Boolean(
    target &&
      createRequestMutation.data?.targetUserId === target.userId &&
      (createRequestMutation.data.status === 'ACCEPTED' || createRequestMutation.data.status === 'AUTO_ACCEPTED'),
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}
          keyboardShouldPersistTaps="handled"
          className="flex-1 px-md"
        >
          <View className="mb-lg flex-row items-center justify-between">
            <Text className="font-inter-bold text-headline-md" accessibilityRole="header">
              Add Friend
            </Text>
            <IconButton accessibilityLabel="Close Add Friend" onPress={onClose}>
              <X size={20} />
            </IconButton>
          </View>
          <Text className="mb-sm text-body-md text-muted-foreground">Enter a 12-character Friend Code.</Text>
          <TextInput
            accessibilityLabel="Friend Code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={14}
            placeholder="XXXX XXXX XXXX"
            placeholderTextColor={Colors[theme]['muted-foreground']}
            className="rounded-lg border border-input bg-background px-md py-3 text-body-lg text-foreground"
          />
          <View className="mt-sm">
            <Button
              variant="outline"
              disabled={normalizedCode.length === 0 || lookupMutation.isPending}
              loading={lookupMutation.isPending}
              onPress={(): void => void onLookup(code)}
            >
              Find friend
            </Button>
          </View>
          {error && (
            <Text accessibilityLiveRegion="polite" className="mt-md text-body-md text-destructive">
              {getFriendErrorMessage(error, 'Unable to look up this Friend Code.')}
            </Text>
          )}
          {target && (
            <Card className="mt-lg">
              <Text className="mb-sm text-label-md uppercase tracking-widest text-muted-foreground">
                Safe profile preview
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open profile for ${target.displayName}`}
                onPress={(): void => onOpenProfile(target.userId)}
                className="flex-row items-center active:opacity-70"
              >
                <Avatar src={target.displayPicture} name={target.displayName} size="md" />
                <View className="ml-md min-w-0 flex-1">
                  <Text className="font-inter-semibold text-body-lg" numberOfLines={1}>
                    {target.displayName}
                  </Text>
                  <Text className="text-body-md text-muted-foreground" numberOfLines={1}>
                    @{target.username}
                  </Text>
                </View>
                <ChevronRight size={20} className="text-muted-foreground" />
              </Pressable>
              <View className="mt-lg">
                <Button
                  disabled={
                    isLoadingOutgoingRequests ||
                    createRequestMutation.isPending ||
                    sentRequestForTarget ||
                    acceptedRequestForTarget
                  }
                  loading={createRequestMutation.isPending}
                  onPress={(): void => void onSendRequest(normalizedCode)}
                  leftIcon={<UserPlus size={17} />}
                >
                  {sentRequestForTarget
                    ? 'Friend request sent'
                    : acceptedRequestForTarget
                      ? 'Friend request accepted'
                      : 'Send friend request'}
                </Button>
              </View>
            </Card>
          )}
          {requestNotice && (
            <Text accessibilityLiveRegion="polite" className="mt-md text-body-md text-primary">
              {requestNotice}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface SegmentContentProps {
  segment: FriendsHubViewSegment;
  requestDirection: FriendRequestDirection;
  summaries: ChatConversationSummary[];
  friends: FriendUserSummary[];
  requests: FriendRequestItem[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onOpenSummary: (summary: ChatConversationSummary) => void;
  onOpenProfile: (userId: string) => void;
  onRequestDirectionChange: (direction: FriendRequestDirection) => void;
  onAcceptRequest: (attemptId: string) => void;
  onRejectRequest: (attemptId: string) => void;
  onRevokeRequest: (attemptId: string) => void;
  onRetry: () => void | Promise<void>;
  onLoadMore: () => void | Promise<void>;
  requestMutationPending: boolean;
}

function getSegmentItemCount({ segment, summaries, friends, requests }: SegmentContentProps): number {
  switch (segment) {
    case 'chats':
      return summaries.length;
    case 'friends':
      return friends.length;
    case 'requests':
      return requests.length;
  }
}

function getSegmentLoadingMessage(segment: FriendsHubViewSegment): string {
  switch (segment) {
    case 'chats':
      return 'Loading chats';
    case 'friends':
      return 'Loading friends';
    case 'requests':
      return 'Loading requests';
  }
}

function RequestSegment({
  requestDirection,
  requests,
  onOpenProfile,
  onRequestDirectionChange,
  onAcceptRequest,
  onRejectRequest,
  onRevokeRequest,
  requestMutationPending,
}: Pick<
  SegmentContentProps,
  | 'requestDirection'
  | 'requests'
  | 'onOpenProfile'
  | 'onRequestDirectionChange'
  | 'onAcceptRequest'
  | 'onRejectRequest'
  | 'onRevokeRequest'
  | 'requestMutationPending'
>): ReactElement {
  const emptyMessage: string =
    requestDirection === 'incoming' ? 'No incoming friend requests.' : 'No outgoing friend requests.';
  return (
    <View>
      <SegmentControl
        label="Friend request direction"
        value={requestDirection}
        options={[
          { value: 'incoming', label: 'Incoming' },
          { value: 'outgoing', label: 'Outgoing' },
        ]}
        onChange={(value: FriendRequestDirection): void => onRequestDirectionChange(value)}
      />
      {requests.length === 0 ? (
        <Empty message={emptyMessage} />
      ) : (
        requests.map(
          (request: FriendRequestItem): ReactElement => (
            <RequestRow
              key={request.attemptId}
              request={request}
              direction={requestDirection}
              isPending={requestMutationPending}
              onOpenProfile={(): void => onOpenProfile(request.user.userId)}
              onAccept={(): void => onAcceptRequest(request.attemptId)}
              onReject={(): void => onRejectRequest(request.attemptId)}
              onRevoke={(): void => onRevokeRequest(request.attemptId)}
            />
          ),
        )
      )}
    </View>
  );
}

function FriendsSegment({
  friends,
  onOpenProfile,
}: Pick<SegmentContentProps, 'friends' | 'onOpenProfile'>): ReactElement {
  if (friends.length === 0) return <Empty message="You have no friends yet." />;
  return (
    <View>
      {friends.map(
        (friend: FriendUserSummary): ReactElement => (
          <FriendRow key={friend.userId} friend={friend} onOpen={(): void => onOpenProfile(friend.userId)} />
        ),
      )}
    </View>
  );
}

function ChatSegment({
  summaries,
  hasNextPage,
  isFetchingNextPage,
  onOpenSummary,
  onLoadMore,
}: Pick<
  SegmentContentProps,
  'summaries' | 'hasNextPage' | 'isFetchingNextPage' | 'onOpenSummary' | 'onLoadMore'
>): ReactElement {
  if (summaries.length === 0) return <Empty message="No chats yet." />;
  return (
    <View>
      {summaries.map(
        (summary: ChatConversationSummary): ReactElement => (
          <ChatSummaryRow key={summary.conversationId} summary={summary} onOpen={(): void => onOpenSummary(summary)} />
        ),
      )}
      {hasNextPage && (
        <Button variant="outline" loading={isFetchingNextPage} disabled={isFetchingNextPage} onPress={onLoadMore}>
          Load more chats
        </Button>
      )}
    </View>
  );
}

function SegmentContent(props: SegmentContentProps): ReactElement {
  const itemCount: number = getSegmentItemCount(props);
  if (props.isLoading && itemCount === 0) {
    return <Loading message={getSegmentLoadingMessage(props.segment)} />;
  }
  if (props.error && itemCount === 0) {
    return <ErrorView error={props.error} onRetry={(): void => void props.onRetry()} />;
  }
  switch (props.segment) {
    case 'requests':
      return <RequestSegment {...props} />;
    case 'friends':
      return <FriendsSegment {...props} />;
    case 'chats':
      return <ChatSegment {...props} />;
  }
}

/**
 * Renders the four-tab Friends surface with server-owned feeds and lazy social modals.
 *
 * @param props - Query data and route-owned actions
 * @returns Safe-area Friends hub with Chats, Friends, and Requests segments
 */
export function FriendsHubView({
  segment,
  requestDirection,
  summaries,
  friends,
  presence,
  requests,
  outgoingRequests,
  isLoadingOutgoingRequests,
  isLoading,
  error,
  isRefreshing,
  hasNextPage,
  isFetchingNextPage,
  isCodeOpen,
  codeQuery,
  isAddFriendOpen,
  lookupMutation,
  createRequestMutation,
  requestNotice,
  onSegmentChange,
  onRequestDirectionChange,
  onOpenSummary,
  onOpenProfile,
  isRegeneratingCode,
  isRequestActionPending,
  onOpenSettings,
  onOpenCode,
  onCloseCode,
  onRegenerateCode,
  onShareCode,
  onOpenAddFriend,
  onCloseAddFriend,
  onLookup,
  onSendRequest,
  onAcceptRequest,
  onRejectRequest,
  onRevokeRequest,
  onRefresh,
  onRetry,
  onLoadMore,
}: FriendsHubViewProps): ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-md"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={(): void => void onRefresh()} />}
        contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}
      >
        <View className="mb-lg flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Users size={22} color={Colors[theme].primary} />
            <Text className="ml-sm font-inter-bold text-headline-md" accessibilityRole="header">
              Friends
            </Text>
          </View>
          <IconButton accessibilityLabel="Open Friends privacy settings" onPress={onOpenSettings}>
            <Settings size={20} color={Colors[theme]['muted-foreground']} />
          </IconButton>
        </View>
        <View className="mb-lg flex-row gap-sm">
          <Button size="sm" variant="outline" onPress={onOpenAddFriend} leftIcon={<UserPlus size={16} />}>
            Add Friend
          </Button>
          <Button size="sm" variant="secondary" onPress={onOpenCode} leftIcon={<Users size={16} />}>
            My Code
          </Button>
        </View>
        <ActiveFriends friends={presence} onOpenProfile={onOpenProfile} />
        <SegmentControl
          label="Friends hub section"
          value={segment}
          options={[
            { value: 'chats', label: 'Chats' },
            { value: 'friends', label: 'Friends' },
            { value: 'requests', label: 'Requests' },
          ]}
          onChange={(value: FriendsHubViewSegment): void => onSegmentChange(value)}
        />
        <SegmentContent
          segment={segment}
          requestDirection={requestDirection}
          summaries={summaries}
          friends={friends}
          requests={requests}
          isLoading={isLoading}
          error={error}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onOpenSummary={onOpenSummary}
          onOpenProfile={onOpenProfile}
          onRequestDirectionChange={onRequestDirectionChange}
          onAcceptRequest={onAcceptRequest}
          onRejectRequest={onRejectRequest}
          onRevokeRequest={onRevokeRequest}
          onRetry={onRetry}
          onLoadMore={onLoadMore}
          requestMutationPending={isRequestActionPending}
        />
        {requestNotice && !isAddFriendOpen && (
          <Text accessibilityLiveRegion="polite" className="mt-md text-body-md text-primary">
            {requestNotice}
          </Text>
        )}
        <CodeModal
          visible={isCodeOpen}
          query={codeQuery}
          isRegenerating={isRegeneratingCode}
          onClose={onCloseCode}
          onRegenerate={onRegenerateCode}
          onShare={onShareCode}
        />
        <AddFriendModal
          visible={isAddFriendOpen}
          lookupMutation={lookupMutation}
          createRequestMutation={createRequestMutation}
          outgoingRequests={outgoingRequests}
          isLoadingOutgoingRequests={isLoadingOutgoingRequests}
          requestNotice={requestNotice}
          onClose={onCloseAddFriend}
          onLookup={onLookup}
          onSendRequest={onSendRequest}
          onOpenProfile={onOpenProfile}
        />
      </ScrollView>
    </View>
  );
}
