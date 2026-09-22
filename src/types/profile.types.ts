import type { GanapStatus, RegistrationStatus } from './ganap.types';

/**
 * A Ganap joined by the current User.
 */
export interface JoinedGanap {
  id: string;
  businessId: string;
  businessName: string;
  slug: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  tags: string[];
  coverImage?: string | null;
  registrationStatus: RegistrationStatus;
  registeredAt: string;
}

/** Time range filters accepted by the current User's joined Ganap endpoint. */
export type JoinedGanapTimeFilter = 'UPCOMING' | 'PAST' | 'ALL';

/** Optional search and time filters for the current User's joined Ganap list. */
export interface JoinedGanapFilters {
  search?: string;
  time?: JoinedGanapTimeFilter;
}

/** Parameters accepted by the current User's joined Ganap endpoint. */
export interface JoinedGanapParams extends JoinedGanapFilters {
  skip?: number;
  take?: number;
}

/**
 * A Ganap saved by the current User.
 *
 * Mirrors the server's `SavedGanapResponseDto`. Saving does not require a
 * registration, so a saved Ganap carries no registration state — only when the
 * save happened.
 */
export interface SavedGanap {
  id: string;
  businessId: string;
  businessName: string;
  slug: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  status: GanapStatus;
  tags: string[];
  coverImage?: string | null;
  savedAt: string;
}

/**
 * Parameters accepted by the current User's saved Ganap endpoint.
 *
 * Offset pagination only — the server's `ListSavedGanapsQueryDto` picks just
 * `skip` and `take`, so there is deliberately no search or time filter here.
 */
export interface SavedGanapParams {
  skip?: number;
  take?: number;
}
