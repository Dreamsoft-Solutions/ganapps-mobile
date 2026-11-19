import type { UseQueryResult } from '@tanstack/react-query';
import type { FormBlock, GanapDetail } from '@/types/ganap.types';
import { type GanapActionModel, getGanapActionModel } from '@/utils/ganap-detail';
import { useFormBlocksQuery } from './queries/useGanapsQuery';

/** The Event Details action for the signed-in User's registration. */
export interface UseGanapActionResult {
  /** Status copy and actions, or `null` while the Ganap has not loaded. */
  actionModel: GanapActionModel | null;
  /** `true` while the registration-form check runs; the action should wait for it. */
  isResolving: boolean;
}

/**
 * Derives the Event Details action, checking for registration questions when the answer depends on them.
 *
 * A `PENDING` registration with no submitted form either still owes its form or is waiting for approval. The detail
 * response cannot tell which (DS-253), so this reads the Ganap's `REGISTRATION` form blocks only in that state. While
 * the check runs, the action waits, under the state the Ganap makes likely: a pending request when it requires
 * approval, the unanswered form when it does not. If the check fails, or waits while offline, it falls back to
 * "Complete registration", whose screen has its own error and retry.
 *
 * @param ganap - The loaded Ganap, or `undefined` while it loads
 * @param now - Current display time
 * @returns The action model and whether the form check is still running
 */
export function useGanapAction(ganap: GanapDetail | undefined, now: Date): UseGanapActionResult {
  const registration = ganap?.myRegistration;
  const needsFormCheck: boolean =
    registration?.status === 'PENDING' && registration.registrationFormSubmittedAt === null;
  const formBlocksQuery: UseQueryResult<FormBlock[], Error> = useFormBlocksQuery(ganap?.id ?? '', 'REGISTRATION', {
    enabled: needsFormCheck,
  });
  const blocks: FormBlock[] | undefined = formBlocksQuery.data;
  const isResolving: boolean = needsFormCheck && blocks === undefined && formBlocksQuery.fetchStatus === 'fetching';
  const likelyHasForm: boolean = isResolving ? ganap?.requiresApproval !== true : true;
  const hasRegistrationForm: boolean = blocks === undefined ? likelyHasForm : blocks.length > 0;

  return {
    actionModel: ganap ? getGanapActionModel(ganap, now, hasRegistrationForm) : null,
    isResolving,
  };
}
