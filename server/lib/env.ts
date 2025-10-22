import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000'),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('3306'),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  JWT_SECRET: z.string(),
  HASH_SALT: z.string().default('salt'),
  TURNSTILE_SECRET_KEY: z.string(),
  // Redis configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  // WhatsApp Bot configuration
  WHATSAPP_SESSION_PATH: z.string().default('./whatsapp-session'),
  WHATSAPP_ADMIN_PHONE: z.string().optional(),
  WHATSAPP_GROUPS_ONLY: z.string().default('true'),
});

export default envSchema.parse(process.env);
