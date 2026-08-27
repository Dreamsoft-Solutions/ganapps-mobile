import type { FormBlock, RegistrationFormData } from '@/types/ganap.types';
import {
  createRegistrationFormSchema,
  getPasswordRequirementStatus,
  loginSchema,
  onboardingExtrasSchema,
  onboardingNamesSchema,
  onboardingSchema,
  PASSWORD_POLICY,
  profileSchema,
  ratingSchema,
  registerSchema,
  verifyEmailSchema,
} from './validation';

const baseFormBlock: FormBlock = {
  id: 'block_1',
  ganapId: 'g1',
  scope: 'REGISTRATION',
  type: 'TEXT',
  label: 'Question',
  isRequired: false,
  allowMultiple: false,
  order: 1,
  config: null,
  options: [],
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

function makeFormBlock(overrides: Partial<FormBlock>): FormBlock {
  return { ...baseFormBlock, ...overrides };
}

function expectIssue(
  result: ReturnType<ReturnType<typeof createRegistrationFormSchema>['safeParse']>,
  blockId: string,
  message: string,
): void {
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ message, path: ['answers', blockId] })]),
    );
  }
}

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects a short password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'short' });
    expect(result.success).toBe(false);
  });

  it('keeps login validation compatible with an existing eight-character password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'password' });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema', () => {
  it('accepts a valid registration payload', () => {
    const result = registerSchema.safeParse({
      username: 'johndoe',
      email: 'user@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      username: 'johndoe',
      email: 'user@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123?',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a short username', () => {
    const result = registerSchema.safeParse({
      username: 'jd',
      email: 'user@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ['missing uppercase', 'password123!'],
    ['missing lowercase', 'PASSWORD123!'],
    ['missing number', 'Password!!!'],
    ['missing punctuation', 'Password123'],
  ])('rejects a signup password that is %s', (_reason: string, password: string) => {
    const result = registerSchema.safeParse({
      username: 'johndoe',
      email: 'user@example.com',
      password,
      confirmPassword: password,
    });

    expect(result.success).toBe(false);
  });

  it('accepts Unicode characters when all required ASCII categories are present', () => {
    const password = 'Password123!é';
    const result = registerSchema.safeParse({
      username: 'johndoe',
      email: 'user@example.com',
      password,
      confirmPassword: password,
    });

    expect(result.success).toBe(true);
  });

  it('accepts the configured password length boundaries', () => {
    const atMinimum = `${'A'.repeat(PASSWORD_POLICY.minLength - 3)}a1!`;
    const atMaximum = `${'A'.repeat(PASSWORD_POLICY.maxLength - 3)}a1!`;

    expect(
      registerSchema.safeParse({
        username: 'johndoe',
        email: 'user@example.com',
        password: atMinimum,
        confirmPassword: atMinimum,
      }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({
        username: 'johndoe',
        email: 'user@example.com',
        password: atMaximum,
        confirmPassword: atMaximum,
      }).success,
    ).toBe(true);
  });

  it('rejects a password longer than the configured maximum', () => {
    const password = `${'A'.repeat(PASSWORD_POLICY.maxLength - 2)}a1!x`;

    expect(
      registerSchema.safeParse({
        username: 'johndoe',
        email: 'user@example.com',
        password,
        confirmPassword: password,
      }).success,
    ).toBe(false);
  });

  it('exposes checklist status from the same policy used by signup validation', () => {
    expect(getPasswordRequirementStatus('Password123!')).toEqual({
      length: true,
      uppercase: true,
      lowercase: true,
      digit: true,
      punctuation: true,
    });
    expect(getPasswordRequirementStatus('password123')).toMatchObject({
      uppercase: false,
      punctuation: false,
    });
  });
});

describe('verifyEmailSchema', () => {
  it('accepts a 6-digit code', () => {
    const result = verifyEmailSchema.safeParse({ code: '123456' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-numeric code', () => {
    const result = verifyEmailSchema.safeParse({ code: 'abcdef' });
    expect(result.success).toBe(false);
  });

  it('rejects a code with the wrong length', () => {
    const result = verifyEmailSchema.safeParse({ code: '12345' });
    expect(result.success).toBe(false);
  });
});

describe('onboardingNamesSchema', () => {
  it('accepts a first and last name', () => {
    const result = onboardingNamesSchema.safeParse({ firstName: 'Maria', lastName: 'Santos' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing last name, because step 1 is required', () => {
    const result = onboardingNamesSchema.safeParse({ firstName: 'Maria' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty first name', () => {
    const result = onboardingNamesSchema.safeParse({ firstName: '', lastName: 'Santos' });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only names, which would satisfy a bare min(1)', () => {
    const result = onboardingNamesSchema.safeParse({ firstName: '   ', lastName: '   ' });
    expect(result.success).toBe(false);
  });

  it('trims surrounding whitespace off accepted names', () => {
    const result = onboardingNamesSchema.safeParse({ firstName: '  Maria  ', lastName: 'Santos' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe('Maria');
    }
  });

  it('rejects a name longer than 64 characters', () => {
    const result = onboardingNamesSchema.safeParse({ firstName: 'a'.repeat(65), lastName: 'Santos' });
    expect(result.success).toBe(false);
  });
});

describe('onboardingExtrasSchema', () => {
  it('accepts an empty payload, because step 2 is optional', () => {
    const result = onboardingExtrasSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts interests', () => {
    const result = onboardingExtrasSchema.safeParse({ interests: ['food', 'coffee'] });
    expect(result.success).toBe(true);
  });

  it('accepts an empty display picture, which is the form default', () => {
    const result = onboardingExtrasSchema.safeParse({ displayPicture: '' });
    expect(result.success).toBe(true);
  });

  it('accepts a local file URI from the image picker', () => {
    const result = onboardingExtrasSchema.safeParse({ displayPicture: 'file:///tmp/avatar.jpg' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid display picture URL', () => {
    const result = onboardingExtrasSchema.safeParse({ displayPicture: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});

describe('onboardingSchema', () => {
  it('accepts names plus extras together', () => {
    const result = onboardingSchema.safeParse({
      firstName: 'Maria',
      lastName: 'Santos',
      displayPicture: '',
      interests: ['food'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload with no names, since the names half is required', () => {
    const result = onboardingSchema.safeParse({ interests: ['food'] });
    expect(result.success).toBe(false);
  });
});

describe('profileSchema', () => {
  it('accepts editable profile fields', () => {
    const result = profileSchema.safeParse({
      firstName: 'Maria',
      lastName: 'Santos',
      bio: 'Always looking for the next good event.',
      interests: ['food'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects bios longer than the server limit', () => {
    const result = profileSchema.safeParse({
      firstName: '',
      lastName: '',
      bio: 'a'.repeat(281),
      interests: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('createRegistrationFormSchema', () => {
  it('rejects whitespace-only required text at the field path', () => {
    const block = makeFormBlock({ id: 'required_text', isRequired: true });
    const result = createRegistrationFormSchema([block]).safeParse({ answers: { required_text: '   ' } });

    expectIssue(result, 'required_text', 'This question is required');
  });

  it('accepts an optional blank text answer', () => {
    const block = makeFormBlock({ id: 'optional_text' });

    expect(createRegistrationFormSchema([block]).safeParse({ answers: { optional_text: '' } }).success).toBe(true);
  });

  it('rejects text longer than the valid configured maximum', () => {
    const block = makeFormBlock({ id: 'limited_text', config: { maxLength: 3 } });
    const result = createRegistrationFormSchema([block]).safeParse({ answers: { limited_text: 'abcd' } });

    expectIssue(result, 'limited_text', 'Answer is too long');
  });

  it.each(['', 'unknown'])('rejects an invalid required single-choice answer %j', (answer: string) => {
    const block = makeFormBlock({
      id: 'single_choice',
      type: 'MULTIPLE_CHOICE',
      isRequired: true,
      options: [{ id: 'option_1', label: 'One', value: 'one', order: 1 }],
    });
    const result = createRegistrationFormSchema([block]).safeParse({ answers: { single_choice: answer } });

    expectIssue(result, 'single_choice', answer === '' ? 'This question is required' : 'Choose a valid option');
  });

  it('rejects empty and unknown required multiple-choice answers', () => {
    const block = makeFormBlock({
      id: 'multiple_choice',
      type: 'MULTIPLE_CHOICE',
      isRequired: true,
      allowMultiple: true,
      options: [{ id: 'option_1', label: 'One', value: 'one', order: 1 }],
    });
    const schema = createRegistrationFormSchema([block]);

    expectIssue(schema.safeParse({ answers: { multiple_choice: [] } }), 'multiple_choice', 'This question is required');
    expectIssue(
      schema.safeParse({ answers: { multiple_choice: ['unknown'] } }),
      'multiple_choice',
      'Choose valid options',
    );
  });

  it('rejects null and non-discrete required scale answers', () => {
    const block = makeFormBlock({ id: 'scale', type: 'SCALE', isRequired: true, config: { min: 1, max: 5, step: 2 } });
    const schema = createRegistrationFormSchema([block]);

    expectIssue(schema.safeParse({ answers: { scale: null } }), 'scale', 'This question is required');
    expectIssue(schema.safeParse({ answers: { scale: 2 } }), 'scale', 'Choose a valid scale value');
  });

  it('accepts optional unanswered fields and rejects an optional wrong value shape', () => {
    const blocks: FormBlock[] = [
      makeFormBlock({ id: 'optional_text' }),
      makeFormBlock({ id: 'optional_choice', type: 'MULTIPLE_CHOICE', options: [] }),
      makeFormBlock({ id: 'optional_scale', type: 'SCALE' }),
    ];
    const schema = createRegistrationFormSchema(blocks);

    expect(schema.safeParse({ answers: {} }).success).toBe(true);
    expect(schema.safeParse({ answers: { optional_text: [] } }).success).toBe(false);
  });

  it('parses a valid mixed form', () => {
    const blocks: FormBlock[] = [
      makeFormBlock({ id: 'text', isRequired: true, config: { maxLength: 20 } }),
      makeFormBlock({
        id: 'single',
        type: 'MULTIPLE_CHOICE',
        isRequired: true,
        options: [{ id: 'option_1', label: 'One', value: 'one', order: 1 }],
      }),
      makeFormBlock({
        id: 'multiple',
        type: 'MULTIPLE_CHOICE',
        allowMultiple: true,
        options: [{ id: 'option_2', label: 'Two', value: 'two', order: 1 }],
      }),
      makeFormBlock({ id: 'scale', type: 'SCALE', isRequired: true, config: { min: 0, max: 4, step: 2 } }),
    ];
    const data: RegistrationFormData = {
      answers: { text: 'Hello', single: 'option_1', multiple: ['option_2'], scale: 0 },
    };

    expect(createRegistrationFormSchema(blocks).safeParse(data)).toEqual({ success: true, data });
  });
});

describe('ratingSchema', () => {
  it.each([1, 2, 3, 4, 5])('accepts a whole score of %i', (score: number) => {
    expect(ratingSchema.safeParse({ score }).success).toBe(true);
  });

  it.each([0, 6, -1])('rejects an out-of-range score of %i', (score: number) => {
    expect(ratingSchema.safeParse({ score }).success).toBe(false);
  });

  it('rejects a fractional score', () => {
    expect(ratingSchema.safeParse({ score: 4.5 }).success).toBe(false);
  });

  it('rejects a missing score', () => {
    expect(ratingSchema.safeParse({}).success).toBe(false);
  });
});
