import { ErrorCodes } from '@/constants/errors';
import type { GanapReportReason, ReportGanapInput } from '@/types/ganap.types';
import type { ChatNormalizedError } from './chat';

/** Maximum characters the server accepts in a Ganap report's details. */
export const MAX_GANAP_REPORT_DETAILS_LENGTH = 1_000;

/** Ganap report reasons in picker order, with the labels Users see. */
export const GANAP_REPORT_REASONS: ReadonlyArray<{ value: GanapReportReason; label: string }> = [
  { value: 'MISLEADING_INFORMATION', label: 'Misleading or false information' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'SPAM', label: 'Spam or scam' },
  { value: 'SAFETY_CONCERN', label: 'Safety concern' },
  { value: 'OTHER', label: 'Something else' },
];

const GANAP_REPORT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [ErrorCodes.GANAP_REPORT_DUPLICATE]: "You've already reported this event. We'll review it.",
  [ErrorCodes.GANAP_REPORT_RATE_LIMITED]: "You've reached the limit of five event reports an hour. Try again later.",
  [ErrorCodes.NOT_FOUND]: 'This event is no longer available.',
};

/**
 * Limits report details to the server maximum, counting characters rather than UTF-16 units.
 *
 * @param value - Details as typed
 * @returns The details cut to at most {@link MAX_GANAP_REPORT_DETAILS_LENGTH} characters
 */
export function limitGanapReportDetails(value: string): string {
  return Array.from(value).slice(0, MAX_GANAP_REPORT_DETAILS_LENGTH).join('');
}

/**
 * Builds the report request body, sending details only when there are some.
 *
 * @param reason - The chosen report reason
 * @param details - Details as typed
 * @returns The request body for the Ganap report endpoint
 */
export function buildGanapReportInput(reason: GanapReportReason, details: string): ReportGanapInput {
  const trimmed: string = limitGanapReportDetails(details.trim());
  return trimmed ? { reason, details: trimmed } : { reason };
}

/**
 * Maps a normalized report error to copy that uses "event" and never exposes internal terms.
 *
 * @param error - Error returned by the Axios normalizer
 * @returns User-facing copy for the report sheet
 */
export function getGanapReportErrorMessage(error: Error): string {
  const normalized: ChatNormalizedError = error as ChatNormalizedError;
  return (
    (normalized.errorCode && GANAP_REPORT_ERROR_MESSAGES[normalized.errorCode]) ||
    error.message ||
    'Unable to submit report.'
  );
}
