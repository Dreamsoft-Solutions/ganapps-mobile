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
