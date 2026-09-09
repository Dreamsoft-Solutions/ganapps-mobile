/** The two request directions exposed by the Friends hub. */
export type FriendRequestDirection = 'incoming' | 'outgoing';

/** Lifecycle states returned by the social graph request endpoints. */
export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'AUTO_ACCEPTED' | 'REJECTED' | 'REVOKED';

/** The current User's server-issued Friend Code. */
export interface FriendCode {
  code: string;
  issuedAt: string;
}

/** Safe User fields returned by lookup, friend, request, and profile endpoints. */
export interface FriendUserSummary {
  userId: string;
  username: string;
  displayName: string;
  displayPicture: string | null;
}

/** Privacy-filtered Ganap activity a friend has made visible. */
export interface FriendGoingItem {
  ganapId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  status: 'GOING';
}

/** Relationship-scoped profile projection; optional fields are friend-only. */
export interface FriendProfile extends FriendUserSummary {
  bio?: string | null;
  interests?: string[];
  going?: FriendGoingItem[];
}

/** One server-owned request attempt and its current cooldown state. */
export interface FriendRequestResult {
  attemptId: string;
  pairId: string;
  status: FriendRequestStatus;
  requesterUserId: string;
  targetUserId: string;
  createdAt: string;
  retryAt: string | null;
  friendshipAcceptedAt?: string;
}

/** Request list item with the direction-appropriate safe User projection. */
export interface FriendRequestItem extends FriendRequestResult {
  user: FriendUserSummary;
}

/** Cursor page used by every paginated Friends endpoint. */
export interface FriendPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** One bounded, session-scoped presence response for the Friends carousel. */
export interface FriendPresenceResponse {
  items: FriendUserSummary[];
  screenSession: string;
}

/** Global visibility preferences for presence and Going data. */
export interface FriendSettings {
  presenceVisibleToFriends: boolean;
  goingVisibleToFriends: boolean;
}

/** Privacy-filtered Going row returned by the Friends feed. */
export interface FriendGoingRecord {
  id: string;
  createdAt: string;
  user: FriendUserSummary;
  ganap: FriendGoingItem;
}
