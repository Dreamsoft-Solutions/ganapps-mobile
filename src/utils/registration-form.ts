import type {
  FormBlock,
  RegistrationFormAnswerValue,
  RegistrationFormData,
  SubmitFormAnswersInput,
} from '@/types/ganap.types';

const DEFAULT_SCALE: ScaleConfiguration = { min: 1, max: 5, step: 1 };
const MAX_SCALE_OPTIONS: number = 100;

interface ValidScaleRange {
  min: number;
  max: number;
  step: number;
}

/** Configuration used to render a discrete scale question. */
export interface ScaleConfiguration {
  min: number;
  max: number;
  step: number;
  minLabel?: string;
  maxLabel?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getConfig(block: FormBlock): Record<string, unknown> {
  return isRecord(block.config) ? block.config : {};
}

function getDefaultScale(): ScaleConfiguration {
  return { ...DEFAULT_SCALE };
}

function hasValidScaleRange(config: Record<string, unknown>): config is Record<string, unknown> & ValidScaleRange {
  const min: unknown = config.min;
  const max: unknown = config.max;
  const step: unknown = config.step;

  return isFiniteNumber(min) && isFiniteNumber(max) && isFiniteNumber(step) && step > 0 && max >= min;
}

function getScaleLabels(config: Record<string, unknown>): Pick<ScaleConfiguration, 'minLabel' | 'maxLabel'> {
  const labels: Pick<ScaleConfiguration, 'minLabel' | 'maxLabel'> = {};

  if (typeof config.minLabel === 'string' && config.minLabel.trim().length > 0) {
    labels.minLabel = config.minLabel;
  }
  if (typeof config.maxLabel === 'string' && config.maxLabel.trim().length > 0) {
    labels.maxLabel = config.maxLabel;
  }

  return labels;
}

/**
 * Reads and validates the scale configuration supplied by an organizer.
 *
 * @param block - Scale block whose configuration should be parsed
 * @returns A safe scale configuration, falling back when the server value is malformed
 */
export function getScaleConfiguration(block: FormBlock): ScaleConfiguration {
  const config: Record<string, unknown> = getConfig(block);

  if (!hasValidScaleRange(config)) {
    return getDefaultScale();
  }

  const { min, max, step } = config;
  const optionCount: number = Math.floor((max - min) / step) + 1;

  if (!Number.isFinite(optionCount) || optionCount > MAX_SCALE_OPTIONS) {
    return getDefaultScale();
  }

  return { min, max, step, ...getScaleLabels(config) };
}

/**
 * Generates the bounded discrete values for a scale block.
 *
 * @param block - Scale block whose options should be generated
 * @returns Scale values in ascending order
 */
export function getScaleOptions(block: FormBlock): number[] {
  const configuration: ScaleConfiguration = getScaleConfiguration(block);
  const values: number[] = [];

  for (let index: number = 0; index < MAX_SCALE_OPTIONS; index += 1) {
    const value: number = configuration.min + index * configuration.step;

    if (value > configuration.max) {
      break;
    }

    values.push(value);
  }

  return values;
}

/**
 * Reads the supported text-input configuration from a form block.
 *
 * @param block - Text block whose configuration should be parsed
 * @returns Valid placeholder and length settings, if supplied
 */
export function getTextConfiguration(block: FormBlock): { placeholder?: string; maxLength?: number } {
  const config: Record<string, unknown> = getConfig(block);
  const textConfiguration: { placeholder?: string; maxLength?: number } = {};

  if (typeof config.placeholder === 'string' && config.placeholder.trim().length > 0) {
    textConfiguration.placeholder = config.placeholder;
  }
  if (typeof config.maxLength === 'number' && Number.isInteger(config.maxLength) && config.maxLength > 0) {
    textConfiguration.maxLength = config.maxLength;
  }

  return textConfiguration;
}

/**
 * Creates empty form values keyed by the server block IDs.
 *
 * @param blocks - Form blocks to initialize
 * @returns Form values suitable for React Hook Form default values
 */
export function buildRegistrationFormDefaults(blocks: FormBlock[]): RegistrationFormData {
  const answers: Record<string, RegistrationFormAnswerValue> = {};

  for (const block of blocks) {
    if (block.type === 'TEXT' || (block.type === 'MULTIPLE_CHOICE' && !block.allowMultiple)) {
      answers[block.id] = '';
    } else if (block.type === 'MULTIPLE_CHOICE') {
      answers[block.id] = [];
    } else {
      answers[block.id] = null;
    }
  }

  return { answers };
}

function isNonEmptyString(value: RegistrationFormAnswerValue | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSelectedOptionList(value: RegistrationFormAnswerValue | undefined): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((optionId: unknown): optionId is string => typeof optionId === 'string' && optionId.length > 0)
  );
}

/**
 * Maps form values into the server's answer DTO, omitting unanswered blocks.
 *
 * @param blocks - Form blocks that define the answer order and type
 * @param data - Current form values keyed by block ID
 * @returns Server request body sorted by block order
 */
export function buildSubmitFormAnswersInput(blocks: FormBlock[], data: RegistrationFormData): SubmitFormAnswersInput {
  const answers: SubmitFormAnswersInput['answers'] = [];
  const orderedBlocks: FormBlock[] = [...blocks].sort(
    (left: FormBlock, right: FormBlock): number => left.order - right.order,
  );

  for (const block of orderedBlocks) {
    const value: RegistrationFormAnswerValue | undefined = data.answers[block.id];

    if (block.type === 'TEXT' && isNonEmptyString(value)) {
      answers.push({ formBlockId: block.id, textValue: value.trim() });
      continue;
    }

    if (block.type === 'MULTIPLE_CHOICE' && block.allowMultiple && isSelectedOptionList(value)) {
      answers.push({ formBlockId: block.id, selectedOptionIds: [...value] });
      continue;
    }

    if (block.type === 'MULTIPLE_CHOICE' && !block.allowMultiple && isNonEmptyString(value)) {
      answers.push({ formBlockId: block.id, selectedOptionIds: [value] });
      continue;
    }

    if (block.type === 'SCALE' && typeof value === 'number' && Number.isFinite(value)) {
      answers.push({ formBlockId: block.id, scaleValue: value });
    }
  }

  return { answers };
}
