// Tests for src/app/(app)/(home)/feedback/[ganap-id].tsx live here rather than
// beside it: any .test.tsx under src/app/ is picked up by Expo Router as a route.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Alert, Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';
import type { DynamicFormProps } from '@/components/forms/DynamicForm';
import type { RatingStepProps } from '@/components/ganaps/RatingStep';
import { ErrorCodes } from '@/constants/errors';
import type { SubmitFeedbackVariables } from '@/hooks/mutations/useGanapMutation';
import type { UseGanapFeedbackResult } from '@/hooks/useGanapFeedback';
import type {
  FormBlock,
  GanapDetail,
  SubmitFeedbackInput,
  SubmitFeedbackResponse,
  SubmitFormAnswersInput,
} from '@/types/ganap.types';
import type { FeedbackStep } from '@/utils/feedback';
import { mapFeedbackError } from '@/utils/feedback';

const mockRouter = {
  back: jest.fn<() => void>(),
  replace: jest.fn<(href: unknown) => void>(),
  dismiss: jest.fn<() => void>(),
  canDismiss: jest.fn<() => boolean>().mockReturnValue(false),
  canGoBack: jest.fn<() => boolean>().mockReturnValue(true),
};
const mockParams: { 'ganap-id': string } = { 'ganap-id': 'g1' };

const mockRatingStep = jest.fn<(props: RatingStepProps) => ReactElement>();
const mockDynamicForm = jest.fn<(props: DynamicFormProps) => ReactElement>();
const mockSubmitFeedback = jest.fn<(variables: SubmitFeedbackVariables) => Promise<SubmitFeedbackResponse>>();
const mockRefetch = jest.fn<() => Promise<unknown>>();

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

const mockGanap: GanapDetail = {
  id: 'g1',
  businessId: 'b1',
  businessName: 'CPU Developers',
  slug: 'coffee-and-code',
  title: 'Coffee & Code',
  description: 'Bring a laptop.',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  attendanceOpenMinutesBefore: 30,
  status: 'COMPLETED',
  requiresApproval: false,
  tags: [],
  registrationCount: 5,
  myRating: null,
  myRegistration: {
    id: 'registration_1',
    status: 'ATTENDED',
    createdAt: '2026-08-01T00:00:00.000Z',
    registrationFormSubmittedAt: null,
    postAttendanceFormSubmittedAt: null,
  },
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const formAnswersWithLegacyFields: SubmitFormAnswersInput = {
  scope: 'POST_ATTENDANCE',
  answers: [{ formBlockId: 'block_1', textValue: 'Great event', numberValue: 9 }],
};

const combinedResponse: SubmitFeedbackResponse = {
  myRating: 5,
  postAttendanceFormSubmittedAt: '2026-08-29T04:00:00.000Z',
};

let mockFeedbackState: UseGanapFeedbackResult;

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  return {
    useFocusEffect: (effect: () => undefined | (() => void)): void => {
      React.useEffect(effect, [effect]);
    },
    useLocalSearchParams: (): typeof mockParams => mockParams,
    useRouter: (): typeof mockRouter => mockRouter,
  };
});

jest.mock('@/components/common/Error', () => ({
  ErrorView: ({ error }: { error: Error | null }): ReactElement => <MockText>{error?.message}</MockText>,
}));

jest.mock('@/components/common/Button', () => ({
  Button: ({ children, onPress }: { children: string; onPress: () => void }): ReactElement => (
    <MockPressable accessibilityRole="button" accessibilityLabel={children} onPress={onPress} />
  ),
}));

jest.mock('@/components/common/Text', () => ({
  Text: ({ children }: { children: ReactNode }): ReactElement => <MockText>{children}</MockText>,
}));

jest.mock('@/components/common/Loading', () => ({
  Loading: (): ReactElement => <MockText>Loading</MockText>,
}));

jest.mock('@/components/forms/DynamicForm', () => ({
  DynamicForm: (props: DynamicFormProps): ReactElement => mockDynamicForm(props),
}));

jest.mock('@/components/ganaps/RatingStep', () => ({
  RatingStep: (props: RatingStepProps): ReactElement => mockRatingStep(props),
}));

jest.mock('@/hooks/useGanapFeedback', () => ({
  useGanapFeedback: (): UseGanapFeedbackResult => mockFeedbackState,
}));

import FeedbackRoute from '@/app/(app)/(home)/feedback/[ganap-id]';

/**
 * Renders the feedback route under test.
 *
 * @returns The rendered screen.
 */
async function renderRoute(): Promise<Awaited<ReturnType<typeof render>>> {
  return await render(<FeedbackRoute />);
}

function codedError(message: string, errorCode?: string): Error & { errorCode?: string } {
  const error = new Error(message) as Error & { errorCode?: string };
  if (errorCode !== undefined) error.errorCode = errorCode;
  return error;
}

function resetStates(pendingSteps: FeedbackStep[], ratingScore: number = 5): void {
  const registration = mockGanap.myRegistration;
  if (registration === null || registration === undefined) throw new Error('Expected an attended fixture');

  const ganap: GanapDetail = {
    ...mockGanap,
    myRating: pendingSteps.includes('rating') ? null : 5,
    myRegistration: {
      ...registration,
      postAttendanceFormSubmittedAt: pendingSteps.includes('form') ? null : '2026-08-29T04:00:00.000Z',
    },
  };

  mockFeedbackState = {
    ganap,
    blocks: pendingSteps.includes('form') ? [block] : [],
    pendingSteps,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    submitFeedback: mockSubmitFeedback as UseGanapFeedbackResult['submitFeedback'],
    isSubmitting: false,
    submissionError: null,
  };

  mockRatingStep.mockImplementation(
    (props: RatingStepProps): ReactElement => (
      <MockView>
        <MockText>{props.ganapTitle}</MockText>
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Submit mocked rating"
          onPress={(): void => {
            void props.onSubmit(ratingScore);
          }}
        />
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Submit invalid rating"
          onPress={(): void => {
            void props.onSubmit(0);
          }}
        />
        {props.onSkip !== undefined ? (
          <MockPressable accessibilityRole="button" accessibilityLabel="Skip mocked rating" onPress={props.onSkip} />
        ) : null}
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Leave from mocked rating"
          onPress={(): void => props.onBack()}
        />
        <MockText>{props.submissionError?.message ?? ''}</MockText>
      </MockView>
    ),
  );

  mockDynamicForm.mockImplementation(
    (props: DynamicFormProps): ReactElement => (
      <MockView>
        <MockText>{props.title}</MockText>
        <MockText>{formAnswersWithLegacyFields.answers[0]?.textValue ?? ''}</MockText>
        <MockText>{props.submissionError?.message ?? ''}</MockText>
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Mark form dirty"
          onPress={(): void => props.onDirtyChange(true)}
        />
        <MockPressable accessibilityRole="button" accessibilityLabel="Back from mocked form" onPress={props.onBack} />
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Submit mocked form"
          onPress={(): void => {
            void props.onSubmit(formAnswersWithLegacyFields);
          }}
        />
      </MockView>
    ),
  );
}

beforeEach((): void => {
  mockRatingStep.mockReset();
  mockDynamicForm.mockReset();
  mockSubmitFeedback.mockReset();
  mockRefetch.mockReset().mockResolvedValue(undefined);
  mockRouter.back.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.dismiss.mockReset();
  mockRouter.canDismiss.mockReset().mockReturnValue(false);
  mockRouter.canGoBack.mockReset().mockReturnValue(true);
  resetStates(['rating', 'form']);
});

afterEach((): void => {
  jest.restoreAllMocks();
});

describe('feedback route step resolution', (): void => {
  it('renders the rating step when a rating is pending', async (): Promise<void> => {
    const screen = await renderRoute();

    expect(mockRatingStep).toHaveBeenCalled();
    expect(screen.getByText('Coffee & Code')).toBeTruthy();
    expect(mockDynamicForm).not.toHaveBeenCalled();
  });

  it('holds an initial rating locally and makes no request before the form submits', async (): Promise<void> => {
    resetStates(['rating', 'form']);
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));

    expect(mockSubmitFeedback).not.toHaveBeenCalled();
    await waitFor(() => expect(mockDynamicForm).toHaveBeenCalled());
  });

  it('submits one combined payload after the form is valid', async (): Promise<void> => {
    resetStates(['rating', 'form']);
    mockSubmitFeedback.mockResolvedValueOnce(combinedResponse);
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));
    await waitFor(() => expect(mockDynamicForm).toHaveBeenCalled());

    const formProps: DynamicFormProps = mockDynamicForm.mock.calls.at(-1)?.[0] as DynamicFormProps;
    await act(async (): Promise<void> => {
      await formProps.onSubmit(formAnswersWithLegacyFields);
    });

    await waitFor(() => expect(mockSubmitFeedback).toHaveBeenCalledTimes(1));
    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      ganapId: 'g1',
      input: { rating: 5, answers: [{ formBlockId: 'block_1', textValue: 'Great event' }] },
    });
  });

  it.each([
    { pendingSteps: ['rating'] as FeedbackStep[], input: { rating: 4 } },
    {
      pendingSteps: ['form'] as FeedbackStep[],
      input: { answers: [{ formBlockId: 'block_1', textValue: 'Great event' }] },
    },
  ])(
    'submits only the missing half for a legacy partial state',
    async ({ pendingSteps, input }: { pendingSteps: FeedbackStep[]; input: SubmitFeedbackInput }): Promise<void> => {
      resetStates(pendingSteps, pendingSteps.includes('rating') ? 4 : 5);
      mockSubmitFeedback.mockResolvedValueOnce({ myRating: 4, postAttendanceFormSubmittedAt: null });
      const screen = await renderRoute();
      const control = screen.getByRole('button', {
        name: pendingSteps[0] === 'rating' ? 'Submit mocked rating' : 'Submit mocked form',
      });

      await fireEvent.press(control);

      await waitFor(() => expect(mockSubmitFeedback).toHaveBeenCalledTimes(1));
      expect(mockSubmitFeedback).toHaveBeenCalledWith({ ganapId: 'g1', input });
    },
  );

  it('keeps the form rendered, shows mapped invalid input, and retries the identical payload', async (): Promise<void> => {
    resetStates(['rating', 'form']);
    const error = codedError(
      '  Required field "How was the venue?" is missing  ',
      ErrorCodes.INVALID_INPUT,
    );
    mockSubmitFeedback.mockRejectedValueOnce(error).mockResolvedValueOnce(combinedResponse);
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));
    await waitFor(() => expect(mockDynamicForm).toHaveBeenCalled());
    const validInput: SubmitFormAnswersInput = {
      scope: 'POST_ATTENDANCE',
      answers: [{ formBlockId: 'block_1', textValue: 'Great event', numberValue: 9 }],
    };
    let formProps: DynamicFormProps = mockDynamicForm.mock.calls.at(-1)?.[0] as DynamicFormProps;

    await act(async (): Promise<void> => {
      await formProps.onSubmit(validInput);
    });

    await waitFor(() => expect(screen.getByText('Required field "How was the venue?" is missing')).toBeTruthy());
    expect(mockDynamicForm).toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.dismiss).not.toHaveBeenCalled();

    formProps = mockDynamicForm.mock.calls.at(-1)?.[0] as DynamicFormProps;
    await act(async (): Promise<void> => {
      await formProps.onSubmit(validInput);
    });

    await waitFor(() => expect(mockSubmitFeedback).toHaveBeenCalledTimes(2));
    expect(mockSubmitFeedback.mock.calls[0]).toEqual([
      { ganapId: 'g1', input: { rating: 5, answers: [{ formBlockId: 'block_1', textValue: 'Great event' }] } },
    ]);
    expect(mockSubmitFeedback.mock.calls[1]).toEqual([
      { ganapId: 'g1', input: { rating: 5, answers: [{ formBlockId: 'block_1', textValue: 'Great event' }] } },
    ]);
  });

  it('keeps the form available after a rating conflict, refetches, and clears the held rating', async (): Promise<void> => {
    resetStates(['rating', 'form']);
    const conflict = codedError('The rating was already submitted', ErrorCodes.FEEDBACK_RATING_CONFLICT);
    mockSubmitFeedback.mockRejectedValueOnce(conflict).mockResolvedValueOnce(combinedResponse);
    mockRefetch.mockImplementationOnce(async (): Promise<unknown> => {
      if (mockFeedbackState.ganap !== undefined) mockFeedbackState.ganap.myRating = 5;
      return undefined;
    });
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));
    await waitFor(() => expect(mockDynamicForm).toHaveBeenCalled());
    const validInput: SubmitFormAnswersInput = {
      scope: 'POST_ATTENDANCE',
      answers: [{ formBlockId: 'block_1', textValue: 'Great event', numberValue: 9 }],
    };
    let formProps: DynamicFormProps = mockDynamicForm.mock.calls.at(-1)?.[0] as DynamicFormProps;

    await act(async (): Promise<void> => {
      await formProps.onSubmit(validInput);
    });

    await waitFor(() => expect(screen.getByText('Your rating was already submitted and cannot be changed.')).toBeTruthy());
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockDynamicForm).toHaveBeenCalled();

    formProps = mockDynamicForm.mock.calls.at(-1)?.[0] as DynamicFormProps;
    await act(async (): Promise<void> => {
      await formProps.onSubmit(validInput);
    });

    await waitFor(() => expect(mockSubmitFeedback).toHaveBeenCalledTimes(2));
    expect(mockSubmitFeedback.mock.calls[1]).toEqual([
      { ganapId: 'g1', input: { answers: [{ formBlockId: 'block_1', textValue: 'Great event' }] } },
    ]);
  });

  it('keeps entered answers and the conflict retry surface when refetch fails', async (): Promise<void> => {
    resetStates(['rating', 'form']);
    const conflict = codedError('The rating was already submitted', ErrorCodes.FEEDBACK_RATING_CONFLICT);
    const refetchError = new Error('Unable to refresh feedback');
    mockSubmitFeedback.mockRejectedValue(conflict);
    mockRefetch.mockImplementationOnce(async (): Promise<unknown> => {
      mockFeedbackState.error = refetchError;
      throw refetchError;
    });
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));
    await waitFor(() => expect(mockDynamicForm).toHaveBeenCalled());
    const validInput: SubmitFormAnswersInput = {
      scope: 'POST_ATTENDANCE',
      answers: [{ formBlockId: 'block_1', textValue: 'Great event', numberValue: 9 }],
    };
    let formProps: DynamicFormProps = mockDynamicForm.mock.calls.at(-1)?.[0] as DynamicFormProps;

    await act(async (): Promise<void> => {
      try {
        await formProps.onSubmit(validInput);
      } catch {
        // The pre-fix route leaked a rejected refetch through this callback.
      }
    });
    expect(screen.getByText('Share your feedback')).toBeTruthy();
    expect(screen.getByText('Great event')).toBeTruthy();
    expect(screen.getByText('Your rating was already submitted and cannot be changed.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit mocked form' })).toBeTruthy();

    mockRefetch.mockImplementationOnce(async (): Promise<unknown> => {
      mockFeedbackState.error = null;
      return undefined;
    });
    formProps = mockDynamicForm.mock.calls.at(-1)?.[0] as DynamicFormProps;
    await act(async (): Promise<void> => {
      await formProps.onSubmit(validInput);
    });

    expect(mockSubmitFeedback).toHaveBeenCalledTimes(2);
    expect(mockSubmitFeedback.mock.calls[1]).toEqual([
      { ganapId: 'g1', input: { answers: [{ formBlockId: 'block_1', textValue: 'Great event' }] } },
    ]);
    await waitFor(() => expect(screen.getByText('Your rating was already submitted and cannot be changed.')).toBeTruthy());
    screen.unmount();
  });

  it('refetches and leaves through the fallback for FEEDBACK_NOT_ELIGIBLE', async (): Promise<void> => {
    resetStates(['rating']);
    const notEligible = codedError('Not eligible', ErrorCodes.FEEDBACK_NOT_ELIGIBLE);
    mockSubmitFeedback.mockRejectedValueOnce(notEligible);
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));

    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mapFeedbackError(notEligible)).toEqual({
      kind: 'not-eligible',
      title: 'Feedback unavailable',
      message: 'You must attend this event before submitting feedback.',
    });
  });

  it('keeps the form and shows exact required and unknown-code feedback copy', async (): Promise<void> => {
    resetStates(['form']);
    mockSubmitFeedback.mockRejectedValueOnce(codedError('server detail', ErrorCodes.FEEDBACK_RATING_REQUIRED));
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked form' }));
    await waitFor(() => expect(screen.getByText('Choose a rating before submitting feedback.')).toBeTruthy());
    expect(mockDynamicForm).toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();

    mockSubmitFeedback.mockRejectedValueOnce(codedError('server detail', 'OTHER_CODE'));
    const formProps: DynamicFormProps = mockDynamicForm.mock.calls.at(-1)?.[0] as DynamicFormProps;
    await act(async (): Promise<void> => {
      await formProps.onSubmit(formAnswersWithLegacyFields);
    });
    await waitFor(() => expect(screen.getByText('Feedback could not be submitted. Please try again.')).toBeTruthy());
  });

  it('rejects an out-of-range score before it reaches the API', async (): Promise<void> => {
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit invalid rating' }));

    expect(mockSubmitFeedback).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Choose a rating between 1 and 5 stars.')).toBeTruthy());
  });

  it('offers a way out instead of stranding the student on a not-eligible response', async (): Promise<void> => {
    resetStates(['rating']);
    mockSubmitFeedback.mockRejectedValueOnce(codedError('Not eligible', ErrorCodes.FEEDBACK_NOT_ELIGIBLE));
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(screen.queryByText('Feedback unavailable')).toBeNull();
  });

  it('falls back to the Event Hub when there is nothing to go back to', async (): Promise<void> => {
    mockRouter.canGoBack.mockReturnValue(false);
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Leave from mocked rating' }));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/(app)/(home)/event-hub/[ganap-id]',
      params: { 'ganap-id': 'g1' },
    });
  });

  it('asks before discarding dirty form answers and honors both choices', async (): Promise<void> => {
    resetStates(['form']);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((): void => {});
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Mark form dirty' }));
    await waitFor(() => expect(mockDynamicForm).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByRole('button', { name: 'Back from mocked form' }));

    expect(alert).toHaveBeenCalledWith('Discard your answers?', 'Your answers will not be saved.', expect.any(Array));
    const buttons = alert.mock.calls[0]?.[2];
    expect(buttons?.[0]?.text).toBe('Keep editing');
    expect(buttons?.[1]?.text).toBe('Discard');
    buttons?.[0]?.onPress?.();
    expect(mockRouter.back).not.toHaveBeenCalled();
    buttons?.[1]?.onPress?.();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('leaves immediately when nothing is pending', async (): Promise<void> => {
    resetStates([]);

    await renderRoute();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(mockRatingStep).not.toHaveBeenCalled();
    expect(mockDynamicForm).not.toHaveBeenCalled();
  });
});
