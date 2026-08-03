/** Verification lifecycle of a Business, matching the server enum. */
export type BusinessVerificationStatus = 'PENDING_REGISTRATION' | 'PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED';

/** Read-only Business profile used to enrich attendee-facing Ganap details. */
export interface BusinessDetail {
  id: string;
  name: string;
  slug: string;
  bio?: string | null;
  displayPicture?: string | null;
  coverImage?: string | null;
  address?: string | null;
  locationLat?: number | null;
  locationLong?: number | null;
  verificationStatus: BusinessVerificationStatus;
  registeredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
