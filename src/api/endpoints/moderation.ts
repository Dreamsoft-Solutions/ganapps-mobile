import axiosInstance from '@/api/axios-instance';
import type {
  BlockedUsersPage,
  BlockedUsersParams,
  CreateReportInput,
  ModerationReportReceipt,
} from '@/types/moderation.types';

/** Default number of blocked-user summaries requested by one page. */
export const BLOCKED_USERS_PAGE_SIZE: number = 20;

/** Typed moderation HTTP endpoints. Paths intentionally omit `/api/v1`. */
export const moderationAPI = {
  /**
   * Submits a message or authorized-context User report.
   *
   * @param input - Server-validated target, reason, and optional details
   * @returns The created or idempotently existing report receipt
   */
  createReport: (input: CreateReportInput): Promise<ModerationReportReceipt> =>
    axiosInstance.post<ModerationReportReceipt>('/moderation/reports', input).then((res) => res.data),

  /**
   * Lists Users blocked by the current User.
   *
   * @param params - Opaque cursor and bounded page size
   * @returns Server-owned blocked-user page
   */
  listBlocks: (params: BlockedUsersParams = {}): Promise<BlockedUsersPage> =>
    axiosInstance
      .get<BlockedUsersPage>('/me/blocks', {
        params: {
          cursor: params.cursor,
          limit: params.limit ?? BLOCKED_USERS_PAGE_SIZE,
        },
      })
      .then((res) => res.data),

  /**
   * Creates or reactivates a directional block.
   *
   * @param userId - Server identifier of the User to block
   * @returns A promise resolving after the server accepts the idempotent action
   */
  blockUser: (userId: string): Promise<void> =>
    axiosInstance.post<void>(`/users/${userId}/block`).then(() => undefined),

  /**
   * Deactivates a directional block.
   *
   * @param userId - Server identifier of the User to unblock
   * @returns A promise resolving after the server accepts the idempotent action
   */
  unblockUser: (userId: string): Promise<void> =>
    axiosInstance.delete<void>(`/users/${userId}/block`).then(() => undefined),
};
