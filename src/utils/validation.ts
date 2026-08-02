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

export const onboardingSchema = z.object({
  firstName: z.string().max(64, 'First name must be at most 64 characters').optional(),
  lastName: z.string().max(64, 'Last name must be at most 64 characters').optional(),
  displayPicture: z.string().url('Invalid image URL').optional().or(z.literal('')),
  interests: z.array(z.string()).optional(),
});

export const profileSchema = z.object({
  firstName: z.string().max(64, 'First name must be at most 64 characters'),
  lastName: z.string().max(64, 'Last name must be at most 64 characters'),
  bio: z.string().max(280, 'Bio must be at most 280 characters'),
  interests: z.array(z.string()),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;
export type OnboardingFormData = z.infer<typeof onboardingSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
