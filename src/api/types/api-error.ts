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
  timestamp: string;
  requestId?: string;
}
