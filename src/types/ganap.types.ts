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

/** Lifecycle of a Ganap, matching the server's `GanapStatus` enum. */
export type GanapStatus = 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

/** Scope for an organizer-defined form block. */
export type FormBlockScope = 'REGISTRATION' | 'POST_ATTENDANCE';

/** Renderer type for an organizer-defined form block. */
export type FormBlockType = 'TEXT' | 'MULTIPLE_CHOICE' | 'SCALE';

/** A selectable option belonging to a form block. */
export interface FormOption {
  id: string;
  label: string;
  value: string;
  order: number;
}

/** A server-defined question rendered in a Ganap form. */
export interface FormBlock {
  id: string;
  ganapId: string;
  scope: FormBlockScope;
  type: FormBlockType;
  label: string;
  isRequired: boolean;
  allowMultiple: boolean;
  order: number;
  config: Record<string, unknown> | null;
  options: FormOption[];
  createdAt: string;
  updatedAt: string;
}

/** One answer item accepted by the form-answer endpoint. */
export interface FormAnswerItem {
  formBlockId: string;
  textValue?: string;
  numberValue?: number;
  scaleValue?: number;
  selectedOptionIds?: string[];
}

/** Request payload for submitting registration-form answers. */
export interface SubmitFormAnswersInput {
  answers: FormAnswerItem[];
}

/** Runtime value shape used by the registration form before DTO mapping. */
export type RegistrationFormAnswerValue = string | string[] | number | null;

/** Values keyed by server form-block ID for the registration form. */
export interface RegistrationFormData {
  answers: Record<string, RegistrationFormAnswerValue>;
}

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
  status: GanapStatus;
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
    registrationFormSubmittedAt: string | null;
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

/**
 * Category of an organizer-posted announcement.
 *
 * Mirrors the server's `AnnouncementType` enum in `prisma/schema.prisma`.
 */
export type AnnouncementType = 'GENERAL' | 'REMINDER' | 'UPDATE';

/**
 * One announcement as returned by the attendee-facing announcement endpoint.
 *
 * Mirrors the item shape built by the server's `listPublicAnnouncements`. There
 * is no author image field; clients derive an avatar from `createdByUsername`.
 */
export interface GanapAnnouncement {
  id: string;
  ganapId: string;
  createdByUserId: string;
  createdByUsername: string;
  type: AnnouncementType;
  title?: string | null;
  content: string;
  createdAt: string;
}

/** Offset-pagination query parameters for the attendee announcement list. */
export interface GanapAnnouncementParams {
  skip?: number;
  take?: number;
}
