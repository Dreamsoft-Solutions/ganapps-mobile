import {
  sqliteTable,
  text,
  integer,
} from 'drizzle-orm/sqlite-core';

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

export const featureCache = sqliteTable('feature_cache', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const userCache = sqliteTable('user_cache', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
