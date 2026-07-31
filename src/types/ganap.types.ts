/**
 * Public Ganap list item returned by the server.
 *
 * Mirrors `PublicGanapListItemResponseDto` from the server. Dates are serialized
 * as ISO strings over the wire.
 */
export interface Ganap {
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
  myRegistrationStatus?: string | null;
}

/**
 * Cursor-based pagination metadata returned with public Ganap listings.
 */
export interface GanapPagination {
  total: number;
  cursor: string | null;
  nextCursor: string | null;
  limit: number;
}

/**
 * Paginated response body for `GET /ganaps`.
 */
export interface GanapListResponse {
  items: Ganap[];
  pagination: GanapPagination;
}

/**
 * Query parameters accepted by the public Ganap discovery endpoint.
 */
export interface PublicGanapListQuery {
  cursor?: string;
  limit?: number;
  search?: string;
  tag?: string;
}
