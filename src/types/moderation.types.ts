/** Reasons a User may submit for a moderation report. */
export type ModerationReportReason =
  | 'HARASSMENT'
  | 'HATE'
  | 'SEXUAL_CONTENT'
  | 'VIOLENCE_OR_THREATS'
  | 'SPAM'
  | 'OTHER';

/** Workflow states returned on a report receipt. */
export type ModerationReportStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

/** Server-assigned urgency for a report receipt. */
export type ModerationReportPriority = 'STANDARD' | 'URGENT';

/** Server target for a moderation report. */
export type ModerationReportTarget = { type: 'MESSAGE'; id: string } | { type: 'USER'; id: string };

/** Payload for reporting a message; the server derives its conversation scope. */
export interface MessageReportInput {
  target: { type: 'MESSAGE'; id: string };
  reason: ModerationReportReason;
  details?: string;
}

/** Payload for reporting a User from an authorized Event or Direct conversation. */
export interface UserReportInput {
  target: { type: 'USER'; id: string };
  contextConversationId: string;
  reason: ModerationReportReason;
  details?: string;
}

/** Union of report payloads accepted by the moderation endpoint. */
export type CreateReportInput = MessageReportInput | UserReportInput;

/** Receipt returned after a report is created or deduplicated by the server. */
export interface ModerationReportReceipt {
  id: string;
  status: ModerationReportStatus;
  priority: ModerationReportPriority;
  dueAt: string;
  createdAt: string;
}

/** Query parameters for the cursor-paginated blocked-user list. */
export interface BlockedUsersParams {
  cursor?: string;
  limit?: number;
}

/** Safe profile fields returned for a User blocked by the current User. */
export interface BlockedUserSummary {
  userId: string;
  username: string;
  displayName: string;
  displayPicture: string | null;
  blockedAt: string;
}

/** One server-owned page of blocked Users. */
export interface BlockedUsersPage {
  items: BlockedUserSummary[];
  nextCursor: string | null;
}
