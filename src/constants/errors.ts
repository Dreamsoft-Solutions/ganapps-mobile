export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export const ErrorMessages = {
  [ErrorCodes.UNAUTHORIZED]: 'Please sign in to continue',
  [ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this action',
  [ErrorCodes.NOT_FOUND]: 'The requested resource was not found',
  [ErrorCodes.VALIDATION_ERROR]: 'Please check your input and try again',
  [ErrorCodes.INTERNAL_ERROR]: 'Something went wrong. Please try again later',
  [ErrorCodes.NETWORK_ERROR]: 'No internet connection. Please check your network',
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
