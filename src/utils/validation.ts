import { z } from 'zod';
import type { FormBlock, FormOption, RegistrationFormData } from '@/types/ganap.types';
import { getScaleOptions, getTextConfiguration } from './registration-form';

/** Irreversible account deletion requires this exact phrase after trimming. */
export const deleteAccountSchema = z.object({
  confirmationPhrase: z
    .string()
    .trim()
    .refine((value: string): boolean => value === 'DELETE MY ACCOUNT', {
      message: 'Enter DELETE MY ACCOUNT exactly.',
    }),
});

/** Typed confirmation field for the account deletion form. */
export type DeleteAccountFormData = z.infer<typeof deleteAccountSchema>;

/** Identifier for one password checklist rule. */
export type PasswordRequirementId = 'length' | 'uppercase' | 'lowercase' | 'digit' | 'punctuation';

/** A password rule shared by signup validation and its visible checklist. */
export interface PasswordRequirement {
  id: PasswordRequirementId;
  label: string;
  test: (password: string) => boolean;
}

/** The result of evaluating every password checklist rule. */
export type PasswordRequirementStatus = Record<PasswordRequirementId, boolean>;

const UPPERCASE_PASSWORD_PATTERN: RegExp = /[A-Z]/;
const LOWERCASE_PASSWORD_PATTERN: RegExp = /[a-z]/;
const DIGIT_PASSWORD_PATTERN: RegExp = /\d/;
const PUNCTUATION_PASSWORD_PATTERN: RegExp = /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/;
const PASSWORD_MIN_LENGTH: number = 8;
const PASSWORD_MAX_LENGTH: number = 128;

/** Shared signup password policy used by Zod and the LoginForm checklist. */
export const PASSWORD_POLICY = {
  minLength: PASSWORD_MIN_LENGTH,
  maxLength: PASSWORD_MAX_LENGTH,
  requirements: [
    {
      id: 'length',
      label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
      test: (password: string): boolean =>
        password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter',
      test: (password: string): boolean => UPPERCASE_PASSWORD_PATTERN.test(password),
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter',
      test: (password: string): boolean => LOWERCASE_PASSWORD_PATTERN.test(password),
    },
    {
      id: 'digit',
      label: 'At least one number',
      test: (password: string): boolean => DIGIT_PASSWORD_PATTERN.test(password),
    },
    {
      id: 'punctuation',
      label: 'At least one punctuation mark',
      test: (password: string): boolean => PUNCTUATION_PASSWORD_PATTERN.test(password),
    },
  ] as const satisfies readonly PasswordRequirement[],
} as const;

/**
 * Evaluates the shared password checklist for signup feedback.
 *
 * @param password - Current signup password
 * @returns One boolean result for each password requirement
 */
export function getPasswordRequirementStatus(password: string): PasswordRequirementStatus {
  return {
    length: PASSWORD_POLICY.requirements[0].test(password),
    uppercase: PASSWORD_POLICY.requirements[1].test(password),
    lowercase: PASSWORD_POLICY.requirements[2].test(password),
    digit: PASSWORD_POLICY.requirements[3].test(password),
    punctuation: PASSWORD_POLICY.requirements[4].test(password),
  };
}

const signupPasswordSchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, `Password must be at least ${PASSWORD_POLICY.minLength} characters`)
  .max(PASSWORD_POLICY.maxLength, `Password must be at most ${PASSWORD_POLICY.maxLength} characters`)
  .regex(UPPERCASE_PASSWORD_PATTERN, 'Password must include an uppercase letter')
  .regex(LOWERCASE_PASSWORD_PATTERN, 'Password must include a lowercase letter')
  .regex(DIGIT_PASSWORD_PATTERN, 'Password must include a number')
  .regex(PUNCTUATION_PASSWORD_PATTERN, 'Password must include a punctuation mark');

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Validates the email submitted to request a password-reset code. */
export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

/** Validates a reset code and replacement password against signup's password policy. */
export const completePasswordResetSchema = z
  .object({
    code: z.string().length(8, 'Code must be 8 digits').regex(/^\d{8}$/, 'Code must be 8 digits'),
    password: signupPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data: { code: string; password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const USERNAME_POLICY = {
  minLength: 3,
  maxLength: 32,
} as const;

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(USERNAME_POLICY.minLength, `Username must be at least ${USERNAME_POLICY.minLength} characters`)
      .max(USERNAME_POLICY.maxLength, `Username must be at most ${USERNAME_POLICY.maxLength} characters`)
      .regex(/^\S+$/, 'Username must not contain whitespace'),
    email: z.string().email('Invalid email address'),
    password: signupPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const onboardingNamesSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(64, 'First name must be at most 64 characters'),
  lastName: z.string().trim().min(1, 'Last name is required').max(64, 'Last name must be at most 64 characters'),
});

export const onboardingExtrasSchema = z.object({
  displayPicture: z.string().url('Invalid image URL').optional().or(z.literal('')),
  interests: z.array(z.string()).optional(),
});

export const onboardingSchema = onboardingNamesSchema.extend(onboardingExtrasSchema.shape);

export const profileSchema = z.object({
  firstName: z.string().max(64, 'First name must be at most 64 characters'),
  lastName: z.string().max(64, 'Last name must be at most 64 characters'),
  bio: z.string().max(280, 'Bio must be at most 280 characters'),
  interests: z.array(z.string()),
});

/** Validates the post-event star rating before submission. */
export const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RequestPasswordResetFormData = z.infer<typeof requestPasswordResetSchema>;
export type CompletePasswordResetFormData = z.infer<typeof completePasswordResetSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;
export type OnboardingNamesData = z.infer<typeof onboardingNamesSchema>;
export type OnboardingExtrasData = z.infer<typeof onboardingExtrasSchema>;
export type OnboardingFormData = z.infer<typeof onboardingSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;

const registrationAnswerSchema = z.union([z.string(), z.array(z.string()), z.number(), z.null()]);
const registrationFormBaseSchema = z.object({
  answers: z.record(z.string(), registrationAnswerSchema),
});

function addRegistrationIssue(context: z.RefinementCtx, blockId: string, message: string): void {
  context.addIssue({ code: 'custom', message, path: ['answers', blockId] });
}

function isEmptyAnswer(block: FormBlock, value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (block.type === 'TEXT') {
    return typeof value === 'string' && value.trim().length === 0;
  }
  if (block.type === 'MULTIPLE_CHOICE') {
    return block.allowMultiple ? Array.isArray(value) && value.length === 0 : value === '';
  }

  return value === null;
}

function validateTextAnswer(block: FormBlock, value: unknown, context: z.RefinementCtx): void {
  if (typeof value !== 'string') {
    addRegistrationIssue(context, block.id, 'Enter a valid answer');
    return;
  }

  const maxLength: number | undefined = getTextConfiguration(block).maxLength;
  if (maxLength !== undefined && value.length > maxLength) {
    addRegistrationIssue(context, block.id, 'Answer is too long');
  }
}

function validateChoiceAnswer(block: FormBlock, value: unknown, context: z.RefinementCtx): void {
  const optionIds: Set<string> = new Set(block.options.map((option: FormOption): string => option.id));

  if (block.allowMultiple) {
    if (!Array.isArray(value)) {
      addRegistrationIssue(context, block.id, 'Choose valid options');
      return;
    }

    if (value.some((optionId: unknown): boolean => typeof optionId !== 'string' || !optionIds.has(optionId))) {
      addRegistrationIssue(context, block.id, 'Choose valid options');
    }
    return;
  }

  if (typeof value !== 'string') {
    addRegistrationIssue(context, block.id, 'Choose a valid option');
    return;
  }

  if (value.length > 0 && !optionIds.has(value)) {
    addRegistrationIssue(context, block.id, 'Choose a valid option');
  }
}

function validateScaleAnswer(block: FormBlock, value: unknown, context: z.RefinementCtx): void {
  if (value === null) {
    return;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    addRegistrationIssue(context, block.id, 'Choose a valid scale value');
    return;
  }

  if (!getScaleOptions(block).includes(value)) {
    addRegistrationIssue(context, block.id, 'Choose a valid scale value');
  }
}

function validateRegistrationBlock(block: FormBlock, value: unknown, context: z.RefinementCtx): void {
  if (block.isRequired && isEmptyAnswer(block, value)) {
    addRegistrationIssue(context, block.id, 'This question is required');
    return;
  }

  if (value === undefined) {
    return;
  }

  if (block.type === 'TEXT') {
    validateTextAnswer(block, value, context);
    return;
  }

  if (block.type === 'MULTIPLE_CHOICE') {
    validateChoiceAnswer(block, value, context);
    return;
  }

  validateScaleAnswer(block, value, context);
}

/**
 * Creates validation rules from organizer-defined registration blocks.
 *
 * @param blocks - Server-defined blocks that determine requiredness and valid values
 * @returns A Zod schema for the registration form data
 */
export function createRegistrationFormSchema(
  blocks: FormBlock[],
): z.ZodType<RegistrationFormData, RegistrationFormData> {
  return registrationFormBaseSchema.superRefine((data: RegistrationFormData, context: z.RefinementCtx): void => {
    for (const block of blocks) {
      validateRegistrationBlock(block, data.answers[block.id], context);
    }
  });
}
