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
