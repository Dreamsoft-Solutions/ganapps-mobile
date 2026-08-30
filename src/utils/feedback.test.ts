import { describe, expect, it } from '@jest/globals';
import { ErrorCodes } from '@/constants/errors';
import type { FormAnswerItem, FormBlock, GanapDetail, SubmitFormAnswersInput } from '@/types/ganap.types';
import { getFeedbackRowState, getPendingFeedbackSteps, mapFeedbackError, toSubmitFeedbackInput } from './feedback';

interface FeedbackStateFixture {
  myRating: number | null;
  submittedAt: string | null;
  blocks: 0 | 1;
}

const postAttendanceBlock: FormBlock = {
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
 * Builds an attended Ganap with an explicit feedback state for domain tests.
 *
 * @param state - Caller rating, form submission timestamp, and form presence
 * @returns An attended Ganap detail carrying the supplied feedback fields
 */
function ganapWithFeedbackState(state: FeedbackStateFixture): GanapDetail {
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
    myRating: state.myRating,
    myRegistration: {
      id: 'reg_1',
      status: 'ATTENDED',
      createdAt: '2026-08-01T00:00:00.000Z',
      registrationFormSubmittedAt: null,
      postAttendanceFormSubmittedAt: state.submittedAt,
    },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function codedError(message: string, errorCode?: string): Error & { errorCode?: string } {
  const error = new Error(message) as Error & { errorCode?: string };
  if (errorCode !== undefined) error.errorCode = errorCode;
  return error;
}

describe('feedback state derivation', (): void => {
  it.each([
    [{ myRating: null, submittedAt: null, blocks: 0 }, ['rating'], { kind: 'actionable' }],
    [{ myRating: 5, submittedAt: null, blocks: 0 }, [], { kind: 'submitted' }],
    [{ myRating: null, submittedAt: null, blocks: 1 }, ['rating', 'form'], { kind: 'actionable' }],
    [{ myRating: 5, submittedAt: null, blocks: 1 }, ['form'], { kind: 'actionable' }],
    [{ myRating: null, submittedAt: '2026-08-29T04:00:00.000Z', blocks: 1 }, ['rating'], { kind: 'actionable' }],
    [{ myRating: 5, submittedAt: '2026-08-29T04:00:00.000Z', blocks: 1 }, [], { kind: 'submitted' }],
  ] satisfies Array<
    [FeedbackStateFixture, string[], { kind: string }]
  >)('derives the feedback state for %j', (state, pending, rowState): void => {
    const detail = ganapWithFeedbackState(state);
    const blocks: FormBlock[] = state.blocks === 1 ? [postAttendanceBlock] : [];
    expect(getPendingFeedbackSteps(detail, blocks)).toEqual(pending);
    expect(getFeedbackRowState(detail, blocks, false)).toEqual(rowState);
  });

  it('hides the row when access, form metadata, rating metadata, or registration eligibility is unknown', (): void => {
    const attendedDetail: GanapDetail = ganapWithFeedbackState({ myRating: 5, submittedAt: null, blocks: 0 });
    const attendedRegistration = attendedDetail.myRegistration;
    if (attendedRegistration === null || attendedRegistration === undefined) {
      throw new Error('The attended fixture must include a registration');
    }
    const registeredDetail: GanapDetail = {
      ...attendedDetail,
      myRegistration: { ...attendedRegistration, status: 'REGISTERED' },
    };
    expect(getFeedbackRowState(attendedDetail, undefined, false)).toEqual({ kind: 'hidden' });
    expect(getFeedbackRowState({ ...attendedDetail, myRating: undefined }, [], false)).toEqual({ kind: 'hidden' });
    const formMetadataDetail: GanapDetail = ganapWithFeedbackState({ myRating: 5, submittedAt: null, blocks: 1 });
    const formMetadataRegistration = formMetadataDetail.myRegistration;
    if (formMetadataRegistration === null || formMetadataRegistration === undefined) {
      throw new Error('The form metadata fixture must include a registration');
    }
    const unknownFormMetadataDetail: GanapDetail = {
      ...formMetadataDetail,
      myRegistration: {
        ...formMetadataRegistration,
        postAttendanceFormSubmittedAt: undefined,
      },
    };
    expect(getFeedbackRowState(unknownFormMetadataDetail, [postAttendanceBlock], false)).toEqual({ kind: 'hidden' });
    expect(getFeedbackRowState(attendedDetail, [], true)).toEqual({ kind: 'hidden' });
    expect(getFeedbackRowState(registeredDetail, [], false)).toEqual({ kind: 'hidden' });
  });
});

describe('toSubmitFeedbackInput', (): void => {
  it('strips registration-only fields and clones selected options', (): void => {
    const selectedOptionIds: string[] = ['o1'];
    const formAnswers: SubmitFormAnswersInput = {
      scope: 'POST_ATTENDANCE',
      answers: [{ formBlockId: 'b1', textValue: 'x', numberValue: 7, scaleValue: 4, selectedOptionIds }],
    };

    const input = toSubmitFeedbackInput({ rating: 5, formAnswers });

    expect(input).toEqual({
      rating: 5,
      answers: [{ formBlockId: 'b1', textValue: 'x', scaleValue: 4, selectedOptionIds: ['o1'] }],
    });
    expect(input).not.toHaveProperty('scope');
    expect(input.answers?.[0]).not.toHaveProperty('numberValue');
    expect(input.answers?.[0]?.selectedOptionIds).not.toBe(selectedOptionIds);
  });

  it('converts rating-only feedback', (): void => {
    expect(toSubmitFeedbackInput({ rating: 4 })).toEqual({ rating: 4 });
  });

  it('converts answers-only feedback', (): void => {
    const answer: FormAnswerItem = { formBlockId: 'b1', textValue: 'x' };
    expect(toSubmitFeedbackInput({ formAnswers: { answers: [answer] } })).toEqual({ answers: [answer] });
  });
});

describe('mapFeedbackError', (): void => {
  it.each([
    [
      ErrorCodes.FEEDBACK_NOT_ELIGIBLE,
      'not-eligible',
      'Feedback unavailable',
      'You must attend this event before submitting feedback.',
    ],
    [
      ErrorCodes.FEEDBACK_RATING_REQUIRED,
      'rating-required',
      'Rating required',
      'Choose a rating before submitting feedback.',
    ],
    [
      ErrorCodes.FEEDBACK_ANSWERS_REQUIRED,
      'answers-required',
      'Feedback form required',
      'Complete the post-event form before submitting feedback.',
    ],
    [
      ErrorCodes.FEEDBACK_RATING_CONFLICT,
      'rating-conflict',
      'Rating already submitted',
      'Your rating was already submitted and cannot be changed.',
    ],
  ] satisfies Array<
    [string, string, string, string]
  >)('maps %s to exact attendee copy', (errorCode, kind, title, message): void => {
    expect(mapFeedbackError(codedError('server detail', errorCode))).toEqual({ kind, title, message });
  });

  it('trims and preserves a nonblank INVALID_INPUT server message', (): void => {
    expect(
      mapFeedbackError(codedError('  Required field "How was the venue?" is missing  ', ErrorCodes.INVALID_INPUT))
        .message,
    ).toBe('Required field "How was the venue?" is missing');
  });

  it('uses generic copy when INVALID_INPUT has a blank message', (): void => {
    expect(mapFeedbackError(codedError('   ', ErrorCodes.INVALID_INPUT)).message).toBe(
      'Feedback could not be submitted. Please try again.',
    );
  });

  it('uses generic copy for unknown or missing error codes regardless of raw message', (): void => {
    expect(mapFeedbackError(codedError('server detail', 'OTHER_CODE')).message).toBe(
      'Feedback could not be submitted. Please try again.',
    );
    expect(mapFeedbackError(codedError('server detail')).message).toBe(
      'Feedback could not be submitted. Please try again.',
    );
  });
});
