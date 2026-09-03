import type { ChatMessage, ReactionAggregate, ReactionType } from '@/types/chat.types';
import axiosInstance from '../axios-instance';

/** Request body for selecting one supported reaction. */
export interface SetReactionInput {
  reaction: ReactionType;
}

/** Server response returned when a message is unsent. */
export interface UnsentMessageResponse
  extends Pick<
    ChatMessage,
    'id' | 'conversationId' | 'senderId' | 'senderUsername' | 'senderDisplayPicture' | 'sentAt'
  > {
  type: 'UNSENT';
  content: null;
  media: null;
  unsentAt: string;
  alreadyUnsent: boolean;
}

/** Acknowledgement aggregate returned by the announcement endpoints. */
export interface AnnouncementReactionResponse extends ReactionAggregate {
  announcementId?: string;
  messageId?: string;
}

/** Typed message and announcement engagement endpoints. */
export const chatEngagementAPI = {
  /** Sets or replaces the current User's message reaction. */
  setMessageReaction: (
    conversationId: string,
    messageId: string,
    input: SetReactionInput,
  ): Promise<ReactionAggregate> =>
    axiosInstance
      .put<ReactionAggregate>(`/conversations/${conversationId}/messages/${messageId}/reaction`, input)
      .then((response) => response.data),

  /** Removes the current User's message reaction idempotently. */
  deleteMessageReaction: (conversationId: string, messageId: string): Promise<ReactionAggregate> =>
    axiosInstance
      .delete<ReactionAggregate>(`/conversations/${conversationId}/messages/${messageId}/reaction`)
      .then((response) => response.data),

  /** Un-sends one owned text or image message for everyone. */
  unsendMessage: (conversationId: string, messageId: string): Promise<UnsentMessageResponse> =>
    axiosInstance
      .delete<UnsentMessageResponse>(`/conversations/${conversationId}/messages/${messageId}`)
      .then((response) => response.data),

  /** Sets or replaces an attendee announcement acknowledgement. */
  setAnnouncementReaction: (
    ganapId: string,
    announcementId: string,
    input: SetReactionInput,
  ): Promise<AnnouncementReactionResponse> =>
    axiosInstance
      .put<AnnouncementReactionResponse>(`/ganaps/${ganapId}/announcements/${announcementId}/reaction`, input)
      .then((response) => response.data),

  /** Removes an attendee announcement acknowledgement idempotently. */
  deleteAnnouncementReaction: (ganapId: string, announcementId: string): Promise<AnnouncementReactionResponse> =>
    axiosInstance
      .delete<AnnouncementReactionResponse>(`/ganaps/${ganapId}/announcements/${announcementId}/reaction`)
      .then((response) => response.data),

  /** Reads the current attendee announcement acknowledgement aggregate. */
  getAnnouncementReaction: (ganapId: string, announcementId: string): Promise<AnnouncementReactionResponse> =>
    axiosInstance
      .get<AnnouncementReactionResponse>(`/ganaps/${ganapId}/announcements/${announcementId}/reactions`)
      .then((response) => response.data),
};
