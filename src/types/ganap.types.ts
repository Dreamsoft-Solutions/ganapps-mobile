/**
 * Lifecycle of a student's registration for a Ganap.
 *
 * Mirrors the server's `RegistrationStatus` enum in `prisma/schema.prisma`. The
 * response DTOs type this loosely as `string`; the enum is authoritative.
 */
export type RegistrationStatus =
  | 'PENDING'
  | 'REGISTERED'
  | 'WAITLISTED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'ATTENDED'
  | 'EVICTED';

/**
 * A Ganap as it appears in the public browse list.
 *
 * Mirrors the server's `PublicGanapListItemResponseDto`. The `isLiked`, `isSaved`
 * and `myRegistrationStatus` fields are present only when the request carried a
 * token. `registrationCount` and `likesCount` are currently hardcoded to 0 by the
 * server — real fields, placeholder values.
 */
export interface GanapListItem {
  id: string;
  businessId: string;
  businessName: string;
  slug: string;
  title: string;
  description: string;
  address?: string | null;
  locationLat: number;
  locationLong: number;
  startDate: string;
  endDate?: string | null;
  tags: string[];
  coverImage?: string | null;
  mapPinImage?: string | null;
  registrationCount: number;
  likesCount?: number;
  createdAt: string;
  isLiked?: boolean;
  isSaved?: boolean;
  myRegistrationStatus?: RegistrationStatus | null;
}

/**
 * A single Ganap with the detail the event screen needs.
 *
 * Mirrors the server's `PublicGanapDetailResponseDto`. Note this is a different
 * shape from {@link GanapListItem}: it drops `myRegistrationStatus` in favour of
 * the richer `myRegistration`, and adds the organizer-configured settings a
 * client must respect rather than assume.
 */
export interface GanapDetail {
  id: string;
  businessId: string;
  businessName: string;
  slug: string;
  title: string;
  description: string;
  address?: string | null;
  locationLat: number;
  locationLong: number;
  startDate: string;
  endDate?: string | null;
  status: string;
  requiresApproval: boolean;
  maxAttendees?: number | null;
  tags: string[];
  coverImage?: string | null;
  bannerImage?: string | null;
  mapPinImage?: string | null;
  registrationCount: number;
  likesCount?: number;
  averageRating?: number | null;
  ratingCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  myRegistration?: {
    id: string;
    status: RegistrationStatus;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The registration created by joining a Ganap.
 *
 * The server decides `status`: `WAITLISTED` when the event is at capacity,
 * `PENDING` when it requires approval or carries a registration form, otherwise
 * `REGISTERED`. Never assume `REGISTERED` — read what came back.
 */
export interface JoinGanapResult {
  id: string;
  userId: string;
  ganapId: string;
  status: RegistrationStatus;
  requiresForm?: boolean;
  createdAt: string;
}

/** Query parameters accepted by the public Ganap list. */
export interface GanapListParams {
  cursor?: string;
  limit?: number;
  search?: string;
  tag?: string;
}
