import { loginSchema, onboardingSchema, registerSchema, verifyEmailSchema } from './validation';

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

describe('onboardingSchema', () => {
  it('accepts a minimal profile', () => {
    const result = onboardingSchema.safeParse({
      firstName: 'Maria',
      lastName: 'Santos',
      interests: ['food', 'coffee'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty profile', () => {
    const result = onboardingSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects an invalid display picture URL', () => {
    const result = onboardingSchema.safeParse({
      firstName: 'Maria',
      displayPicture: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});
