import type { CursorPage } from '@/api/types/api-response';

/** What a User did with a walk card that the server records: opened it, or moved past it. */
export type WalkInteractionType = 'OPENED' | 'SKIPPED';

/**
 * One recommended event in an Event Walk.
 *
 * Mirrors the server's walk card: the `GET /ganaps` list item plus the caller's own
 * engagement and the distance from the walk's start. `distanceKm` is `null` when the
 * walk began without a location. The server does not expose its ranking score.
 */
export interface WalkCard {
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
  /** Number of minutes before the Ganap starts when attendance scanning opens. */
  attendanceOpenMinutesBefore: number;
  mainTag: string | null;
  subTags: string[];
  tags: string[];
  coverImage?: string | null;
  mapPinImage?: string | null;
  registrationCount: number;
  likesCount: number;
  createdAt: string;
  distanceKm: number | null;
  isLiked: boolean;
  isSaved: boolean;
}

/**
 * One page of an Event Walk.
 *
 * `walkToken` is the server-signed identity of the walk the page belongs to; send it with
 * every interaction. `pagination.total` is the number of candidates when the walk began.
 */
export interface WalkPage extends CursorPage<WalkCard> {
  asOf: string;
  walkToken: string;
}

/** What a walk starts from: an optional position and the Ganaps it should resemble. */
export interface WalkParams {
  lat?: number;
  long?: number;
  /** Ganap ids the walk should resemble; the server accepts at most 20. */
  seed?: readonly string[];
}

/** Arguments for recording an open or a Skip. */
export interface WalkInteractionInput {
  ganapId: string;
  type: WalkInteractionType;
  walkToken: string;
}
