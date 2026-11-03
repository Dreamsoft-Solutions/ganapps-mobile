import { describe, expect, it } from '@jest/globals';
import {
  buildGanapReportInput,
  GANAP_REPORT_REASONS,
  getGanapReportErrorMessage,
  MAX_GANAP_REPORT_DETAILS_LENGTH,
} from './ganap-report';

function apiError(message: string, errorCode?: string): Error {
  return Object.assign(new Error(message), { errorCode });
}

describe('GANAP_REPORT_REASONS', (): void => {
  it("offers exactly the server's Ganap report reasons, in picker order", (): void => {
    expect(GANAP_REPORT_REASONS.map(({ value }) => value)).toEqual([
      'MISLEADING_INFORMATION',
      'INAPPROPRIATE_CONTENT',
      'SPAM',
      'SAFETY_CONCERN',
      'OTHER',
    ]);
  });
});

describe('buildGanapReportInput', (): void => {
  it('trims details and omits them when empty', (): void => {
    expect(buildGanapReportInput('SPAM', '   ')).toEqual({ reason: 'SPAM' });
    expect(buildGanapReportInput('OTHER', '  Fake listing  ')).toEqual({ reason: 'OTHER', details: 'Fake listing' });
  });

  it('caps details at the server limit, counting characters rather than UTF-16 units', (): void => {
    const input = buildGanapReportInput('OTHER', '🎉'.repeat(MAX_GANAP_REPORT_DETAILS_LENGTH + 5));

    expect(Array.from(input.details ?? '')).toHaveLength(MAX_GANAP_REPORT_DETAILS_LENGTH);
  });
});

describe('getGanapReportErrorMessage', (): void => {
  it('explains a duplicate report without calling it a failure of the app', (): void => {
    expect(
      getGanapReportErrorMessage(apiError('You have already reported this Ganap.', 'GANAP_REPORT_DUPLICATE')),
    ).toBe("You've already reported this event. We'll review it.");
  });

  it('replaces the rate-limit message, which names the internal Ganap term', (): void => {
    expect(
      getGanapReportErrorMessage(
        apiError(
          'You have reached the limit of five Ganap reports in this one-hour period.',
          'GANAP_REPORT_RATE_LIMITED',
        ),
      ),
    ).toBe("You've reached the limit of five event reports an hour. Try again later.");
  });

  it('says the event is gone when the server no longer finds it', (): void => {
    expect(getGanapReportErrorMessage(apiError('Ganap not found', 'NOT_FOUND'))).toBe(
      'This event is no longer available.',
    );
  });

  it('keeps other server messages and falls back when there is none', (): void => {
    expect(
      getGanapReportErrorMessage(
        apiError('Report submissions are temporarily unavailable. Please try again shortly.', 'EXTERNAL_SERVICE_ERROR'),
      ),
    ).toBe('Report submissions are temporarily unavailable. Please try again shortly.');
    expect(getGanapReportErrorMessage(apiError(''))).toBe('Unable to submit report.');
  });
});
