import type { FormBlock, GanapDetail } from '@/types/ganap.types';

/** One step of the post-event feedback flow. */
export type FeedbackStep = 'rating' | 'form';

/**
 * Derives which feedback steps are still outstanding for the current student.
 *
 * Only an `ATTENDED` registration has anything to answer. The two pending
 * tests degrade differently while the server fields are absent, and the
 * asymmetry is deliberate: re-rating is rejected with `400 Already rated this
 * event`, so an unknown rating state hides the step; re-submitting the form is
 * a silent upsert, so an unknown submission state still offers it.
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

/** How a rejected feedback submission should be recovered from. */
export type FeedbackErrorKind = 'already-rated' | 'no-form' | 'not-attended' | 'stale-blocks' | 'not-found' | 'unknown';

/** Attendee-facing copy for a rejected feedback submission. */
export interface FeedbackErrorModel {
  kind: FeedbackErrorKind;
  title: string;
  message: string;
}

/**
 * Server rejection messages, keyed verbatim.
 *
 * Every one arrives as a plain `BadRequestException`, `ForbiddenException` or
 * `NotFoundException` through the global exception filter, so they share one
 * `errorCode` and the message string is the only discriminator. Coupled to
 * `GanapService.rateGanap` and `GanapService.submitFormAnswers` in
 * `ganapps-server` — if a string there changes, the mapping falls back to
 * `unknown`.
 */
const FEEDBACK_ERROR_MODELS: Record<string, FeedbackErrorModel> = {
  'Already rated this event': {
    kind: 'already-rated',
    title: 'Already rated',
    message: 'You have already rated this event.',
  },
  'No post-attendance form exists for this event': {
    kind: 'no-form',
    title: 'No feedback form',
    message: 'The organization is not collecting written feedback for this event.',
  },
  'Must attend the event before rating': {
    kind: 'not-attended',
    title: 'Attendance not recorded yet',
    message: 'Record your attendance with the organizer QR code before leaving feedback.',
  },
  'Must attend the event before submitting post-attendance feedback': {
    kind: 'not-attended',
    title: 'Attendance not recorded yet',
    message: 'Record your attendance with the organizer QR code before leaving feedback.',
  },
  'Event not found': {
    kind: 'not-found',
    title: 'Event unavailable',
    message: 'This event is no longer available.',
  },
  'Not registered for this event': {
    kind: 'not-found',
    title: 'Event unavailable',
    message: 'You are not registered for this event.',
  },
};

/**
 * Prefix-matched rejections, whose messages embed a runtime value.
 *
 * `Required field "<label>" is missing` and `Unknown form block ID: <id>` both
 * interpolate server data, so they cannot be keyed exactly.
 */
const FEEDBACK_ERROR_PREFIXES: ReadonlyArray<readonly [string, FeedbackErrorModel]> = [
  [
    'Required field',
    {
      kind: 'stale-blocks',
      title: 'Questions have changed',
      message: 'The organization updated this form. Reload it and answer the current questions.',
    },
  ],
  [
    'Unknown form block ID:',
    {
      kind: 'stale-blocks',
      title: 'Questions have changed',
      message: 'The organization updated this form. Reload it and answer the current questions.',
    },
  ],
];

const UNKNOWN_FEEDBACK_ERROR: FeedbackErrorModel = {
  kind: 'unknown',
  title: 'Feedback could not be sent',
  message: 'Something went wrong. Try again in a moment.',
};

/**
 * Maps a rejected rating or feedback submission to attendee-facing copy.
 *
 * @param error - The normalized error the mutation rejected with
 * @returns The matched model, or the unknown fallback
 */
export function mapFeedbackError(error: Error): FeedbackErrorModel {
  const exact = FEEDBACK_ERROR_MODELS[error.message];
  if (exact) return exact;

  for (const [prefix, model] of FEEDBACK_ERROR_PREFIXES) {
    if (error.message.startsWith(prefix)) return model;
  }

  return UNKNOWN_FEEDBACK_ERROR;
}
