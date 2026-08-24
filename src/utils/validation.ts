import { z } from 'zod';
import type { FormBlock, FormOption, RegistrationFormData } from '@/types/ganap.types';
import { getScaleOptions, getTextConfiguration } from './registration-form';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(32, 'Username must be at most 32 characters'),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
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
      const value: unknown = data.answers[block.id];

      if (block.isRequired && isEmptyAnswer(block, value)) {
        addRegistrationIssue(context, block.id, 'This question is required');
        continue;
      }

      if (value === undefined) {
        continue;
      }

      if (block.type === 'TEXT') {
        if (typeof value !== 'string') {
          addRegistrationIssue(context, block.id, 'Enter a valid answer');
          continue;
        }

        const maxLength: number | undefined = getTextConfiguration(block).maxLength;
        if (maxLength !== undefined && value.length > maxLength) {
          addRegistrationIssue(context, block.id, 'Answer is too long');
        }
        continue;
      }

      if (block.type === 'MULTIPLE_CHOICE') {
        const optionIds: Set<string> = new Set(block.options.map((option: FormOption): string => option.id));

        if (block.allowMultiple) {
          if (!Array.isArray(value)) {
            addRegistrationIssue(context, block.id, 'Choose valid options');
            continue;
          }

          if (value.some((optionId: string) => !optionIds.has(optionId))) {
            addRegistrationIssue(context, block.id, 'Choose valid options');
          }
        } else {
          if (typeof value !== 'string') {
            addRegistrationIssue(context, block.id, 'Choose a valid option');
            continue;
          }

          if (value.length > 0 && !optionIds.has(value)) {
            addRegistrationIssue(context, block.id, 'Choose a valid option');
          }
        }
        continue;
      }

      if (value === null) {
        continue;
      }

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        addRegistrationIssue(context, block.id, 'Choose a valid scale value');
        continue;
      }

      if (!getScaleOptions(block).includes(value)) {
        addRegistrationIssue(context, block.id, 'Choose a valid scale value');
      }
    }
  });
}
