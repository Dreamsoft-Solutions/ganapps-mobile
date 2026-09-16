/**
 * Matches the server's GlobalExceptionFilter error envelope:
 * { success, statusCode, errorCode, message, details?, timestamp, requestId? }
 */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
  /** Some server versions expose retryAt at the top level; newer ones may nest it in details. */
  retryAt?: string;
  timestamp: string;
  requestId?: string;
}
