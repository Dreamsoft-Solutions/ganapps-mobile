/**
 * Matches the server's ResponseInterceptor envelope:
 * { success, statusCode, data, message }
 */
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  message: string;
}

/**
 * Narrows an arbitrary response body to the server's envelope.
 *
 * Every server route is wrapped by a global `ResponseInterceptor`, so this
 * should match on all responses. It is a runtime check because Axios cannot
 * know the shape before the request resolves.
 *
 * @param body - Raw response body to inspect
 * @returns True when the body carries the envelope's `success` and `data` keys
 */
export function isApiResponse<T>(body: unknown): body is ApiResponse<T> {
  return typeof body === 'object' && body !== null && 'success' in body && 'data' in body;
}

export interface PaginatedResponse<T> {
  success: boolean;
  statusCode: number;
  data: T[];
  message: string;
  meta: {
    skip: number;
    take: number;
    total: number;
  };
}

/**
 * A cursor-paginated payload as returned inside the response envelope.
 *
 * The server's public list endpoints page by cursor, not by offset: `nextCursor`
 * is the id to pass as `cursor` on the following request, and is `null` on the
 * last page. This is the shape nested inside `data`, so the response interceptor
 * has already unwrapped the envelope by the time a caller sees it.
 */
export interface CursorPage<T> {
  items: T[];
  pagination: {
    total: number;
    cursor: string | null;
    nextCursor: string | null;
    limit: number;
  };
}
