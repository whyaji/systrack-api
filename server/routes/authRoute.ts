import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { and, count, eq, gte } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import { z } from 'zod';

import { db } from '../db/database.js';
import { userRefreshTokenTable, usersTable } from '../db/schema/schema.js';
import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { verifyTurnstileToken } from '../lib/security.js';
import authMiddleware from '../middleware/jwt.js';

// JWT secret key
const JWT_SECRET = env.JWT_SECRET;
const environtment = env.NODE_ENV;
const hashSalt = env.HASH_SALT;

const userSchemaZod = z.object({
  id: z.number().int().positive(),
  name: z.string().min(3),
  email: z.email().min(3),
  password: z.string().min(6),
});

const loginSchema = userSchemaZod.omit({ name: true, id: true });
const loginWithTurnstileSchema = loginSchema.extend({
  turnstileToken: z.string().min(1, 'TurnstileToken token is required'),
});

export type User = z.infer<typeof userSchemaZod>;

async function generateAuthTokens(user: { id: number; email: string }, deviceInfo?: string) {
  // Access token - short lived (15-30 minutes)
  const accessTokenExpiredAt = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes

  // Refresh token - long lived (7-30 days)
  const refreshTokenExpiredAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const accessToken = await sign(
    {
      userId: user.id,
      email: user.email,
      type: 'access',
      exp: accessTokenExpiredAt,
    },
    JWT_SECRET
  );

  // Generate secure refresh token
  const refreshToken = crypto.randomUUID() + '-' + crypto.randomBytes(32).toString('hex');

  // Store refresh token in database
  await db.insert(userRefreshTokenTable).values({
    id: crypto.randomUUID(),
    userId: user.id,
    token: await bcrypt.hash(refreshToken, hashSalt ?? 'salt'), // Hash the refresh token
    expiresAt: refreshTokenExpiredAt,
    createdAt: new Date(),
    isRevoked: 0,
    deviceInfo: deviceInfo || 'unknown',
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiredAt: new Date(accessTokenExpiredAt * 1000).toISOString(),
    refreshTokenExpiredAt: refreshTokenExpiredAt.toISOString(),
  };
}

export const authRoute = new Hono()
  .post('/login', zValidator('json', loginWithTurnstileSchema), async (c) => {
    const { email, password, turnstileToken } = c.req.valid('json');
    const deviceInfo = c.req.header('User-Agent') || 'unknown';
    const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

    if (environtment !== 'development') {
      const isValid = await verifyTurnstileToken(turnstileToken, clientIP);
      if (!isValid) {
        return c.json({ message: 'Invalid turnstile token.' }, 401);
      }
    }

    try {
      // get count user
      const countUser = await db.select({ count: count() }).from(usersTable);

      // if coutn user is 0, then create admin user
      if (countUser[0].count === 0) {
        const hashedPassword = await bcrypt.hash(password, hashSalt ?? 'salt');
        await db.insert(usersTable).values({
          name: 'Admin',
          email: email,
          password: hashedPassword,
        });
      }

      // Find user by email
      const user = await db.select().from(usersTable).where(eq(usersTable.email, email));

      if (user.length === 0) {
        return c.json({ message: 'Invalid email or password.' }, 401);
      }

      // Verify password
      const hashedPassword = await bcrypt.hash(password, hashSalt ?? 'salt');
      if (hashedPassword !== user[0].password) {
        return c.json({ message: 'Invalid email or password.' }, 401);
      }

      // Generate JWT token
      const tokens = await generateAuthTokens(user[0], deviceInfo);

      const userData = await getUserById(user[0].id);

      if (!userData) {
        return c.json({ message: 'User not found.' }, 404);
      }

      return c.json({
        data: {
          ...tokens,
          user: userData,
        },
      });
    } catch (error) {
      logger.error(`Error during sign-in: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  })
  .post(
    'refresh',
    zValidator(
      'json',
      z.object({
        refreshToken: z.string(),
        userId: z.number().int().positive(),
      })
    ),
    async (c) => {
      const { refreshToken, userId } = c.req.valid('json');
      const deviceInfo = c.req.header('User-Agent') || 'unknown';

      try {
        // Find refresh token in database
        const storedTokens = await db
          .select()
          .from(userRefreshTokenTable)
          .where(
            and(
              eq(userRefreshTokenTable.userId, userId),
              eq(userRefreshTokenTable.isRevoked, 0),
              gte(userRefreshTokenTable.expiresAt, new Date())
            )
          );

        let validToken = null;
        for (const stored of storedTokens) {
          const hashedRefreshToken = await bcrypt.hash(refreshToken, hashSalt ?? 'salt');
          if (stored.token === hashedRefreshToken) {
            validToken = stored;
            break;
          }
        }

        if (!validToken) {
          return c.json({ message: 'Invalid refresh token.' }, 401);
        }

        // Get user data
        const user = await db.select().from(usersTable).where(eq(usersTable.id, validToken.userId));

        if (user.length === 0) {
          return c.json({ message: 'User not found.' }, 401);
        }

        // Revoke used refresh token
        await db
          .update(userRefreshTokenTable)
          .set({ isRevoked: 1 })
          .where(eq(userRefreshTokenTable.id, validToken.id));

        // Generate new tokens
        const tokens = await generateAuthTokens(user[0], deviceInfo);

        return c.json({
          success: true,
          data: tokens,
        });
      } catch (error) {
        logger.error(`Error during token refresh: ${error}`);
        return c.json({ success: false, message: 'Internal server error.' }, 500);
      }
    }
  )
  .get('/profile', authMiddleware, async (c) => {
    const payload = c.get('jwtPayload');
    try {
      const user = await getUserById(payload.userId);
      if (!user) {
        return c.json({ message: 'User not found.' }, 404);
      }
      return c.json({ data: user });
    } catch (error) {
      logger.error(`Error fetching profile: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  })
  .post('logout', authMiddleware, async (c) => {
    const refreshToken = c.req.header('X-Refresh-Token');
    console.log('Logout request received with refresh token:', refreshToken);

    try {
      // Revoke refresh token if provided
      if (refreshToken) {
        const storedTokens = await db
          .select()
          .from(userRefreshTokenTable)
          .where(eq(userRefreshTokenTable.isRevoked, 0));

        for (const stored of storedTokens) {
          const isValid = await bcrypt.compare(refreshToken, stored.token);
          if (isValid) {
            await db
              .update(userRefreshTokenTable)
              .set({ isRevoked: 1 })
              .where(eq(userRefreshTokenTable.id, stored.id));
            break;
          }
        }
      }

      deleteCookie(c, 'access_token');
      deleteCookie(c, 'refresh_token');

      return c.json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (error) {
      logger.error(`Error during logout: ${error}`);
      return c.json({ success: false, message: 'Internal server error.' }, 500);
    }
  });

async function getUserById(id: number) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user[0];
}
