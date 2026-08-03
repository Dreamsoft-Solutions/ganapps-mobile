import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { FormBlock } from '@/types/ganap.types';
import type { RegistrationFormProps } from './RegistrationForm';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  Circle: (): null => null,
  CircleCheck: (): null => null,
  LucideProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
  Square: (): null => null,
  SquareCheck: (): null => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 24,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('@/hooks/useResolvedTheme', () => ({ useResolvedTheme: (): 'light' => 'light' }));

import { RegistrationForm } from './RegistrationForm';

const textBlock: FormBlock = {
  id: 'block_text',
  ganapId: 'g1',
  scope: 'REGISTRATION',
  type: 'TEXT',
  label: 'Why do you want to attend?',
  isRequired: true,
  allowMultiple: false,
  order: 1,
  config: { placeholder: 'Tell us briefly', maxLength: 120 },
  options: [],
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const singleChoiceBlock: FormBlock = {
  id: 'block_single',
  ganapId: 'g1',
  scope: 'REGISTRATION',
  type: 'MULTIPLE_CHOICE',
  label: 'Which session?',
  isRequired: true,
  allowMultiple: false,
  order: 2,
  config: null,
  options: [
    { id: 'option_no', label: 'Afternoon', value: 'afternoon', order: 2 },
    { id: 'option_yes', label: 'Morning', value: 'morning', order: 1 },
  ],
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const multipleChoiceBlock: FormBlock = {
  id: 'block_multiple',
  ganapId: 'g1',
  scope: 'REGISTRATION',
  type: 'MULTIPLE_CHOICE',
  label: 'Which topics interest you?',
  isRequired: false,
  allowMultiple: true,
  order: 3,
  config: null,
  options: [
    { id: 'option_food', label: 'Food', value: 'food', order: 2 },
    { id: 'option_campus', label: 'Campus life', value: 'campus', order: 1 },
  ],
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const scaleBlock: FormBlock = {
  id: 'block_scale',
  ganapId: 'g1',
  scope: 'REGISTRATION',
  type: 'SCALE',
  label: 'How excited are you?',
  isRequired: true,
  allowMultiple: false,
  order: 4,
  config: { min: 0, max: 2, step: 1, minLabel: 'Not yet', maxLabel: 'Very excited' },
  options: [],
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const blocks: FormBlock[] = [scaleBlock, multipleChoiceBlock, singleChoiceBlock, textBlock];

async function renderRegistrationForm(
  overrides: Partial<RegistrationFormProps> = {},
): Promise<Awaited<ReturnType<typeof render>>> {
  const onSubmit: RegistrationFormProps['onSubmit'] = jest.fn<RegistrationFormProps['onSubmit']>().mockResolvedValue();
  const onDirtyChange = jest.fn<(isDirty: boolean) => void>();

  return await render(
    <RegistrationForm
      ganapTitle="Coffee & Code"
      blocks={blocks}
      isSubmitting={false}
      submissionError={null}
      onBack={(): void => {}}
      onDirtyChange={onDirtyChange}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
}

describe('RegistrationForm dynamic fields', (): void => {
  it('keeps the header content below the top safe-area boundary', async (): Promise<void> => {
    const screen = await renderRegistrationForm({ blocks: [textBlock] });
    const title = screen.getByRole('header', { name: 'Complete registration' });
    const safeAreaContainer = title.parent?.parent?.parent;

    expect(StyleSheet.flatten(safeAreaContainer?.props.style)).toMatchObject({ paddingTop: 36 });
  });

  it('renders blocks in server order', async (): Promise<void> => {
    const screen = await renderRegistrationForm();

    expect(screen.getAllByTestId(/^registration-question-/).map((question) => question.props.testID)).toEqual([
      'registration-question-block_text',
      'registration-question-block_single',
      'registration-question-block_multiple',
      'registration-question-block_scale',
    ]);
  });

  it('uses bold labels and increased spacing between questions', async (): Promise<void> => {
    const screen = await renderRegistrationForm();
    const firstQuestion = screen.getByTestId('registration-question-block_text');
    const questionLabel = screen.getByText(textBlock.label);
    const questionLabelClassName = questionLabel.props.className;

    expect(StyleSheet.flatten(questionLabel.props.style)).toMatchObject({ fontFamily: 'Inter-Bold' });
    expect(questionLabelClassName).toEqual(expect.stringContaining('text-lg'));
    expect(questionLabelClassName).toEqual(expect.stringContaining('leading-7'));
    expect(questionLabelClassName).not.toEqual(expect.stringContaining('text-headline-sm'));
    expect(firstQuestion.parent?.props.className).toEqual(expect.stringContaining('gap-xl'));
  });

  it('centers the scale option row', async (): Promise<void> => {
    const screen = await renderRegistrationForm({ blocks: [scaleBlock] });
    const scaleOptionRow = screen.getByRole('radio', { name: '0' }).parent;

    expect(scaleOptionRow?.props.className).toEqual(expect.stringContaining('justify-center'));
  });

  it('exposes required labels as accessible copy', async (): Promise<void> => {
    const screen = await renderRegistrationForm();

    expect(screen.getAllByText('Required')).toHaveLength(3);
  });

  it('uses the valid text configuration and shows its required error', async (): Promise<void> => {
    const screen = await renderRegistrationForm({ blocks: [textBlock] });
    const input = screen.getByPlaceholderText('Tell us briefly');

    expect(input.props.maxLength).toBe(120);
    await fireEvent.press(screen.getByRole('button', { name: 'Submit registration' }));

    await waitFor(() => expect(screen.getByText('This question is required')).toBeTruthy());
  });

  it('renders single-choice rows with radio semantics and checked state', async (): Promise<void> => {
    const screen = await renderRegistrationForm({ blocks: [singleChoiceBlock] });
    const morning = screen.getByRole('radio', { name: 'Morning' });

    expect(morning.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(morning);
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Morning' }).props.accessibilityState.checked).toBe(true),
    );
  });

  it('toggles multiple-choice rows independently with checkbox semantics', async (): Promise<void> => {
    const screen = await renderRegistrationForm({ blocks: [multipleChoiceBlock] });
    const campus = screen.getByRole('checkbox', { name: 'Campus life' });
    const food = screen.getByRole('checkbox', { name: 'Food' });

    await fireEvent.press(campus);
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Campus life' }).props.accessibilityState.checked).toBe(true),
    );
    await fireEvent.press(food);
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Food' }).props.accessibilityState.checked).toBe(true),
    );

    expect(screen.getByRole('checkbox', { name: 'Campus life' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Food' }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Campus life' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Campus life' }).props.accessibilityState.checked).toBe(false),
    );
    expect(screen.getByRole('checkbox', { name: 'Food' }).props.accessibilityState.checked).toBe(true);
  });

  it('renders endpoint labels and a configured zero scale value as a radio', async (): Promise<void> => {
    const screen = await renderRegistrationForm({ blocks: [scaleBlock] });

    expect(screen.getByText('Not yet')).toBeTruthy();
    expect(screen.getByText('Very excited')).toBeTruthy();
    const zero = screen.getByRole('radio', { name: '0' });
    expect(zero.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(zero);
    await waitFor(() => expect(screen.getByRole('radio', { name: '0' }).props.accessibilityState.checked).toBe(true));
  });

  it('gives choice controls the required touch target and spacing classes', async (): Promise<void> => {
    const screen = await renderRegistrationForm({ blocks: [singleChoiceBlock] });
    const morning = screen.getByRole('radio', { name: 'Morning' });

    expect(morning.props.className).toEqual(expect.stringContaining('min-h-11'));
    expect(morning.props.className).toEqual(expect.stringContaining('min-w-11'));
    expect(morning.props.className).toEqual(expect.stringContaining('gap-xs'));
  });
});

describe('RegistrationForm submission', (): void => {
  it('submits mapped values from all supported field types', async (): Promise<void> => {
    const onSubmit: RegistrationFormProps['onSubmit'] = jest
      .fn<RegistrationFormProps['onSubmit']>()
      .mockResolvedValue();
    const screen = await renderRegistrationForm({ onSubmit });

    await fireEvent.changeText(screen.getByPlaceholderText('Tell us briefly'), '  I want to learn. ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Morning' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Campus life' }));
    await fireEvent.press(screen.getByRole('radio', { name: '0' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Submit registration' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        answers: [
          { formBlockId: 'block_text', textValue: 'I want to learn.' },
          { formBlockId: 'block_single', selectedOptionIds: ['option_yes'] },
          { formBlockId: 'block_multiple', selectedOptionIds: ['option_campus'] },
          { formBlockId: 'block_scale', scaleValue: 0 },
        ],
      }),
    );
  });

  it('retains entered values and shows a submission error after retry failure', async (): Promise<void> => {
    const onSubmit: RegistrationFormProps['onSubmit'] = jest
      .fn<RegistrationFormProps['onSubmit']>()
      .mockRejectedValue(new Error('Server unavailable'));
    const screen = await renderRegistrationForm({ blocks: [textBlock], onSubmit });
    const input = screen.getByPlaceholderText('Tell us briefly');

    await fireEvent.changeText(input, 'Keep this answer');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit registration' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());

    await screen.rerender(
      <RegistrationForm
        ganapTitle="Coffee & Code"
        blocks={[textBlock]}
        isSubmitting={false}
        submissionError={new Error('Server unavailable')}
        onBack={(): void => {}}
        onDirtyChange={(): void => {}}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => expect(screen.getByText('Server unavailable')).toBeTruthy());
    expect(screen.getByPlaceholderText('Tell us briefly').props.value).toBe('Keep this answer');
  });

  it('reports dirty state after the first edit', async (): Promise<void> => {
    const onDirtyChange = jest.fn<(isDirty: boolean) => void>();
    const screen = await renderRegistrationForm({ blocks: [textBlock], onDirtyChange });

    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(false));
    onDirtyChange.mockClear();
    await fireEvent.changeText(screen.getByPlaceholderText('Tell us briefly'), 'Changed');

    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true));
  });

  it('marks the submit action busy and disabled while submitting', async (): Promise<void> => {
    const screen = await renderRegistrationForm({ isSubmitting: true });
    const submit = screen.getByRole('button', { name: 'Submit registration' });

    expect(submit.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });
});
