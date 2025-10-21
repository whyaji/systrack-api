import { json } from 'drizzle-orm/mysql-core';
import { index } from 'drizzle-orm/mysql-core';
import { bigint, mysqlTable, text, timestamp, tinyint, varchar } from 'drizzle-orm/mysql-core';

export const usersTable = mysqlTable('users', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().notNull().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const servicesTable = mysqlTable('services', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().notNull().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  type: tinyint('type').notNull().default(1), // 1: server, 2: vps, 3: shared hosting
  status: tinyint('status').notNull().default(1), // 1: active, 0: inactive
  resStatusApiUrl: varchar('res_status_api_url', { length: 255 }).notNull(),
  resStatusApiKey: text('res_status_api_key').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const serviceLogsTable = mysqlTable(
  'service_logs',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().notNull().primaryKey(),
    serviceId: bigint('service_id', { mode: 'number', unsigned: true })
      .references(() => servicesTable.id)
      .notNull(),
    data: json('data').notNull(),
    recordId: bigint('record_id', { mode: 'number', unsigned: true }).notNull(),
    recordedAt: timestamp('recorded_at').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [index('idx_service_logs_service_id').on(table.serviceId)]
);

export const userRefreshTokenTable = mysqlTable(
  'user_refresh_tokens',
  {
    id: varchar('id', { length: 36 }).notNull().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull(),
    isRevoked: tinyint('is_revoked').default(0), // 0 = false, 1 = true
    deviceInfo: varchar('device_info', { length: 255 }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_refresh_tokens_user_id').on(table.userId)]
);
