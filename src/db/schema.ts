import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  action: text('action').notNull(),
  payload: text('payload').notNull(),
  status: text('status').notNull().default('pending'),
  retries: integer('retries').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Offline copy of the Ganap browse list.
 *
 * The list item is stored serialised rather than as mirrored columns, so a new
 * field on the server's response does not require a migration here.
 */
export const ganapCache = sqliteTable('ganap_cache', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  cachedAt: integer('cached_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userCache = sqliteTable('user_cache', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
