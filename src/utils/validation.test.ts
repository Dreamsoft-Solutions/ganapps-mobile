import {
  loginSchema,
  onboardingExtrasSchema,
  onboardingNamesSchema,
  onboardingSchema,
  profileSchema,
  registerSchema,
  verifyEmailSchema,
} from './validation';

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
});

describe('registerSchema', () => {
  it('accepts a valid registration payload', () => {
    const result = registerSchema.safeParse({
      username: 'johndoe',
      email: 'user@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      username: 'johndoe',
      email: 'user@example.com',
      password: 'password123',
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a short username', () => {
    const result = registerSchema.safeParse({
      username: 'jd',
      email: 'user@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(result.success).toBe(false);
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
