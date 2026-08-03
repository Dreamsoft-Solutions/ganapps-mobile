import type { FormBlock, FormOption, RegistrationFormData, SubmitFormAnswersInput } from '@/types/ganap.types';
import {
  buildRegistrationFormDefaults,
  buildSubmitFormAnswersInput,
  getScaleConfiguration,
  getScaleOptions,
  getTextConfiguration,
} from './registration-form';

const baseOption: FormOption = {
  id: 'option_1',
  label: 'Option one',
  value: 'one',
  order: 1,
};

const baseBlock: FormBlock = {
  id: 'block_1',
  ganapId: 'g1',
  scope: 'REGISTRATION',
  type: 'TEXT',
  label: 'Question',
  isRequired: false,
  allowMultiple: false,
  order: 1,
  config: null,
  options: [baseOption],
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

function makeBlock(overrides: Partial<FormBlock>): FormBlock {
  return { ...baseBlock, ...overrides };
}

function makeScaleBlock(config: Record<string, unknown> | null | undefined): FormBlock {
  return makeBlock({ type: 'SCALE', config });
}

describe('registration form configuration', () => {
  it('builds discrete scale options from a valid configuration', () => {
    const block = makeScaleBlock({ min: 0, max: 10, step: 2, minLabel: 'Low', maxLabel: 'High' });

    expect(getScaleConfiguration(block)).toEqual({ min: 0, max: 10, step: 2, minLabel: 'Low', maxLabel: 'High' });
    expect(getScaleOptions(block)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it.each([
    undefined,
    null,
    {},
    { min: '0', max: 5, step: 1 },
    { min: Number.NaN, max: 5, step: 1 },
    { min: 1, max: 5, step: 0 },
    { min: 1, max: 5, step: -1 },
    { min: 5, max: 1, step: 1 },
  ])('falls back to a safe scale for malformed config %j', (config: Record<string, unknown> | null | undefined) => {
    expect(getScaleConfiguration(makeScaleBlock(config))).toEqual({ min: 1, max: 5, step: 1 });
  });

  it('falls back when a scale would produce more than 100 choices', () => {
    const block = makeScaleBlock({ min: 0, max: 100, step: 1 });

    expect(getScaleOptions(block)).toEqual([1, 2, 3, 4, 5]);
  });

  it('accepts only a non-empty placeholder and positive integer max length', () => {
    const validBlock = makeBlock({ config: { placeholder: 'Tell us more', maxLength: 120 } });
    const invalidBlock = makeBlock({ config: { placeholder: '  ', maxLength: 1.5 } });

    expect(getTextConfiguration(validBlock)).toEqual({ placeholder: 'Tell us more', maxLength: 120 });
    expect(getTextConfiguration(invalidBlock)).toEqual({});
  });
});

describe('buildRegistrationFormDefaults', () => {
  it('uses block IDs and type-specific empty values', () => {
    const blocks: FormBlock[] = [
      makeBlock({ id: 'text', type: 'TEXT', order: 3 }),
      makeBlock({ id: 'single', type: 'MULTIPLE_CHOICE', order: 1 }),
      makeBlock({ id: 'multiple', type: 'MULTIPLE_CHOICE', allowMultiple: true, order: 2 }),
      makeBlock({ id: 'scale', type: 'SCALE', order: 4 }),
    ];

    expect(buildRegistrationFormDefaults(blocks)).toEqual<RegistrationFormData>({
      answers: { text: '', single: '', multiple: [], scale: null },
    });
  });
});

describe('buildSubmitFormAnswersInput', () => {
  it('maps trimmed answers in block order without number values', () => {
    const blocks: FormBlock[] = [
      makeBlock({ id: 'scale', type: 'SCALE', order: 4 }),
      makeBlock({ id: 'multiple', type: 'MULTIPLE_CHOICE', allowMultiple: true, order: 3 }),
      makeBlock({ id: 'single', type: 'MULTIPLE_CHOICE', order: 2 }),
      makeBlock({ id: 'text', type: 'TEXT', order: 1 }),
    ];
    const data: RegistrationFormData = {
      answers: {
        text: '  To learn.  ',
        single: 'option_1',
        multiple: ['option_2', 'option_3'],
        scale: 0,
      },
    };

    const result: SubmitFormAnswersInput = buildSubmitFormAnswersInput(blocks, data);

    expect(result).toEqual({
      answers: [
        { formBlockId: 'text', textValue: 'To learn.' },
        { formBlockId: 'single', selectedOptionIds: ['option_1'] },
        { formBlockId: 'multiple', selectedOptionIds: ['option_2', 'option_3'] },
        { formBlockId: 'scale', scaleValue: 0 },
      ],
    });
    expect(result.answers.every((answer) => !('numberValue' in answer))).toBe(true);
  });

  it('omits unanswered optional blocks', () => {
    const blocks: FormBlock[] = [
      makeBlock({ id: 'text', type: 'TEXT', order: 1 }),
      makeBlock({ id: 'single', type: 'MULTIPLE_CHOICE', order: 2 }),
      makeBlock({ id: 'multiple', type: 'MULTIPLE_CHOICE', allowMultiple: true, order: 3 }),
      makeBlock({ id: 'scale', type: 'SCALE', order: 4 }),
    ];
    const data: RegistrationFormData = {
      answers: { text: '   ', single: '', multiple: [], scale: null },
    };

    expect(buildSubmitFormAnswersInput(blocks, data)).toEqual({ answers: [] });
  });
});
