import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit configuration.
 *
 * `driver: 'expo'` is what makes `drizzle-kit generate` emit a `migrations.js`
 * bundle alongside the raw SQL. React Native's bundler cannot import `.sql`
 * files, so without it the generated migrations are unusable at runtime and
 * `useMigrations` has nothing to apply.
 *
 * Migrations are generated and applied by a human, never by an agent — see
 * AGENTS.md under Commands.
 */
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
