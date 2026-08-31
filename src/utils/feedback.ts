import { ErrorCodes } from '@/constants/errors';
import type {
  FormAnswerItem,
  FormBlock,
  GanapDetail,
  SubmitFeedbackAnswerInput,
  SubmitFeedbackInput,
  SubmitFormAnswersInput,
} from '@/types/ganap.types';

/** One step of the post-event feedback flow. */
export type FeedbackStep = 'rating' | 'form';

/**
 * Derives which feedback steps are still outstanding for the current student.
 *
 * Only an `ATTENDED` registration has anything to answer. The two pending
 * tests degrade differently while the server fields are absent, and the
 * asymmetry is deliberate: re-rating is rejected with a conflict, so an
 * unknown rating state hides the step; re-submitting the form is a harmless
 * upsert, so an unknown form submission state still offers it.
 *
 * @param ganap - Ganap detail including the caller's registration and rating
 * @param blocks - The Ganap's `POST_ATTENDANCE` blocks, empty when none exist
 * @returns The outstanding steps in the order they should be presented
 */
export function getPendingFeedbackSteps(ganap: GanapDetail, blocks: FormBlock[]): FeedbackStep[] {
  const registration = ganap.myRegistration;
  if (registration?.status !== 'ATTENDED') return [];

  const steps: FeedbackStep[] = [];

  if (ganap.myRating === null) steps.push('rating');

  const submittedAt = registration.postAttendanceFormSubmittedAt;
  if (blocks.length > 0 && (submittedAt === null || submittedAt === undefined)) steps.push('form');

  return steps;
}

/** The feedback row state rendered by Event Hub. */
export type FeedbackRowState = { kind: 'hidden' } | { kind: 'actionable' } | { kind: 'submitted' };

/**
 * Derives whether the Event Hub may show feedback, an actionable row, or a
 * submitted confirmation from authoritative metadata.
 *
 * @param ganap - Ganap detail including the caller's registration and rating
 * @param blocks - Loaded post-attendance form blocks, or undefined while unknown
 * @param accessLost - Whether announcement access was lost while this row was cached
 * @returns The strict Event Hub feedback row state
 */
export function getFeedbackRowState(
  ganap: GanapDetail,
  blocks: FormBlock[] | undefined,
  accessLost: boolean,
): FeedbackRowState {
  const registration = ganap.myRegistration;
  if (accessLost || blocks === undefined || ganap.myRating === undefined || registration?.status !== 'ATTENDED') {
    return { kind: 'hidden' };
  }
  if (blocks.length > 0 && registration.postAttendanceFormSubmittedAt === undefined) {
    return { kind: 'hidden' };
  }
  return getPendingFeedbackSteps(ganap, blocks).length > 0 ? { kind: 'actionable' } : { kind: 'submitted' };
}

/** Parts of a feedback request collected by the rating and form steps. */
export interface FeedbackInputParts {
  rating?: number;
  formAnswers?: SubmitFormAnswersInput;
}

/**
 * Converts legacy form-step values into the combined feedback request shape.
 *
 * `scope` and `numberValue` belong only to the registration/form-answer
 * transport. Selected-option arrays are copied so later form edits cannot
 * mutate a request already handed to the mutation.
 *
 * @param parts - Optional rating and form-answer halves of the request
 * @returns A transport-safe combined feedback request
 */
export function toSubmitFeedbackInput(parts: FeedbackInputParts): SubmitFeedbackInput {
  return {
    ...(parts.rating === undefined ? {} : { rating: parts.rating }),
    ...(parts.formAnswers === undefined
      ? {}
      : {
          answers: parts.formAnswers.answers.map(
            ({ formBlockId, textValue, scaleValue, selectedOptionIds }: FormAnswerItem): SubmitFeedbackAnswerInput => ({
              formBlockId,
              ...(textValue === undefined ? {} : { textValue }),
              ...(scaleValue === undefined ? {} : { scaleValue }),
              ...(selectedOptionIds === undefined ? {} : { selectedOptionIds: [...selectedOptionIds] }),
            }),
          ),
        }),
  };
}

/** How a rejected feedback submission should be recovered from. */
export type FeedbackErrorKind =
  | 'not-eligible'
  | 'rating-required'
  | 'answers-required'
  | 'rating-conflict'
  | 'invalid-input'
  | 'unknown';

/** Attendee-facing copy for a rejected feedback submission. */
export interface FeedbackErrorModel {
  kind: FeedbackErrorKind;
  title: string;
  message: string;
}

type StaticFeedbackErrorCode =
  | typeof ErrorCodes.FEEDBACK_NOT_ELIGIBLE
  | typeof ErrorCodes.FEEDBACK_RATING_REQUIRED
  | typeof ErrorCodes.FEEDBACK_ANSWERS_REQUIRED
  | typeof ErrorCodes.FEEDBACK_RATING_CONFLICT;

const STATIC_FEEDBACK_ERROR_MODELS: Record<StaticFeedbackErrorCode, FeedbackErrorModel> = {
  [ErrorCodes.FEEDBACK_NOT_ELIGIBLE]: {
    kind: 'not-eligible',
    title: 'Feedback unavailable',
    message: 'You must attend this event before submitting feedback.',
  },
  [ErrorCodes.FEEDBACK_RATING_REQUIRED]: {
    kind: 'rating-required',
    title: 'Rating required',
    message: 'Choose a rating before submitting feedback.',
  },
  [ErrorCodes.FEEDBACK_ANSWERS_REQUIRED]: {
    kind: 'answers-required',
    title: 'Feedback form required',
    message: 'Complete the post-event form before submitting feedback.',
  },
  [ErrorCodes.FEEDBACK_RATING_CONFLICT]: {
    kind: 'rating-conflict',
    title: 'Rating already submitted',
    message: 'Your rating was already submitted and cannot be changed.',
  },
} satisfies Record<StaticFeedbackErrorCode, FeedbackErrorModel>;

const GENERIC_FEEDBACK_ERROR_MESSAGE: string = 'Feedback could not be submitted. Please try again.';
const GENERIC_FEEDBACK_ERROR_MODEL: FeedbackErrorModel = {
  kind: 'unknown',
  title: 'Feedback could not be sent',
  message: GENERIC_FEEDBACK_ERROR_MESSAGE,
};

interface ErrorWithCode extends Error {
  errorCode?: unknown;
}

function readFeedbackErrorCode(error: Error): string | undefined {
  const candidate: unknown = (error as ErrorWithCode).errorCode;
  return typeof candidate === 'string' ? candidate : undefined;
}

function isStaticFeedbackErrorCode(value: string | undefined): value is StaticFeedbackErrorCode {
  return value !== undefined && Object.hasOwn(STATIC_FEEDBACK_ERROR_MODELS, value);
}

/**
 * Maps a rejected feedback submission to exact attendee-facing copy by code.
 *
 * Only a coded `INVALID_INPUT` response may surface the server's trimmed
 * message. Unknown or missing codes always use the generic feedback message.
 *
 * @param error - The normalized error rejected by the feedback mutation
 * @returns The mapped feedback error model
 */
export function mapFeedbackError(error: Error): FeedbackErrorModel {
  const errorCode: string | undefined = readFeedbackErrorCode(error);
  if (errorCode === ErrorCodes.INVALID_INPUT) {
    const message: string = error.message.trim();
    return {
      kind: 'invalid-input',
      title: 'Feedback could not be sent',
      message: message.length > 0 ? message : GENERIC_FEEDBACK_ERROR_MESSAGE,
    };
  }
  if (isStaticFeedbackErrorCode(errorCode)) return STATIC_FEEDBACK_ERROR_MODELS[errorCode];
  return GENERIC_FEEDBACK_ERROR_MODEL;
}
