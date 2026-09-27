import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Alert, Share } from 'react-native';
import { FriendsHubView } from '@/components/friends/FriendsHubView';
import { Routes } from '@/constants/routes';
import { type FriendsHubSegment, useFriends } from '@/hooks/useFriends';
import type { ChatConversationSummary } from '@/types/chat.types';
import type { FriendRequestDirection } from '@/types/friends.types';
import {
  formatFriendCode,
  formatFriendRetryWarning,
  getFriendErrorMessage,
  isValidFriendCode,
  normalizeFriendCode,
} from '@/utils/friends';
import { buildFriendShareUrl } from '@/utils/share-links';

/**
 * Friends and Chat hub.
 *
 * The list is intentionally server-owned: it never fabricates rows from Ganap
 * details and never fetches history for each row.
 *
 * @returns The Friends and Chat screen.
 */
export default function ChatScreen(): ReactElement {
  const router = useRouter();
  const { friendCode: rawFriendCode } = useLocalSearchParams<{ friendCode?: string | string[] }>();
  const friendCode: string | undefined =
    typeof rawFriendCode === 'string' && isValidFriendCode(rawFriendCode)
      ? normalizeFriendCode(rawFriendCode)
      : undefined;
  const [segment, setSegment] = useState<FriendsHubSegment>('chats');
  const [requestDirection, setRequestDirection] = useState<FriendRequestDirection>('incoming');
  const [isCodeOpen, setIsCodeOpen] = useState<boolean>(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState<boolean>(friendCode !== undefined);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const friends = useFriends({ segment, requestDirection, codeOpen: isCodeOpen, addFriendOpen: isAddFriendOpen });

  useEffect((): void => {
    if (friendCode !== undefined) {
      setRequestNotice(null);
      setIsAddFriendOpen(true);
    }
  }, [friendCode]);

  const handleOpenCode = (): void => {
    setRequestNotice(null);
    setIsCodeOpen(true);
  };

  const handleCloseCode = (): void => {
    setIsCodeOpen(false);
  };

  const handleRegenerateCode = (): void => {
    Alert.alert('Regenerate Friend Code', 'Your current code will stop working immediately. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Regenerate',
        style: 'destructive',
        onPress: (): void => {
          void friends.regenerateCodeMutation.mutateAsync().catch((error: unknown): void => {
            const normalized: Error = error instanceof Error ? error : new Error('Unable to regenerate code.');
            setRequestNotice(getFriendErrorMessage(normalized, 'Unable to regenerate your Friend Code.'));
          });
        },
      },
    ]);
  };

  const handleShareCode = async (code: string): Promise<void> => {
    const codeMessage: string = `My Ganapps Friend Code is ${formatFriendCode(code)}.`;
    let message: string = codeMessage;
    try {
      message = `${codeMessage}\n${buildFriendShareUrl(code)}`;
    } catch {
      // The code remains shareable when the public web URL is not configured.
    }
    await Share.share({
      message,
    });
  };

  const handleOpenAddFriend = (): void => {
    friends.lookupMutation.reset();
    friends.createRequestMutation.reset();
    setRequestNotice(null);
    setIsAddFriendOpen(true);
  };

  const handleCloseAddFriend = (): void => {
    setIsAddFriendOpen(false);
  };

  const handleLookup = async (code: string): Promise<void> => {
    setRequestNotice(null);
    try {
      await friends.lookupMutation.mutateAsync(code);
    } catch {
      // The mutation error is rendered inline by the Add Friend modal.
    }
  };

  const handleSendRequest = async (code: string): Promise<void> => {
    try {
      const result = await friends.createRequestMutation.mutateAsync(code);
      setRequestNotice(
        result.status === 'ACCEPTED' || result.status === 'AUTO_ACCEPTED'
          ? 'Friend request accepted.'
          : 'Friend request sent',
      );
    } catch (error: unknown) {
      const normalized: Error = error instanceof Error ? error : new Error('Unable to send friend request.');
      setRequestNotice(getFriendErrorMessage(normalized, 'Unable to send friend request.'));
    }
  };

  const handleAcceptRequest = async (attemptId: string): Promise<void> => {
    try {
      const result = await friends.acceptRequestMutation.mutateAsync(attemptId);
      setRequestNotice(
        result.status === 'ACCEPTED' || result.status === 'AUTO_ACCEPTED'
          ? 'Friend request accepted.'
          : `Request status: ${result.status}.`,
      );
    } catch (error: unknown) {
      const normalized: Error = error instanceof Error ? error : new Error('Unable to accept friend request.');
      setRequestNotice(getFriendErrorMessage(normalized, 'Unable to accept friend request.'));
    }
  };

  const handleRejectRequest = async (attemptId: string): Promise<void> => {
    try {
      await friends.rejectRequestMutation.mutateAsync(attemptId);
      setRequestNotice('Friend request rejected.');
    } catch (error: unknown) {
      const normalized: Error = error instanceof Error ? error : new Error('Unable to reject friend request.');
      setRequestNotice(getFriendErrorMessage(normalized, 'Unable to reject friend request.'));
    }
  };

  const handleRevokeRequest = async (attemptId: string): Promise<void> => {
    try {
      const result = await friends.revokeRequestMutation.mutateAsync(attemptId);
      setRequestNotice(
        result.retryAt
          ? `Friend request revoked. ${formatFriendRetryWarning(result.retryAt)}`
          : 'Friend request revoked.',
      );
    } catch (error: unknown) {
      const normalized: Error = error instanceof Error ? error : new Error('Unable to revoke friend request.');
      setRequestNotice(getFriendErrorMessage(normalized, 'Unable to revoke friend request.'));
    }
  };

  const activeQuery =
    segment === 'chats' ? friends.chatQuery : segment === 'friends' ? friends.friendsQuery : friends.requestsQuery;
  const handleLoadMore = async (): Promise<void> => {
    if (!activeQuery.hasNextPage || activeQuery.isFetchingNextPage) return;
    await activeQuery.fetchNextPage();
  };

  return (
    <FriendsHubView
      segment={segment}
      requestDirection={requestDirection}
      summaries={friends.chatSummaries}
      friends={friends.friends}
      presence={friends.presence}
      requests={friends.requests}
      outgoingRequests={friends.outgoingRequests}
      isLoadingOutgoingRequests={friends.isLoadingOutgoingRequests}
      isLoading={friends.isLoading}
      error={friends.error}
      isRefreshing={activeQuery.isRefetching || friends.presenceQuery.isRefetching}
      hasNextPage={Boolean(activeQuery.hasNextPage)}
      isFetchingNextPage={activeQuery.isFetchingNextPage}
      isCodeOpen={isCodeOpen}
      initialFriendCode={friendCode}
      codeQuery={friends.codeQuery}
      isRegeneratingCode={friends.regenerateCodeMutation.isPending}
      isAddFriendOpen={isAddFriendOpen}
      lookupMutation={friends.lookupMutation}
      createRequestMutation={friends.createRequestMutation}
      requestNotice={requestNotice}
      isRequestActionPending={
        friends.acceptRequestMutation.isPending ||
        friends.rejectRequestMutation.isPending ||
        friends.revokeRequestMutation.isPending
      }
      onSegmentChange={(nextSegment: FriendsHubSegment): void => {
        setSegment(nextSegment);
        setRequestNotice(null);
      }}
      onRequestDirectionChange={(direction: FriendRequestDirection): void => {
        setRequestDirection(direction);
        setRequestNotice(null);
      }}
      onOpenSummary={(summary: ChatConversationSummary): void => {
        if (summary.type === 'EVENT') {
          router.push(Routes.eventChat(summary.ganapId));
          return;
        }
        router.push(Routes.directChat(summary.conversationId));
      }}
      onOpenProfile={(userId: string): void => router.push(Routes.friendProfile(userId))}
      onOpenSettings={(): void => router.push(Routes.friendSettings)}
      onOpenCode={handleOpenCode}
      onCloseCode={handleCloseCode}
      onRegenerateCode={handleRegenerateCode}
      onShareCode={handleShareCode}
      onOpenAddFriend={handleOpenAddFriend}
      onCloseAddFriend={handleCloseAddFriend}
      onLookup={handleLookup}
      onSendRequest={handleSendRequest}
      onAcceptRequest={handleAcceptRequest}
      onRejectRequest={handleRejectRequest}
      onRevokeRequest={handleRevokeRequest}
      onRefresh={friends.refetch}
      onRetry={friends.refetch}
      onLoadMore={handleLoadMore}
    />
  );
}
