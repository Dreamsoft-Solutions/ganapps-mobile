import { ErrorCodes } from '@/constants/errors';
import type {
  FeedbackIntent,
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
 * Whether the organizer requires the post-attendance form before a rating.
 *
 * A policy absent from an older server counts as `REQUIRED`, the behaviour
 * that server enforced. A Ganap with no questions never requires the form.
 *
 * @param ganap - Ganap detail carrying the form policy
 * @param blocks - The Ganap's `POST_ATTENDANCE` blocks, empty when none exist
 * @returns `true` when the form must be submitted before rating
 */
export function isFormRequiredForRating(ganap: GanapDetail, blocks: FormBlock[]): boolean {
  return blocks.length > 0 && (ganap.postAttendanceFormPolicy ?? 'REQUIRED') === 'REQUIRED';
}

/**
 * Derives which feedback steps are still outstanding for the current student.
 *
 * Only an `ATTENDED` registration has anything to answer. The two pending
 * tests degrade differently while the server fields are absent, and the
 * asymmetry is deliberate: re-rating is rejected with a conflict, so an
 * unknown rating state hides the step; re-submitting the form is a harmless
 * upsert, so an unknown form submission state still offers it.
 *
 * A required, unsubmitted form comes before the rating. With the `rate`
 * intent the rating gates everything: once rated, nothing is left. With the
 * `form` intent (My Events) the form is the goal, and a rating still pending
 * after a required form is offered as the follow-up step.
 *
 * @param ganap - Ganap detail including the caller's registration and rating
 * @param blocks - The Ganap's `POST_ATTENDANCE` blocks, empty when none exist
 * @param intent - Why the feedback route was opened; defaults to `rate`
 * @returns The outstanding steps in the order they should be presented
 */
export function getPendingFeedbackSteps(
  ganap: GanapDetail,
  blocks: FormBlock[],
  intent: FeedbackIntent = 'rate',
): FeedbackStep[] {
  const registration = ganap.myRegistration;
  if (registration?.status !== 'ATTENDED') return [];

  const submittedAt = registration.postAttendanceFormSubmittedAt;
  const ratingPending = ganap.myRating === null;
  const formPending = blocks.length > 0 && (submittedAt === null || submittedAt === undefined);
  const required = isFormRequiredForRating(ganap, blocks);

  if (intent === 'rate') {
    if (!ratingPending) return [];
    return formPending && required ? ['form', 'rating'] : ['rating'];
  }

  if (!formPending) return ratingPending && required ? ['rating'] : [];
  return ratingPending && required ? ['form', 'rating'] : ['form'];
}

/**
 * The feedback row state rendered by Event Hub.
 *
 * `formFirst` marks an actionable row whose organizer-required form must be
 * answered before the rating.
 */
export type FeedbackRowState = { kind: 'hidden' } | { kind: 'actionable'; formFirst: boolean } | { kind: 'submitted' };

/**
 * Derives whether the Event Hub may show feedback, an actionable rating row,
 * or a submitted-rating confirmation from authoritative metadata.
 *
 * The row is the rating entrance: it is actionable while the caller has not
 * rated, and `formFirst` flags a required form that comes before the rating.
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
  if (ganap.myRating !== null) return { kind: 'submitted' };
  const submittedAt = registration.postAttendanceFormSubmittedAt;
  const formPending = blocks.length > 0 && (submittedAt === null || submittedAt === undefined);
  return { kind: 'actionable', formFirst: formPending && isFormRequiredForRating(ganap, blocks) };
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
    message: 'Submit the feedback form before rating this event.',
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
