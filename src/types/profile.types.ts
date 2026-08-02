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

/** Parameters accepted by the current User's joined Ganap endpoint. */
export interface JoinedGanapParams {
  skip?: number;
  take?: number;
}
