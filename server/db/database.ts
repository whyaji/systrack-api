import type { Logger as drizzleLogger } from 'drizzle-orm/logger';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import * as schema from './schema/schema.js';

const DB_ERRORS = {
  DUPLICATE_KEY: 'ER_DUP_ENTRY',
};

export interface DatabaseError {
  type: string;
  message: string;
  stack?: string;
  code: string;
  errno: number;
  sql: string;
  sqlState: string;
  sqlMessage: string;
}

class DBLogger implements drizzleLogger {
  logQuery(query: string, params: unknown[]): void {
    logger.debug({ query, params });
  }
}

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 45,
  queueLimit: 0,
});

pool.on('connection', () => {
  logger.info('New MySQL connection created');
});

const db = drizzle(pool, {
  schema: schema,
  mode: 'default',
  logger: new DBLogger(),
});

export { pool as connection, db, DB_ERRORS };
