// Tests for src/app/(app)/(home)/feedback/[ganap-id].tsx live here rather than
// beside it: any .test.tsx under src/app/ is picked up by Expo Router as a route.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';
import type { DynamicFormProps } from '@/components/forms/DynamicForm';
import type { RatingStepProps } from '@/components/ganaps/RatingStep';
import type { UseGanapFeedbackResult } from '@/hooks/useGanapFeedback';
import type { FormBlock, GanapDetail, GanapRating, JoinGanapResult, SubmitFormAnswersInput } from '@/types/ganap.types';
import type { FeedbackStep } from '@/utils/feedback';

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

const mockSubmitRating = jest.fn<(variables: { ganapId: string; input: { score: number } }) => Promise<GanapRating>>();
const mockSubmitForm =
  jest.fn<(variables: { ganapId: string; input: SubmitFormAnswersInput }) => Promise<JoinGanapResult>>();
const mockRefetch = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);

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
  },
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
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

function resetStates(pendingSteps: FeedbackStep[]): void {
  mockFeedbackState = {
    ganap: mockGanap,
    blocks: pendingSteps.includes('form') ? [block] : [],
    pendingSteps,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    submitRating: mockSubmitRating as UseGanapFeedbackResult['submitRating'],
    isRating: false,
    ratingError: null,
    submitForm: mockSubmitForm as UseGanapFeedbackResult['submitForm'],
    isSubmittingForm: false,
    formError: null,
  };

  mockRatingStep.mockImplementation(
    (props: RatingStepProps): ReactElement => (
      <MockView>
        <MockText>{props.ganapTitle}</MockText>
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Submit mocked rating"
          onPress={(): void => {
            void props.onSubmit(5);
          }}
        />
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Submit invalid rating"
          onPress={(): void => {
            void props.onSubmit(0);
          }}
        />
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
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Submit mocked form"
          onPress={(): void => {
            void props.onSubmit({ answers: [] });
          }}
        />
      </MockView>
    ),
  );
}

beforeEach((): void => {
  resetStates(['rating', 'form']);
  mockRouter.canDismiss.mockReturnValue(false);
  mockRouter.canGoBack.mockReturnValue(true);
});

afterEach((): void => {
  jest.clearAllMocks();
});

describe('feedback route step resolution', (): void => {
  it('renders the rating step when a rating is pending', async (): Promise<void> => {
    const screen = await renderRoute();

    expect(mockRatingStep).toHaveBeenCalled();
    expect(screen.getByText('Coffee & Code')).toBeTruthy();
    expect(mockDynamicForm).not.toHaveBeenCalled();
  });

  it('submits the score and advances to the form step', async (): Promise<void> => {
    mockSubmitRating.mockResolvedValueOnce({
      id: 'rating_1',
      ganapId: 'g1',
      userId: 'u1',
      rating: 5,
      comment: null,
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z',
    });
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));

    await waitFor(() => expect(mockDynamicForm).toHaveBeenCalled());
    expect(mockSubmitRating).toHaveBeenCalledWith({ ganapId: 'g1', input: { score: 5 } });
  });

  it('treats "Already rated this event" as completion, not an error', async (): Promise<void> => {
    mockSubmitRating.mockRejectedValueOnce(new Error('Already rated this event'));
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));

    await waitFor(() => expect(mockDynamicForm).toHaveBeenCalled());
    expect(screen.queryByText('Already rated this event')).toBeNull();
    expect(screen.queryByText('You have already rated this event.')).toBeNull();
  });

  it('submits form answers with scope POST_ATTENDANCE', async (): Promise<void> => {
    resetStates(['form']);
    mockSubmitForm.mockResolvedValueOnce({
      id: 'registration_1',
      userId: 'u1',
      ganapId: 'g1',
      status: 'ATTENDED',
      createdAt: '2026-08-18T00:00:00.000Z',
    });
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked form' }));

    await waitFor(() => expect(mockSubmitForm).toHaveBeenCalled());
    expect(mockSubmitForm).toHaveBeenCalledWith({
      ganapId: 'g1',
      input: { answers: [], scope: 'POST_ATTENDANCE' },
    });
  });

  it('rejects an out-of-range score before it reaches the API', async (): Promise<void> => {
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit invalid rating' }));

    expect(mockSubmitRating).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Choose a rating between 1 and 5 stars.')).toBeTruthy());
  });

  it('offers a way out instead of stranding the student on a not-found', async (): Promise<void> => {
    mockSubmitRating.mockRejectedValueOnce(new Error('Event not found'));
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked rating' }));

    await waitFor(() => expect(screen.getByText('Feedback unavailable')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Back to event' }));
    expect(mockRouter.back).toHaveBeenCalled();
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

  it('leaves immediately when nothing is pending', async (): Promise<void> => {
    resetStates([]);

    await renderRoute();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(mockRatingStep).not.toHaveBeenCalled();
    expect(mockDynamicForm).not.toHaveBeenCalled();
  });
});
