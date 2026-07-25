import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/api/types/api-error';

export function parseApiError(error: AxiosError): Error & { errorCode?: string } {
  const data = error.response?.data as ApiErrorResponse | undefined;

  const customError = new Error(data?.message || error.message || 'An unexpected error occurred');
  (customError as { errorCode?: string }).errorCode = data?.errorCode;

  return customError;
}
