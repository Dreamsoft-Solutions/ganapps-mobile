import { describe, expect, it } from '@jest/globals';
import type { FormBlock, GanapDetail } from '@/types/ganap.types';
import { getPendingFeedbackSteps, mapFeedbackError } from './feedback';

const block: FormBlock = {
  id: 'block_1',
  ganapId: 'g1',
  scope: 'POST_ATTENDANCE',
  type: 'TEXT',
  label: 'What did you think?',
  isRequired: false,
  allowMultiple: false,
  order: 1,
  config: null,
  options: [],
  createdAt: '2026-08-18T00:00:00.000Z',
  updatedAt: '2026-08-18T00:00:00.000Z',
};

/**
 * Builds a Ganap detail carrying the registration and rating state under test.
 *
 * @param overrides - Registration status, own rating, and form submission time
 * @returns A Ganap detail suitable for step derivation
 */
function ganap(overrides: Partial<GanapDetail> & { registration?: GanapDetail['myRegistration'] }): GanapDetail {
  const { registration, ...rest } = overrides;
  return {
    id: 'g1',
    businessId: 'b1',
    businessName: 'CPU Republic',
    slug: 'foundation-week',
    title: 'Foundation Week',
    description: 'Campus wide celebration',
    locationLat: 10.7,
    locationLong: 122.5,
    startDate: '2026-08-01T00:00:00.000Z',
    attendanceOpenMinutesBefore: 30,
    status: 'COMPLETED',
    requiresApproval: false,
    tags: [],
    registrationCount: 10,
    myRegistration:
      registration === undefined
        ? { id: 'reg_1', status: 'ATTENDED', createdAt: '2026-08-01T00:00:00.000Z', registrationFormSubmittedAt: null }
        : registration,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...rest,
  };
}

describe('getPendingFeedbackSteps', () => {
  it('returns no steps when the student has not attended', () => {
    const detail = ganap({
      myRating: null,
      registration: {
        id: 'reg_1',
        status: 'REGISTERED',
        createdAt: '2026-08-01T00:00:00.000Z',
        registrationFormSubmittedAt: null,
      },
    });

    expect(getPendingFeedbackSteps(detail, [block])).toEqual([]);
  });

  it('returns no steps when there is no registration at all', () => {
    expect(getPendingFeedbackSteps(ganap({ myRating: null, registration: null }), [block])).toEqual([]);
  });

  it('offers the rating when the server reports no rating yet', () => {
    expect(getPendingFeedbackSteps(ganap({ myRating: null }), [])).toEqual(['rating']);
  });

  it('hides the rating when the server has not shipped myRating', () => {
    expect(getPendingFeedbackSteps(ganap({}), [])).toEqual([]);
  });

  it('hides the rating once a score exists', () => {
    expect(getPendingFeedbackSteps(ganap({ myRating: 4 }), [])).toEqual([]);
  });

  it('offers the form when blocks exist and submission state is unknown', () => {
    expect(getPendingFeedbackSteps(ganap({}), [block])).toEqual(['form']);
  });

  it('hides the form when the organizer built no blocks', () => {
    expect(getPendingFeedbackSteps(ganap({ myRating: null }), [])).toEqual(['rating']);
  });

  it('hides the form once it has been submitted', () => {
    const detail = ganap({
      myRating: 5,
      registration: {
        id: 'reg_1',
        status: 'ATTENDED',
        createdAt: '2026-08-01T00:00:00.000Z',
        registrationFormSubmittedAt: null,
        postAttendanceFormSubmittedAt: '2026-08-18T00:00:00.000Z',
      },
    });

    expect(getPendingFeedbackSteps(detail, [block])).toEqual([]);
  });

  it('orders the rating before the form when both are pending', () => {
    expect(getPendingFeedbackSteps(ganap({ myRating: null }), [block])).toEqual(['rating', 'form']);
  });
});

describe('mapFeedbackError', () => {
  it('classifies a duplicate rating as already-rated', () => {
    expect(mapFeedbackError(new Error('Already rated this event')).kind).toBe('already-rated');
  });

  it('classifies a missing organizer form as no-form', () => {
    expect(mapFeedbackError(new Error('No post-attendance form exists for this event')).kind).toBe('no-form');
  });

  it('classifies both attendance preconditions as not-attended', () => {
    expect(mapFeedbackError(new Error('Must attend the event before rating')).kind).toBe('not-attended');
    expect(mapFeedbackError(new Error('Must attend the event before submitting post-attendance feedback')).kind).toBe(
      'not-attended',
    );
  });

  it('classifies a missing required field by prefix, whatever the label', () => {
    expect(mapFeedbackError(new Error('Required field "Your name" is missing')).kind).toBe('stale-blocks');
  });

  it('classifies an unknown block id by prefix', () => {
    expect(mapFeedbackError(new Error('Unknown form block ID: block_9')).kind).toBe('stale-blocks');
  });

  it('classifies both 404 messages as not-found', () => {
    expect(mapFeedbackError(new Error('Event not found')).kind).toBe('not-found');
    expect(mapFeedbackError(new Error('Not registered for this event')).kind).toBe('not-found');
  });

  it('falls back to unknown for an unrecognized message', () => {
    const model = mapFeedbackError(new Error('Service unavailable'));
    expect(model.kind).toBe('unknown');
    expect(model.title.length).toBeGreaterThan(0);
    expect(model.message.length).toBeGreaterThan(0);
  });
});
