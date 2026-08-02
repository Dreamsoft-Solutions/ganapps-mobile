import { z } from 'zod';

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

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;
export type OnboardingNamesData = z.infer<typeof onboardingNamesSchema>;
export type OnboardingExtrasData = z.infer<typeof onboardingExtrasSchema>;
export type OnboardingFormData = z.infer<typeof onboardingSchema>;
