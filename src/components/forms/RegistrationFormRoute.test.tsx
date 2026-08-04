import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import type { HardwareBackPressEvent } from 'react-native';
import { Alert, BackHandler, Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { FormBlock, GanapDetail, SubmitFormAnswersInput } from '@/types/ganap.types';

interface MockRegistrationFormProps {
  ganapTitle: string;
  blocks: FormBlock[];
  isSubmitting: boolean;
  submissionError: Error | null;
  onBack: () => void;
  onDirtyChange: (isDirty: boolean) => void;
  onSubmit: (input: SubmitFormAnswersInput) => Promise<void>;
}

const mockRouter = { back: jest.fn<() => void>() };
const mockParams: { 'ganap-id': string } = { 'ganap-id': 'g1' };
const mockRegistrationForm = jest.fn(
  (props: MockRegistrationFormProps): ReactElement => (
    <MockView>
      <MockText>{props.ganapTitle}</MockText>
      <MockText>{props.blocks[0]?.label}</MockText>
      {props.submissionError && <MockText>{props.submissionError.message}</MockText>}
      <MockPressable
        accessibilityRole="button"
        accessibilityLabel="Mark form dirty"
        onPress={(): void => props.onDirtyChange(true)}
      />
      <MockPressable accessibilityRole="button" accessibilityLabel="Back from form" onPress={props.onBack} />
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

const mockDetailRefetch = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
const mockBlocksRefetch = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
const mockSubmit = jest.fn<(variables: { ganapId: string; input: SubmitFormAnswersInput }) => Promise<unknown>>();
const mockBlock: FormBlock = {
  id: 'block_text',
  ganapId: 'g1',
  scope: 'REGISTRATION',
  type: 'TEXT',
  label: 'Why do you want to attend?',
  isRequired: true,
  allowMultiple: false,
  order: 1,
  config: null,
  options: [],
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const mockGanap: GanapDetail = {
  id: 'g1',
  businessId: 'b1',
  businessName: 'CPU Developers',
  slug: 'coffee-and-code',
  title: 'Coffee & Code',
  description: 'Bring a laptop.',
  address: 'Student Union',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T05:00:00.000Z',
  status: 'PUBLISHED',
  requiresApproval: false,
  maxAttendees: 20,
  tags: ['study'],
  coverImage: null,
  bannerImage: null,
  mapPinImage: null,
  registrationCount: 5,
  likesCount: 0,
  averageRating: null,
  ratingCount: 0,
  isLiked: false,
  isSaved: false,
  myRegistration: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

let mockDetailState: {
  data: GanapDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: typeof mockDetailRefetch;
};
let mockRegistrationState: {
  blocks: FormBlock[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: typeof mockBlocksRefetch;
  submit: typeof mockSubmit;
  isSubmitting: boolean;
  submitError: Error | null;
};
let hardwareBackHandler: (() => boolean) | undefined;

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

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  return {
    LucideProvider: ({ children }: { children: React.ReactNode }): React.ReactElement =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@/components/common/Error', () => ({
  ErrorView: ({ error, onRetry }: { error: Error | null; onRetry?: () => void }): ReactElement => (
    <MockView>
      <MockText>{error?.message}</MockText>
      {onRetry && <MockPressable accessibilityRole="button" accessibilityLabel="Try Again" onPress={onRetry} />}
    </MockView>
  ),
}));

jest.mock('@/components/common/Loading', () => ({
  Loading: (): ReactElement => <MockText>Loading</MockText>,
}));

jest.mock('@/components/forms/RegistrationForm', () => ({
  RegistrationForm: (props: MockRegistrationFormProps): ReactElement => mockRegistrationForm(props),
}));

jest.mock('@/hooks/queries/useGanapsQuery', () => ({
  ganapQueryKeys: { detail: (ganapId: string): readonly string[] => ['ganaps', 'detail', ganapId] },
  useGanapDetailQuery: (): typeof mockDetailState => mockDetailState,
}));

jest.mock('@/hooks/useGanapRegistration', () => ({
  useGanapRegistration: (): typeof mockRegistrationState => mockRegistrationState,
}));

jest.mock('@/api/endpoints/ganaps', () => ({ ganapsAPI: { getById: jest.fn() } }));

import RegistrationFormRoute from '@/app/(app)/(home)/registration/[ganap-id]';

function queryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
}

async function renderRoute(client: QueryClient = queryClient()): Promise<Awaited<ReturnType<typeof render>>> {
  return await render(
    <QueryClientProvider client={client}>
      <RegistrationFormRoute />
    </QueryClientProvider>,
  );
}

function resetStates(): void {
  mockDetailState = {
    data: mockGanap,
    isLoading: false,
    error: null,
    refetch: mockDetailRefetch,
  };
  mockRegistrationState = {
    blocks: [mockBlock],
    isLoading: false,
    error: null,
    refetch: mockBlocksRefetch,
    submit: mockSubmit,
    isSubmitting: false,
    submitError: null,
  };
  hardwareBackHandler = undefined;
}

afterEach((): void => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  resetStates();
});

beforeEach((): void => {
  resetStates();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation(
      (
        _eventName: 'hardwareBackPress',
        handler: (event: HardwareBackPressEvent) => boolean | null | undefined,
      ): { remove: () => void } => {
        hardwareBackHandler = (): boolean => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true;
        return { remove: (): void => {} };
      },
    );
});

describe('registration form route orchestration', (): void => {
  it('renders loading while detail or blocks are loading', async (): Promise<void> => {
    mockDetailState.isLoading = true;

    expect((await renderRoute()).getByText('Loading')).toBeTruthy();
  });

  it('renders the failed request with retry', async (): Promise<void> => {
    const error: Error = new Error('Unable to load form');
    mockRegistrationState.error = error;

    const screen = await renderRoute();
    await fireEvent.press(screen.getByRole('button', { name: 'Try Again' }));

    expect(screen.getByText('Unable to load form')).toBeTruthy();
    expect(mockBlocksRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders a recoverable empty-form state', async (): Promise<void> => {
    mockRegistrationState.blocks = [];

    const screen = await renderRoute();

    expect(screen.getByText('Registration form unavailable')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try Again' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back to event' }));
    expect(mockBlocksRefetch).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('passes the loaded Ganap title and blocks to the form', async (): Promise<void> => {
    await renderRoute();

    expect(mockRegistrationForm).toHaveBeenCalledWith(
      expect.objectContaining({ ganapTitle: 'Coffee & Code', blocks: [mockBlock] }),
    );
  });

  it('refreshes detail before navigating after a successful submit', async (): Promise<void> => {
    mockSubmit.mockResolvedValueOnce({ status: 'REGISTERED' });
    jest.mocked(ganapsAPI.getById).mockResolvedValueOnce(mockGanap);
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked form' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));

    expect(mockSubmit).toHaveBeenCalledWith({ ganapId: 'g1', input: { answers: [] } });
    expect(ganapsAPI.getById).toHaveBeenCalledWith('g1');
    expect(mockSubmit.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(ganapsAPI.getById).mock.invocationCallOrder[0],
    );
  });

  it('reports a detail refresh failure after submission before returning', async (): Promise<void> => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((): void => {});
    mockSubmit.mockResolvedValueOnce({ status: 'REGISTERED' });
    jest.mocked(ganapsAPI.getById).mockRejectedValueOnce(new Error('Unable to refresh event'));
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Submit mocked form' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Registration submitted',
        'Your answers were submitted, but the event details could not be refreshed. Please try again.',
        expect.any(Array),
      ),
    );

    expect(mockRouter.back).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2];
    buttons?.[0]?.onPress?.();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('passes submission failures to the form and does not navigate', async (): Promise<void> => {
    const error: Error = new Error('Unable to submit answers');
    mockRegistrationState.submitError = error;

    const screen = await renderRoute();

    expect(screen.getByText('Unable to submit answers')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('ignores back navigation while submission is pending', async (): Promise<void> => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((): void => {});
    mockRegistrationState.isSubmitting = true;
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Back from form' }));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('backs immediately when the form is clean', async (): Promise<void> => {
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Back from form' }));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('asks before discarding dirty answers and honors both choices', async (): Promise<void> => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((): void => {});
    const screen = await renderRoute();
    await fireEvent.press(screen.getByRole('button', { name: 'Mark form dirty' }));
    await waitFor(() => expect(mockRegistrationForm).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByRole('button', { name: 'Back from form' }));

    expect(alert).toHaveBeenCalledWith('Discard your answers?', 'Your answers will not be saved.', expect.any(Array));
    const buttons = alert.mock.calls[0]?.[2];
    expect(buttons?.[0]?.text).toBe('Keep editing');
    expect(buttons?.[1]?.text).toBe('Discard');
    buttons?.[0]?.onPress?.();
    expect(mockRouter.back).not.toHaveBeenCalled();
    buttons?.[1]?.onPress?.();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('uses the same dirty-aware handler for Android back', async (): Promise<void> => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((): void => {});
    const screen = await renderRoute();
    await fireEvent.press(screen.getByRole('button', { name: 'Mark form dirty' }));
    await waitFor(() => expect(mockRegistrationForm).toHaveBeenCalledTimes(2));

    expect(hardwareBackHandler?.()).toBe(true);
    expect(alert).toHaveBeenCalledWith('Discard your answers?', 'Your answers will not be saved.', expect.any(Array));
  });
});
