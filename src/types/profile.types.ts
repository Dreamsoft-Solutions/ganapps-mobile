import type { RegistrationStatus } from './ganap.types';

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
